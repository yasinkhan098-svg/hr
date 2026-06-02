const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.login = async (req, res) => {
    const { username, password } = req.body;

    try {
        const [rows] = await db.execute(
            `SELECT a.*, o.org_name 
             FROM admins a 
             LEFT JOIN organizations o ON a.organization_id = o.id 
             WHERE a.username = ?`,
            [username]
        );
        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const admin = rows[0];
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: admin.id, username: admin.username, organization_id: admin.organization_id, org_name: admin.org_name },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            token,
            admin: {
                id: admin.id,
                username: admin.username,
                organization_id: admin.organization_id,
                org_name: admin.org_name
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.register = async (req, res) => {
    const {
        full_name,
        email,
        phone,
        org_name,
        address,
        username,
        password
    } = req.body;

    // 1. Mandatory Field Validation
    if (!full_name || !email || !phone || !org_name || !address || !username || !password) {
        return res.status(400).json({ message: 'All fields are mandatory!' });
    }

    // 2. Email Format Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format!' });
    }

    // 3. Phone Number Validation
    const phoneRegex = /^\d{10,12}$/;
    if (!phoneRegex.test(phone)) {
        return res.status(400).json({ message: 'Invalid phone number (10-12 digits required)!' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Check if username or email already exists
        const [existing] = await connection.execute(
            'SELECT * FROM admins WHERE username = ? OR email = ?',
            [username, email]
        );
        if (existing.length > 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Username or Email already exists' });
        }

        // 2. Insert Organization
        const [orgResult] = await connection.execute(
            'INSERT INTO organizations (org_name, owner_name, email, phone, address) VALUES (?, ?, ?, ?, ?)',
            [org_name, full_name, email, phone, address]
        );
        const orgId = orgResult.insertId;

        // 3. Insert Admin/User
        const hashedPassword = await bcrypt.hash(password, 10);
        await connection.execute(
            'INSERT INTO admins (organization_id, full_name, email, phone, username, password) VALUES (?, ?, ?, ?, ?, ?)',
            [orgId, full_name, email, phone, username, hashedPassword]
        );

        await connection.commit();
        res.status(201).json({ message: 'Organization and User registered successfully' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ message: 'Server error during registration' });
    } finally {
        connection.release();
    }
};
