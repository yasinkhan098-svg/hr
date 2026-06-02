USE attendance_payroll;

-- Create Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_name VARCHAR(100) NOT NULL,
    owner_name VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Update Admins Table to include organization_id and more fields
-- We might want to rename this to 'users' eventually, but for now let's add the link
ALTER TABLE admins ADD COLUMN organization_id INT AFTER id;
ALTER TABLE admins ADD COLUMN full_name VARCHAR(100) AFTER organization_id;
ALTER TABLE admins ADD COLUMN email VARCHAR(100) AFTER full_name;
ALTER TABLE admins ADD COLUMN phone VARCHAR(20) AFTER email;

-- Add organization_id to Employees
ALTER TABLE employees ADD COLUMN organization_id INT AFTER id;
ALTER TABLE employees ADD INDEX (organization_id);

-- Add organization_id to Attendance
ALTER TABLE attendance ADD COLUMN organization_id INT AFTER id;
ALTER TABLE attendance ADD INDEX (organization_id);

-- Add organization_id to Payroll
ALTER TABLE payroll ADD COLUMN organization_id INT AFTER id;
ALTER TABLE payroll ADD INDEX (organization_id);

-- Note: We should ideally add Foreign Key constraints, but for a quick migration 
-- we'll just add the columns and indices first.
