const pool = require('./config/db');
const fs = require('fs');
const path = require('path');

async function initSchema() {
    try {
        console.log('Reading schema.sql...');
        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
        const sql = fs.readFileSync(schemaPath, 'utf8');

        // Split by semicolon, but be careful with multiline
        const statements = sql
            .split(';')
            .filter(stmt => stmt.trim() !== '')
            .map(stmt => stmt.trim());

        console.log(`Executing ${statements.length} SQL statements...`);
        for (const statement of statements) {
            await pool.query(statement);
        }

        console.log('Database schema initialized successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Initialization failed:', error.message);
        process.exit(1);
    }
}

initSchema();
