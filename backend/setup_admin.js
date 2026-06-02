const db = require('./config/db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const username = 'admin';
const password = 'admin123';

const setupAdmin = async () => {
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.execute('INSERT INTO admins (username, password) VALUES (?, ?)', [username, hashedPassword]);
        console.log(`Admin user '${username}' created successfully with password '${password}'.`);
        process.exit(0);
    } catch (error) {
        if (
            error.code === 'ER_DUP_ENTRY' || 
            error.code === 'SQLITE_CONSTRAINT' || 
            (error.message && error.message.includes('UNIQUE'))
        ) {
            console.log('Admin user already exists.');
            process.exit(0);
        } else {
            console.error('Error creating admin user:', error);
            process.exit(1);
        }
    }
};

setupAdmin();
