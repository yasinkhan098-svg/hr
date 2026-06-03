const db = require('../config/db');
const PDFDocument = require('pdfkit');

exports.markAttendance = async (req, res) => {
    const { employee_id, date, status, advance_amount = 0 } = req.body;
    const orgId = req.user.organization_id;
    try {
        await db.execute(
            `INSERT INTO attendance (organization_id, employee_id, date, status, advance_amount) 
             VALUES (?, ?, ?, ?, ?) 
             ON CONFLICT(employee_id, date) DO UPDATE SET 
             status = excluded.status, 
             advance_amount = excluded.advance_amount`,
            [orgId, employee_id, date, status, advance_amount]
        );
        res.json({ message: 'Attendance marked successfully' });

        // Auto-recalculate payroll for this employee's month/year (non-blocking — response already sent)
        try {
            const parts = date.split('-');
            if (parts.length === 3) {
                const month = parseInt(parts[1]);
                const year = parseInt(parts[0]);
                const { recalculatePayrollForEmployee } = require('./payrollController');
                await recalculatePayrollForEmployee(employee_id, month, year, orgId);
            }
        } catch (recalcErr) {
            console.error('[Auto-Recalc] Error recalculating payroll after attendance mark:', recalcErr);
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getAttendanceReport = async (req, res) => {
    const { month, year, employee_type = 'company_employee' } = req.query;
    const orgId = req.user.organization_id;

    if (!orgId && req.user.username !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Organization ID missing' });
    }

    try {
        const [employees] = await db.execute(
            orgId 
                ? 'SELECT id, full_name, employee_type FROM employees WHERE organization_id = ? AND employee_type = ?' 
                : 'SELECT id, full_name, employee_type FROM employees WHERE organization_id IS NULL AND employee_type = ?',
            orgId ? [orgId, employee_type] : [employee_type]
        );

        const [attendance] = await db.execute(
            `SELECT a.employee_id, CAST(strftime('%d', a.date) AS INTEGER) as day, a.status, a.advance_amount 
             FROM attendance a
             JOIN employees e ON a.employee_id = e.id
             WHERE CAST(strftime('%m', a.date) AS INTEGER) = ? 
               AND CAST(strftime('%Y', a.date) AS INTEGER) = ? 
               AND e.employee_type = ?
               AND ${orgId ? 'a.organization_id = ?' : 'a.organization_id IS NULL'}`,
            orgId ? [month, year, employee_type, orgId] : [month, year, employee_type]
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
    const { date, employee_type = 'company_employee' } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const orgId = req.user.organization_id;
    try {
        // Get employees matching this type
        const [employees] = await db.execute(
            orgId 
                ? `SELECT id, full_name FROM employees WHERE organization_id = ? AND employee_type = ?`
                : `SELECT id, full_name FROM employees WHERE organization_id IS NULL AND employee_type = ?`,
            orgId ? [orgId, employee_type] : [employee_type]
        );

        // Get existing attendance records for targetDate and this type
        const [attendance] = await db.execute(
            `SELECT a.employee_id, a.status 
             FROM attendance a
             JOIN employees e ON a.employee_id = e.id
             WHERE a.date = ? 
               AND e.employee_type = ?
               AND ${orgId ? 'a.organization_id = ?' : 'a.organization_id IS NULL'}`,
            orgId ? [targetDate, employee_type, orgId] : [targetDate, employee_type]
        );

        const markedMap = new Set(attendance.map(a => a.employee_id));

        // Get local today string in YYYY-MM-DD format (timezone safe)
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        // Auto-mark missing employees — bulk INSERT in one batch (no loop of awaits)
        if (targetDate <= todayStr) {
            const parts = targetDate.split('-');
            const isSun = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getDay() === 0;

            const missingEmployees = employees.filter(emp => !markedMap.has(emp.id));

            if (missingEmployees.length > 0) {
                // Build one INSERT per missing employee and run all in parallel
                const insertPromises = missingEmployees.map(emp => {
                    const defaultStatus = (isSun && employee_type !== 'per_day_worker') ? 'Leave' : 'Absent';
                    return db.execute(
                        `INSERT INTO attendance (organization_id, employee_id, date, status, advance_amount) 
                         VALUES (?, ?, ?, ?, 0)
                         ON CONFLICT(employee_id, date) DO UPDATE SET status = excluded.status`,
                        [orgId, emp.id, targetDate, defaultStatus]
                    );
                });
                // Fire all inserts concurrently instead of one-by-one
                await Promise.all(insertPromises);
            }
        }

        const [rows] = await db.execute(
            `SELECT e.id, e.full_name, a.status, a.advance_amount 
             FROM employees e 
             LEFT JOIN attendance a ON e.id = a.employee_id AND a.date = ?
             WHERE e.employee_type = ? AND ${orgId ? 'e.organization_id = ?' : 'e.organization_id IS NULL'}`,
            orgId ? [targetDate, employee_type, orgId] : [targetDate, employee_type]
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.generateAttendanceReportPDF = async (req, res) => {
    const { month, year, employee_type = 'company_employee' } = req.query;
    const orgId = req.user.organization_id;
    try {
        const [employees] = await db.execute(
            orgId 
                ? 'SELECT id, full_name, department, employee_type FROM employees WHERE organization_id = ? AND employee_type = ?' 
                : 'SELECT id, full_name, department, employee_type FROM employees WHERE organization_id IS NULL AND employee_type = ?',
            orgId ? [orgId, employee_type] : [employee_type]
        );

        const [attendance] = await db.execute(
            `SELECT a.date, a.status, a.employee_id
             FROM attendance a
             JOIN employees e ON a.employee_id = e.id
             WHERE CAST(strftime('%m', a.date) AS INTEGER) = ? 
               AND CAST(strftime('%Y', a.date) AS INTEGER) = ? 
               AND e.employee_type = ?
               AND ${orgId ? 'a.organization_id = ?' : 'a.organization_id IS NULL'}`,
            orgId ? [month, year, employee_type, orgId] : [month, year, employee_type]
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
