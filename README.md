# Attendance and Payroll Management System

A professional web application built with Node.js, Express, MySQL, and Vanilla JavaScript.

## 🚀 Features
- **Admin Dashboard**: Statistics and navigation.
- **Admin Authentication**: Secure login with JWT and Bcrypt.
- **Employee Management**: Full CRUD operations.
- **Attendance Management**: Daily marking and history.
- **Payroll Management**: Automatic net salary calculation.
- **Reports**: Download payslips (PDF) and Payroll reports (Excel).

## 🛠️ Setup Instructions

### 1. Database Setup
1. Open your MySQL client (e.g., MySQL Workbench, phpMyAdmin).
2. Execute the SQL script found in `database/schema.sql`.

### 2. Backend Setup
1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Create/Update the `.env` file with your database credentials:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=attendance_payroll
   JWT_SECRET=your_secret_key
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create the initial admin user:
   ```bash
   node setup_admin.js
   ```
5. Start the server:
   ```bash
   npm run dev
   ```

### 3. Frontend Setup
1. Open `frontend/index.html` in your browser.
   > **Note**: For production, serve the `frontend` folder using a static file server (like `serve -s frontend` or via an Express static route). For the demo, ensure the backend is running at `http://localhost:5000`.

## 🧪 Default Login
- **Username**: `admin`
- **Password**: `admin123`
