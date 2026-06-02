const pool = require('./config/db');

async function testConnection() {
    try {
        const [rows] = await pool.execute('SELECT 1 + 1 AS result');
        console.log('Database connected successfully!');

        const [dbCheck] = await pool.execute("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = 'attendance_payroll'");
        if (dbCheck.length > 0) {
            console.log("Database 'attendance_payroll' exists.");
            const [tableCheck] = await pool.execute("SHOW TABLES");
            console.log("Tables in database:", tableCheck.map(t => Object.values(t)[0]));
        } else {
            console.log("Database 'attendance_payroll' DOES NOT exist.");
        }

        process.exit(0);
    } catch (error) {
        console.error('Database connection failed:', error.message);
        process.exit(1);
    }
}

testConnection();
