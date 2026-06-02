const db = require('../config/db');
const PDFDocument = require('pdfkit');

exports.markAttendance = async (req, res) => {
    const { employee_id, date, status, advance_amount = 0 } = req.body;
    try {
        await db.execute(
            `INSERT INTO attendance (organization_id, employee_id, date, status, advance_amount) 
             VALUES (?, ?, ?, ?, ?) 
             ON CONFLICT(employee_id, date) DO UPDATE SET 
             status = excluded.status, 
             advance_amount = excluded.advance_amount`,
            [req.user.organization_id, employee_id, date, status, advance_amount]
        );
        res.json({ message: 'Attendance marked successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getAttendanceReport = async (req, res) => {
    const { month, year } = req.query;
    const orgId = req.user.organization_id;

    if (!orgId && req.user.username !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Organization ID missing' });
    }

    try {
        const [employees] = await db.execute(
            orgId ? 'SELECT id, full_name, employee_type FROM employees WHERE organization_id = ?' : 'SELECT id, full_name, employee_type FROM employees WHERE organization_id IS NULL',
            orgId ? [orgId] : []
        );

        const [attendance] = await db.execute(
            `SELECT employee_id, CAST(strftime('%d', date) AS INTEGER) as day, status, advance_amount 
             FROM attendance 
             WHERE CAST(strftime('%m', date) AS INTEGER) = ? AND CAST(strftime('%Y', date) AS INTEGER) = ? AND ${orgId ? 'organization_id = ?' : 'organization_id IS NULL'}`,
            orgId ? [month, year, orgId] : [month, year]
        );

        const daysInMonth = new Date(year, month, 0).getDate();

        // Get local today string
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const report = employees.map(emp => {
            const empAttendance = {};
            const empAdvances = {};
            
            // Map existing database records
            attendance.filter(a => a.employee_id === emp.id).forEach(a => {
                empAttendance[a.day] = a.status;
                empAdvances[a.day] = a.advance_amount;
            });

            // Auto-mark missing past dates as Absent (or Leave for company employees on Sundays)
            for (let day = 1; day <= daysInMonth; day++) {
                if (empAttendance[day] === undefined) {
                    const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    if (formattedDate <= todayStr) {
                        const isSun = new Date(year, month - 1, day).getDay() === 0;
                        if (isSun && emp.employee_type !== 'per_day_worker') {
                            empAttendance[day] = 'Leave';
                        } else {
                            empAttendance[day] = 'Absent';
                        }
                        empAdvances[day] = 0;
                    }
                }
            }

            return {
                id: emp.id,
                full_name: emp.full_name,
                days: empAttendance,
                advances: empAdvances
            };
        });

        res.json({ month, year, daysInMonth, report });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getTodayAttendance = async (req, res) => {
    const targetDate = req.query.date || new Date().toISOString().split('T')[0];
    const orgId = req.user.organization_id;
    try {
        // Get all employees for this organization
        const [employees] = await db.execute(
            orgId 
                ? `SELECT id, full_name FROM employees WHERE organization_id = ?`
                : `SELECT id, full_name FROM employees WHERE organization_id IS NULL`,
            orgId ? [orgId] : []
        );

        // Get existing attendance records for targetDate
        const [attendance] = await db.execute(
            orgId 
                ? `SELECT employee_id, status FROM attendance WHERE date = ? AND organization_id = ?`
                : `SELECT employee_id, status FROM attendance WHERE date = ? AND organization_id IS NULL`,
            orgId ? [targetDate, orgId] : [targetDate]
        );

        const markedMap = new Set(attendance.map(a => a.employee_id));

        // Get local today string in YYYY-MM-DD format (timezone safe)
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        // Auto-mark as 'Absent' or 'Leave' (for Sundays) if not in database and targetDate is today or past
        if (targetDate <= todayStr) {
            const [employeesWithType] = await db.execute(
                orgId 
                    ? `SELECT id, employee_type FROM employees WHERE organization_id = ?`
                    : `SELECT id, employee_type FROM employees WHERE organization_id IS NULL`,
                orgId ? [orgId] : []
            );
            const typeMap = {};
            employeesWithType.forEach(e => {
                typeMap[e.id] = e.employee_type || 'company_employee';
            });

            const parts = targetDate.split('-');
            const isSun = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getDay() === 0;

            for (const emp of employees) {
                if (!markedMap.has(emp.id)) {
                    const empType = typeMap[emp.id];
                    const defaultStatus = (isSun && empType !== 'per_day_worker') ? 'Leave' : 'Absent';
                    await db.execute(
                        `INSERT INTO attendance (organization_id, employee_id, date, status, advance_amount) 
                         VALUES (?, ?, ?, ?, 0)
                         ON CONFLICT(employee_id, date) DO UPDATE SET status = ?`,
                        [orgId, emp.id, targetDate, defaultStatus, defaultStatus]
                    );
                }
            }
        }

        const [rows] = await db.execute(
            `SELECT e.id, e.full_name, a.status, a.advance_amount 
             FROM employees e 
             LEFT JOIN attendance a ON e.id = a.employee_id AND a.date = ?
             WHERE ${orgId ? 'e.organization_id = ?' : 'e.organization_id IS NULL'}`,
            orgId ? [targetDate, orgId] : [targetDate]
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.generateAttendanceReportPDF = async (req, res) => {
    const { month, year } = req.query;
    const orgId = req.user.organization_id;
    try {
        const [employees] = await db.execute(
            orgId ? 'SELECT id, full_name, department, employee_type FROM employees WHERE organization_id = ?' : 'SELECT id, full_name, department, employee_type FROM employees WHERE organization_id IS NULL',
            orgId ? [orgId] : []
        );

        const [attendance] = await db.execute(
            `SELECT date, status, employee_id
             FROM attendance 
             WHERE CAST(strftime('%m', date) AS INTEGER) = ? AND CAST(strftime('%Y', date) AS INTEGER) = ? AND ${orgId ? 'organization_id = ?' : 'organization_id IS NULL'}`,
            orgId ? [month, year, orgId] : [month, year]
        );

        const daysInMonth = new Date(year, month, 0).getDate();
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const attendanceMap = {};
        attendance.forEach(a => {
            let dateStr = '';
            if (a.date instanceof Date) {
                dateStr = a.date.toISOString().split('T')[0];
            } else {
                dateStr = String(a.date).split(' ')[0];
            }
            attendanceMap[`${a.employee_id}_${dateStr}`] = a.status;
        });

        const reportRows = [];
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSun = new Date(year, month - 1, day).getDay() === 0;
            for (const emp of employees) {
                let status = attendanceMap[`${emp.id}_${dateStr}`];
                if (status === undefined) {
                    if (dateStr <= todayStr) {
                        if (isSun && emp.employee_type !== 'per_day_worker') {
                            status = 'Leave';
                        } else {
                            status = 'Absent';
                        }
                    } else {
                        status = 'Not Marked';
                    }
                }
                reportRows.push({
                    dateStr,
                    full_name: emp.full_name,
                    status
                });
            }
        }

        reportRows.sort((a, b) => a.dateStr.localeCompare(b.dateStr) || a.full_name.localeCompare(b.full_name));

        const doc = new PDFDocument();
        let filename = `attendance_report_${month}_${year}.pdf`;

        res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
        res.setHeader('Content-type', 'application/pdf');

        doc.fontSize(20).text(`Attendance Report - ${month}/${year}`, { align: 'center' });
        doc.moveDown();

        reportRows.forEach(row => {
            doc.fontSize(10).text(`${row.dateStr} | ${row.full_name.padEnd(20)} | ${row.status}`);
        });

        doc.pipe(res);
        doc.end();
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
