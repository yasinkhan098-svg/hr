const db = require('./config/db');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function resetDatabase() {
    try {
        console.log('----------------------------------------------------');
        console.log('⚠️  Resetting Database (Dropping and Recreating)...');
        console.log('----------------------------------------------------');

        // 1. Drop existing tables in correct order of dependency
        const dropQueries = [
            'DROP TABLE IF EXISTS payroll',
            'DROP TABLE IF EXISTS attendance',
            'DROP TABLE IF EXISTS employees',
            'DROP TABLE IF EXISTS admins',
            'DROP TABLE IF EXISTS organizations'
        ];

        for (const drop of dropQueries) {
            console.log(`🧹 Dropping: ${drop.split(' ').pop()}...`);
            await db.execute(drop);
        }

        // 2. Read and run the new sqlite_schema.sql
        const schemaPath = path.join(__dirname, '..', 'database', 'sqlite_schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        const statements = schemaSql
            .split(/;(?:\r?\n|$)/)
            .map(stmt => {
                return stmt
                    .split('\n')
                    .filter(line => !line.trim().startsWith('--'))
                    .join('\n')
                    .trim();
            })
            .filter(stmt => stmt.length > 0);

        console.log(`📂 Read ${statements.length} SQL statements from schema.`);

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            const firstLine = statement.split('\n')[0].trim();
            console.log(`⏳ Executing statement ${i + 1}/${statements.length}: "${firstLine}..."`);
            await db.execute(statement);
        }

        // 3. Re-seed default admin user
        const username = 'admin';
        const password = 'admin123';
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.execute('INSERT INTO admins (username, password) VALUES (?, ?)', [username, hashedPassword]);
        console.log(`👤 Seeded admin user '${username}' successfully.`);

        console.log('----------------------------------------------------');
        console.log('🎉 Database has been reset and seeded successfully!');
        console.log('----------------------------------------------------');
        process.exit(0);
    } catch (error) {
        console.error('----------------------------------------------------');
        console.error('❌ Database reset failed!');
        console.error(error.message);
        console.error('----------------------------------------------------');
        process.exit(1);
    }
}

resetDatabase();
