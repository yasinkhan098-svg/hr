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
    const { full_name, email, phone = null, department = null, designation = null, basic_salary, joining_date } = req.body;
    try {
        const [result] = await db.execute(
            'INSERT INTO employees (organization_id, full_name, email, phone, department, designation, basic_salary, joining_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [req.user.organization_id, full_name, email, phone, department, designation, basic_salary, joining_date]
        );
        res.status(201).json({ id: result.insertId, message: 'Employee added successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.updateEmployee = async (req, res) => {
    const { full_name, email, phone = null, department = null, designation = null, basic_salary, joining_date } = req.body;
    const orgId = req.user.organization_id;
    try {
        const [result] = await db.execute(
            `UPDATE employees SET full_name=?, email=?, phone=?, department=?, designation=?, basic_salary=?, joining_date=? 
             WHERE id=? AND ${orgId ? 'organization_id=?' : 'organization_id IS NULL'}`,
            orgId ? [full_name, email, phone, department, designation, basic_salary, joining_date, req.params.id, orgId] : [full_name, email, phone, department, designation, basic_salary, joining_date, req.params.id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Employee not found' });
        res.json({ message: 'Employee updated successfully' });
    } catch (error) {
        console.error(error);
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
