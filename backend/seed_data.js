const pool = require('./config/db');

async function seedData() {
    try {
        console.log('Seeding dummy employees...');
        const employees = [
            ['Rahul Sharma', 'rahul@example.com', 'IT', 'Developer', 50000, '2023-01-15'],
            ['Priya Verma', 'priya@example.com', 'HR', 'Manager', 60000, '2023-02-10'],
            ['Amit Patel', 'amit@example.com', 'Finance', 'Accountant', 45000, '2023-03-05']
        ];

        for (const emp of employees) {
            await pool.execute(
                'INSERT INTO employees (full_name, email, department, designation, basic_salary, joining_date) VALUES (?, ?, ?, ?, ?, ?)',
                emp
            );
        }
        console.log('3 Employees seeded.');

        const [empRows] = await pool.execute('SELECT id FROM employees');
        const today = new Date().toISOString().split('T')[0];

        console.log('Marking attendance for today...');
        for (const emp of empRows) {
            await pool.execute(
                'INSERT INTO attendance (employee_id, date, status) VALUES (?, ?, ?)',
                [emp.id, today, 'Present']
            );
        }
        console.log('Attendance marked for all seeded employees.');

        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error.message);
        process.exit(1);
    }
}

seedData();
