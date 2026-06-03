const db = require('../config/db');

exports.getAllEmployees = async (req, res) => {
    const orgId = req.user.organization_id;
    try {
        const [rows] = await db.execute(
            `SELECT * FROM employees WHERE ${orgId ? 'organization_id = ?' : 'organization_id IS NULL'} ORDER BY created_at DESC`,
            orgId ? [orgId] : []
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getEmployeeById = async (req, res) => {
    const orgId = req.user.organization_id;
    try {
        const [rows] = await db.execute(
            `SELECT * FROM employees WHERE id = ? AND ${orgId ? 'organization_id = ?' : 'organization_id IS NULL'}`,
            orgId ? [req.params.id, orgId] : [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Employee not found' });
        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.addEmployee = async (req, res) => {
    const { full_name, email, phone = null, department = null, designation = null, basic_salary, joining_date, employee_type = 'company_employee' } = req.body;
    const emailVal = email && email.trim() !== '' ? email.trim() : null;
    try {
        const [result] = await db.execute(
            'INSERT INTO employees (organization_id, full_name, email, phone, department, designation, basic_salary, joining_date, employee_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [req.user.organization_id, full_name, emailVal, phone, department, designation, basic_salary, joining_date, employee_type]
        );
        res.status(201).json({ id: result.insertId, message: 'Employee added successfully' });
    } catch (error) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY' || error.code === 'SQLITE_CONSTRAINT' || (error.message && error.message.includes('UNIQUE'))) {
            return res.status(400).json({ message: 'An employee with this email address already exists!' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

exports.updateEmployee = async (req, res) => {
    const { full_name, email, phone = null, department = null, designation = null, basic_salary, joining_date, employee_type = 'company_employee' } = req.body;
    const emailVal = email && email.trim() !== '' ? email.trim() : null;
    const orgId = req.user.organization_id;
    try {
        const [result] = await db.execute(
            `UPDATE employees SET full_name=?, email=?, phone=?, department=?, designation=?, basic_salary=?, joining_date=?, employee_type=? 
             WHERE id=? AND ${orgId ? 'organization_id=?' : 'organization_id IS NULL'}`,
            orgId ? [full_name, emailVal, phone, department, designation, basic_salary, joining_date, employee_type, req.params.id, orgId] : [full_name, emailVal, phone, department, designation, basic_salary, joining_date, employee_type, req.params.id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Employee not found' });

        // Recalculate payroll BEFORE sending response — frontend gets fresh data immediately
        try {
            const { recalculatePayrollForEmployee } = require('./payrollController');
            const [payrollRecords] = await db.execute(
                `SELECT DISTINCT month, year FROM payroll 
                 WHERE employee_id = ? AND ${orgId ? 'organization_id = ?' : 'organization_id IS NULL'}`,
                orgId ? [req.params.id, orgId] : [req.params.id]
            );
            if (payrollRecords.length > 0) {
                // All months recalculate in parallel — fast even on remote DB
                await Promise.all(
                    payrollRecords.map(p =>
                        recalculatePayrollForEmployee(req.params.id, p.month, p.year, orgId)
                    )
                );
                console.log(`[Auto-Recalc] Done: emp=${req.params.id}, ${payrollRecords.length} month(s) updated.`);
            }
        } catch (recalcErr) {
            // Recalc failure should not block the employee save response
            console.error('[Auto-Recalc] Error:', recalcErr);
        }

        // Send response only after recalculation is fully complete
        res.json({ message: 'Employee updated successfully' });
    } catch (error) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY' || error.code === 'SQLITE_CONSTRAINT' || (error.message && error.message.includes('UNIQUE'))) {
            return res.status(400).json({ message: 'An employee with this email address already exists!' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

exports.deleteEmployee = async (req, res) => {
    const orgId = req.user.organization_id;
    try {
        const [result] = await db.execute(
            `DELETE FROM employees WHERE id = ? AND ${orgId ? 'organization_id = ?' : 'organization_id IS NULL'}`,
            orgId ? [req.params.id, orgId] : [req.params.id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Employee not found' });
        res.json({ message: 'Employee deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
