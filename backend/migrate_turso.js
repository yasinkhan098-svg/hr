const db = require('./config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        console.log('----------------------------------------------------');
        console.log('🏁 Starting Turso/SQLite Database Migration...');
        console.log('----------------------------------------------------');

        const schemaPath = path.join(__dirname, '..', 'database', 'sqlite_schema.sql');
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Schema file not found at: ${schemaPath}`);
        }

        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // Split schema by semicolon to get individual commands and strip -- comments
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
            try {
                await db.execute(statement);
            } catch (err) {
                console.error(`❌ Error executing statement ${i + 1}:`);
                console.error(statement);
                throw err;
            }
        }

        console.log('----------------------------------------------------');
        console.log('🎉 Database migration completed successfully!');
        console.log('----------------------------------------------------');
        process.exit(0);
    } catch (error) {
        console.error('----------------------------------------------------');
        console.error('❌ Database migration failed!');
        console.error(error.message);
        console.error('----------------------------------------------------');
        process.exit(1);
    }
}

runMigration();
