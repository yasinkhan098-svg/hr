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
            orgId ? 'SELECT id, full_name FROM employees WHERE organization_id = ?' : 'SELECT id, full_name FROM employees WHERE organization_id IS NULL',
            orgId ? [orgId] : []
        );

        const [attendance] = await db.execute(
            `SELECT employee_id, CAST(strftime('%d', date) AS INTEGER) as day, status, advance_amount 
             FROM attendance 
             WHERE CAST(strftime('%m', date) AS INTEGER) = ? AND CAST(strftime('%Y', date) AS INTEGER) = ? AND ${orgId ? 'organization_id = ?' : 'organization_id IS NULL'}`,
            orgId ? [month, year, orgId] : [month, year]
        );

        const daysInMonth = new Date(year, month, 0).getDate();

        const report = employees.map(emp => {
            const empAttendance = {};
            const empAdvances = {};
            attendance.filter(a => a.employee_id === emp.id).forEach(a => {
                empAttendance[a.day] = a.status;
                empAdvances[a.day] = a.advance_amount;
            });
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

        // Auto-mark as 'Absent' if not in database and targetDate is today or past
        if (targetDate <= todayStr) {
            for (const emp of employees) {
                if (!markedMap.has(emp.id)) {
                    await db.execute(
                        `INSERT INTO attendance (organization_id, employee_id, date, status, advance_amount) 
                         VALUES (?, ?, ?, 'Absent', 0)
                         ON CONFLICT(employee_id, date) DO UPDATE SET status = 'Absent'`,
                        [orgId, emp.id, targetDate]
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
        const [rows] = await db.execute(
            `SELECT a.date, a.status, e.full_name, e.department 
             FROM attendance a 
             JOIN employees e ON a.employee_id = e.id 
             WHERE CAST(strftime('%m', a.date) AS INTEGER) = ? AND CAST(strftime('%Y', a.date) AS INTEGER) = ? AND ${orgId ? 'a.organization_id = ?' : 'a.organization_id IS NULL'}
             ORDER BY a.date ASC, e.full_name ASC`,
            orgId ? [month, year, orgId] : [month, year]
        );

        const doc = new PDFDocument();
        let filename = `attendance_report_${month}_${year}.pdf`;

        res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
        res.setHeader('Content-type', 'application/pdf');

        doc.fontSize(20).text(`Attendance Report - ${month}/${year}`, { align: 'center' });
        doc.moveDown();

        rows.forEach(row => {
            let dateStr = '';
            if (row.date) {
                if (row.date instanceof Date) {
                    dateStr = row.date.toISOString().split('T')[0];
                } else {
                    dateStr = String(row.date).split(' ')[0];
                }
            }
            doc.fontSize(10).text(`${dateStr} | ${row.full_name.padEnd(20)} | ${row.status}`);
        });

        doc.pipe(res);
        doc.end();
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
