const db = require('../config/db');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

exports.calculatePayroll = async (req, res) => {
    const { employee_id, month, year, overtime_hours = 0, deductions = 0 } = req.body;
    const orgId = req.user.organization_id;
    try {
        // Get Employee Basic Salary
        const [empRows] = await db.execute(
            `SELECT basic_salary FROM employees WHERE id = ? AND ${orgId ? 'organization_id = ?' : 'organization_id IS NULL'}`,
            orgId ? [employee_id, orgId] : [employee_id]
        );
        if (empRows.length === 0) return res.status(404).json({ message: 'Employee not found' });
        const basic_salary = parseFloat(empRows[0].basic_salary);

        const m = parseInt(month);
        const y = parseInt(year);

        // Calculate Days in the specific Month/Year
        const daysInMonth = new Date(year, month, 0).getDate();
        const dailyRate = basic_salary / daysInMonth;

        // Get Attendance Data: count absences and sum advances
        const [attnRows] = await db.execute(
            `SELECT status, advance_amount FROM attendance 
             WHERE employee_id = ? 
               AND CAST(strftime('%m', date) AS INTEGER) = ? 
               AND CAST(strftime('%Y', date) AS INTEGER) = ? 
               AND ${orgId ? 'organization_id = ?' : 'organization_id IS NULL'}`,
            orgId ? [employee_id, m, y, orgId] : [employee_id, m, y]
        );

        console.log(`Calculating payroll for ${employee_id}, ${m}/${y}. Found ${attnRows.length} attendance rows.`);

        let absentDays = 0;
        let totalAdvances = 0;

        attnRows.forEach(row => {
            if (row.status === 'Absent') {
                absentDays++;
            } else if (row.status === 'Half') {
                absentDays += 0.5;
            }
            const adv = parseFloat(row.advance_amount || 0);
            totalAdvances += adv;
        });

        console.log(`Absent days: ${absentDays}, Total Advances calculated: ${totalAdvances}`);

        const absenceDeduction = absentDays * dailyRate;

        // Final Calculation
        // Net = Basic + Overtime - (Absence Deduction + Advances + Other Manual Deductions)
        const overtime_rate = (basic_salary / 160) * 1.5;
        const overtime_amount = parseFloat(overtime_hours) * overtime_rate;

        const manual_deductions = parseFloat(deductions);
        const net_salary = basic_salary + overtime_amount - absenceDeduction - totalAdvances - manual_deductions;

        console.log(`Final Calc: Basic=${basic_salary}, OT=${overtime_amount}, Absence=${absenceDeduction}, Advances=${totalAdvances}, ManualDeduct=${manual_deductions}, Net=${net_salary}`);

        // Store in payroll table
        const [result] = await db.execute(
            'INSERT INTO payroll (organization_id, employee_id, month, year, basic_salary, absence_deduction, overtime_amount, total_advances, deductions, net_salary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [req.user.organization_id, employee_id, m, y, basic_salary, absenceDeduction, overtime_amount, totalAdvances, manual_deductions, net_salary]
        );

        res.json({
            id: result.insertId,
            net_salary,
            breakdown: {
                basic_salary,
                absentDays,
                absenceDeduction,
                totalAdvances,
                overtime_amount,
                manualDeductions: manual_deductions
            },
            message: 'Payroll calculated successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getPayrollHistory = async (req, res) => {
    const orgId = req.user.organization_id;
    const { month, year } = req.query;
    try {
        let query = `SELECT p.*, e.full_name 
                     FROM payroll p 
                     JOIN employees e ON p.employee_id = e.id
                     WHERE ${orgId ? 'p.organization_id = ?' : 'p.organization_id IS NULL'}`;
        let params = orgId ? [orgId] : [];

        if (month && year) {
            query += ` AND p.month = ? AND p.year = ?`;
            params = orgId ? [orgId, month, year] : [month, year];
        }

        query += ` ORDER BY p.generated_at DESC`;

        const [rows] = await db.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.generatePayslip = async (req, res) => {
    const { id } = req.params;
    const orgId = req.user.organization_id;
    try {
        const [rows] = await db.execute(
            `SELECT p.*, e.full_name, e.designation, e.department, 
                    o.org_name, o.address as org_address, o.phone as org_phone, o.email as org_email
             FROM payroll p 
             JOIN employees e ON p.employee_id = e.id 
             LEFT JOIN organizations o ON p.organization_id = o.id
             WHERE p.id = ? AND ${orgId ? 'p.organization_id = ?' : 'p.organization_id IS NULL'}`,
            orgId ? [id, orgId] : [id]
        );

        if (rows.length === 0) return res.status(404).json({ message: 'Payroll record not found' });

        const data = rows[0];
        const doc = new PDFDocument({ margin: 50 });
        let filename = `payslip_${data.id}.pdf`;

        res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
        res.setHeader('Content-type', 'application/pdf');

        // --- Header ---
        doc.fontSize(20).fillColor('#444444').text(data.org_name || 'HR System', { align: 'center', bold: true });
        doc.fontSize(10).fillColor('#777777').text(data.org_address || '', { align: 'center' });
        doc.text(`Phone: ${data.org_phone || ''} | Email: ${data.org_email || ''}`, { align: 'center' });
        doc.moveDown();
        doc.strokeColor('#dddddd').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();

        doc.fontSize(16).fillColor('#333333').text('Salary Payslip', { align: 'center', underline: true });
        doc.fontSize(10).text(`Statement for the month of: ${new Date(data.year, data.month - 1).toLocaleString('default', { month: 'long' })} ${data.year}`, { align: 'center' });
        doc.moveDown(2);

        // --- Employee Details Section ---
        const startY = doc.y;
        doc.fontSize(11).fillColor('#000000').text(`Employee Name:`, 50, startY, { bold: true });
        doc.text(data.full_name, 150, startY);

        doc.text(`Employee ID:`, 350, startY, { bold: true });
        doc.text(`#${data.employee_id}`, 450, startY);

        doc.moveDown(0.5);
        const nextY = doc.y;
        doc.text(`Designation:`, 50, nextY, { bold: true });
        doc.text(data.designation || 'N/A', 150, nextY);

        doc.text(`Department:`, 350, nextY, { bold: true });
        doc.text(data.department || 'N/A', 450, nextY);

        doc.moveDown(2);

        // --- Earnings & Deductions Table ---
        const tableTop = doc.y;
        doc.fontSize(12).fillColor('#00674f').text('Earnings', 50, tableTop, { bold: true });
        doc.text('Amount', 250, tableTop, { bold: true });

        doc.fillColor('#cc0000').text('Deductions', 350, tableTop, { bold: true });
        doc.text('Amount', 500, tableTop, { bold: true });

        doc.moveDown(0.5);
        doc.strokeColor('#cccccc').lineWidth(0.5).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);

        const rowY = doc.y;
        doc.fontSize(10).fillColor('#333333');
        // Earnings
        doc.text('Basic Salary', 50, rowY);
        doc.text(`${data.basic_salary}`, 250, rowY);

        // Deductions
        doc.text('Absence Deduct', 350, rowY);
        doc.text(`${data.absence_deduction}`, 500, rowY);

        doc.moveDown();
        const rowY2 = doc.y;
        doc.text('Overtime', 50, rowY2);
        doc.text(`${data.overtime_amount}`, 250, rowY2);

        doc.text('Advances', 350, rowY2);
        doc.text(`${data.total_advances}`, 500, rowY2);

        doc.moveDown();
        const rowY3 = doc.y;
        doc.text('Other Deduct', 350, rowY3);
        doc.text(`${data.deductions}`, 500, rowY3);

        doc.moveDown(2);

        // --- Totals ---
        doc.strokeColor('#dddddd').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);

        const totalY = doc.y;
        const totalEarnings = parseFloat(data.basic_salary) + parseFloat(data.overtime_amount);
        const totalDeductions = parseFloat(data.absence_deduction) + parseFloat(data.total_advances) + parseFloat(data.deductions);

        doc.fontSize(10).text(`Total Earnings:`, 50, totalY, { bold: true });
        doc.text(`${totalEarnings.toFixed(2)}`, 250, totalY);

        doc.text(`Total Deductions:`, 350, totalY, { bold: true });
        doc.text(`${totalDeductions.toFixed(2)}`, 500, totalY);

        doc.moveDown(2);

        // --- Net Salary Highlight ---
        doc.rect(50, doc.y, 500, 30).fill('#f1f1f1');
        doc.fillColor('#00674f').fontSize(14).text(`NET SALARY: `, 60, doc.y + 8, { continued: true, bold: true });
        doc.text(`${data.net_salary}`, { bold: true });

        doc.moveDown(4);

        // --- Footer / Signature ---
        const footerY = doc.y;
        doc.fontSize(10).fillColor('#333333').text('__________________________', 50, footerY);
        doc.text('Employer Signature', 65, footerY + 15);

        doc.text('__________________________', 350, footerY);
        doc.text('Employee Signature', 365, footerY + 15);

        doc.moveDown(4);
        doc.fontSize(8).fillColor('#999999').text('This is a computer-generated document and does not require a physical stamp.', { align: 'center' });

        doc.pipe(res);
        doc.end();
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.exportPayrollToExcel = async (req, res) => {
    const orgId = req.user.organization_id;
    try {
        const [rows] = await db.execute(
            `SELECT p.*, e.full_name 
             FROM payroll p 
             JOIN employees e ON p.employee_id = e.id
             WHERE ${orgId ? 'p.organization_id = ?' : 'p.organization_id IS NULL'}`,
            orgId ? [orgId] : []
        );

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Payroll Report');

        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Employee', key: 'full_name', width: 30 },
            { header: 'Month', key: 'month', width: 10 },
            { header: 'Year', key: 'year', width: 10 },
            { header: 'Net Salary', key: 'net_salary', width: 15 },
        ];

        rows.forEach(row => worksheet.addRow(row));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + 'payroll_report.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.deletePayroll = async (req, res) => {
    const { id } = req.params;
    const orgId = req.user.organization_id;
    try {
        const [result] = await db.execute(
            `DELETE FROM payroll WHERE id = ? AND ${orgId ? 'organization_id = ?' : 'organization_id IS NULL'}`,
            orgId ? [id, orgId] : [id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Payroll record not found' });
        res.json({ message: 'Payroll record deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
