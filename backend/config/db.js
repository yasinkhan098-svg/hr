const { createClient } = require('@libsql/client');
require('dotenv').config();

const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

console.log(`Connecting database to: ${url}`);
const client = createClient({ url, authToken });

// Helper to convert rows to plain JS objects and handle BigInt
function mapRows(result) {
    if (!result || !result.rows) return [];
    return result.rows.map(row => {
        const obj = {};
        result.columns.forEach((col, idx) => {
            let val = row[idx];
            if (typeof val === 'bigint') {
                val = Number(val);
            }
            obj[col] = val;
        });
        return obj;
    });
}

const wrapperExecute = async (sql, params = []) => {
    const result = await client.execute({ sql, args: params });
    const rows = mapRows(result);
    
    // Attach compatibility fields for INSERT/UPDATE/DELETE
    rows.insertId = result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : undefined;
    rows.affectedRows = result.rowsAffected;
    
    const resultHeader = {
        insertId: rows.insertId,
        affectedRows: rows.affectedRows
    };
    return [rows, resultHeader];
};

module.exports = {
    execute: wrapperExecute,
    query: wrapperExecute,
    getConnection: async () => {
        const transaction = await client.transaction();
        return {
            execute: async (sql, params = []) => {
                const result = await transaction.execute({ sql, args: params });
                const rows = mapRows(result);
                rows.insertId = result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : undefined;
                rows.affectedRows = result.rowsAffected;
                
                const resultHeader = {
                    insertId: rows.insertId,
                    affectedRows: rows.affectedRows
                };
                return [rows, resultHeader];
            },
            beginTransaction: async () => {
                // already started
            },
            commit: async () => {
                await transaction.commit();
            },
            rollback: async () => {
                await transaction.rollback();
            },
            release: () => {
                // no-op
            }
        };
    }
};
