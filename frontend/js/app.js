const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:5000/api' 
    : '/api';

const state = {
    token: sessionStorage.getItem('token'),
    admin: JSON.parse(sessionStorage.getItem('admin')),
    currency: localStorage.getItem('currency') || '₹',
    currentView: 'dashboard'
};

const app = document.getElementById('app');

const init = () => {
    // Re-check storage in case state was initialized too early
    state.token = sessionStorage.getItem('token');
    state.admin = JSON.parse(sessionStorage.getItem('admin'));

    if (!state.token) {
        renderWelcome();
    } else {
        renderDashboardLayout();
        navigateTo('dashboard');
    }
};

const renderWelcome = () => {
    app.innerHTML = `
        <div class="auth-container">
            <div class="welcome-card">
                <h2>Attendance & Payroll</h2>
                <div class="btn-group">
                    <button class="btn" onclick="renderLogin()">Sign In</button>
                    <button class="btn btn-secondary" onclick="renderRegister()">Sign Up / Create Account</button>
                </div>
                <p style="margin-top: 2rem; color: #666; font-size: 0.9rem; text-align: center;">
                    Select an option above to manage your organization's attendance and payroll.
                </p>
            </div>
        </div>
    `;
};

const renderRegister = () => {
    app.innerHTML = `
        <div class="auth-container" style="padding-top: 2rem; padding-bottom: 2rem; height: auto; min-height: 100vh;">
            <div class="register-card">
                <h2>Create Your Organization</h2>
                <div class="register-grid">
                    <div class="form-group">
                        <label>Owner Full Name *</label>
                        <input type="text" id="reg-name" placeholder="Enter your name">
                    </div>
                    <div class="form-group">
                        <label>Email Address *</label>
                        <input type="email" id="reg-email" placeholder="Enter email">
                    </div>
                    <div class="form-group">
                        <label>Organization Name *</label>
                        <input type="text" id="reg-org" placeholder="Company Name">
                    </div>
                    <div class="form-group">
                        <label>Phone Number *</label>
                        <input type="text" id="reg-phone" placeholder="Mobile Number">
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
                        <label>Address *</label>
                        <input type="text" id="reg-address" placeholder="Organization Address">
                    </div>
                    <div class="form-group">
                        <label>Username *</label>
                        <input type="text" id="reg-username" placeholder="Choose a username">
                    </div>
                    <div class="form-group">
                        <label>Password *</label>
                        <input type="password" id="reg-password" placeholder="Create password">
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
                        <label>Confirm Password *</label>
                        <input type="password" id="reg-confirm" placeholder="Confirm password">
                    </div>
                </div>
                <button class="btn" onclick="handleRegister()" style="margin-top: 1rem;">Register Now</button>
                <div style="text-align: center; margin-top: 1.5rem;">
                    Already have an account? <a href="#" onclick="renderLogin()" style="color: var(--primary-color);">Sign In</a>
                </div>
                <p id="reg-error" style="color: red; margin-top: 1rem; text-align: center;"></p>
            </div>
        </div>
    `;
};

const navigateTo = (view) => {
    state.currentView = view;
    renderView();
    updateActiveLink();
};

const updateActiveLink = () => {
    const links = document.querySelectorAll('.nav-links li');
    links.forEach(li => {
        const linkView = li.getAttribute('data-view');
        if (linkView === state.currentView) {
            li.classList.add('active');
        } else {
            li.classList.remove('active');
        }
    });
};

const renderLogin = () => {
    app.innerHTML = `
        <div class="auth-container">
            <div class="login-card">
                <h2>Sign In</h2>
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" id="username" placeholder="Enter your username">
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="password" placeholder="Enter your password">
                </div>
                <button class="btn" onclick="handleLogin()">Login</button>
                <div style="text-align: center; margin-top: 1.5rem;">
                    Don't have an account? <a href="#" onclick="renderRegister()" style="color: var(--primary-color);">Sign Up</a>
                    <br><br>
                    <a href="#" onclick="renderWelcome()" style="color: #666; font-size: 0.9rem;">Back to Main</a>
                </div>
                <p id="error-msg" style="color: red; margin-top: 1rem; text-align: center;"></p>
            </div>
        </div>
    `;
};

const handleLogin = async () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('error-msg');

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (response.ok) {
            sessionStorage.setItem('token', data.token);
            sessionStorage.setItem('admin', JSON.stringify(data.admin));
            state.token = data.token;
            state.admin = data.admin;
            renderDashboardLayout();
            navigateTo('dashboard');
        } else {
            errorMsg.innerText = data.message || 'Login failed';
        }
    } catch (error) {
        errorMsg.innerText = 'Server error. Make sure backend is running.';
    }
};

const handleRegister = async () => {
    const full_name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const org_name = document.getElementById('reg-org').value;
    const phone = document.getElementById('reg-phone').value;
    const address = document.getElementById('reg-address').value;
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    const errorMsg = document.getElementById('reg-error');

    // 1. Mandatory Field Check
    if (!full_name || !email || !org_name || !phone || !address || !username || !password || !confirm) {
        errorMsg.innerText = 'All fields are mandatory!';
        return;
    }

    // 2. Email Format Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errorMsg.innerText = 'Please enter a valid email address!';
        return;
    }

    // 3. Phone Number Validation (Simple 10-digit check)
    const phoneRegex = /^\d{10,12}$/;
    if (!phoneRegex.test(phone)) {
        errorMsg.innerText = 'Please enter a valid phone number (10-12 digits)!';
        return;
    }

    // 4. Password Confirmation
    if (password !== confirm) {
        errorMsg.innerText = 'Passwords do not match!';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name, email, phone, org_name, address, username, password })
        });

        const data = await response.json();
        if (response.ok) {
            alert('Registration successful! Please login.');
            renderLogin();
        } else {
            errorMsg.innerText = data.message || 'Registration failed';
        }
    } catch (error) {
        errorMsg.innerText = 'Server error. Please try again.';
    }
};

const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('admin');
    state.token = null;
    state.admin = null;
    renderWelcome();
};

const renderDashboardLayout = () => {
    app.innerHTML = `
        <div class="dashboard-wrapper">
            <aside class="sidebar">
                <div class="sidebar-header">
                    <h2 style="font-size: 1.2rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 10px;">
                        ${state.admin ? state.admin.org_name : 'HR System'}
                    </h2>
                    <p style="font-size: 0.8rem; color: rgba(255,255,255,0.6); margin-top: 5px;">
                        Welcome, ${state.admin ? state.admin.username : 'Admin'}
                    </p>
                </div>
                <ul class="nav-links">
                    <li data-view="dashboard" onclick="navigateTo('dashboard')"><a href="#"><span>Dashboard</span></a></li>
                    <li data-view="employees" onclick="navigateTo('employees')"><a href="#"><span>Employees</span></a></li>
                    <li data-view="attendance" onclick="navigateTo('attendance')"><a href="#"><span>Attendance</span></a></li>
                    <li data-view="payroll" onclick="navigateTo('payroll')"><a href="#"><span>Payroll</span></a></li>
                    <li data-view="reports" onclick="navigateTo('reports')"><a href="#"><span>Reports</span></a></li>
                    <li data-view="settings" onclick="navigateTo('settings')"><a href="#"><span>Settings</span></a></li>
                    <li onclick="handleLogout()"><a href="#"><span>Logout</span></a></li>
                </ul>
            </aside>
            <main class="main-content" id="main-content-area">
                <!-- Content will be injected here -->
            </main>
        </div>
    `;
};

const renderView = async () => {
    const contentArea = document.getElementById('main-content-area');
    if (!contentArea) return;

    switch (state.currentView) {
        case 'dashboard':
            renderDashboard(contentArea);
            break;
        case 'employees':
            renderEmployees(contentArea);
            break;
        case 'attendance':
            renderAttendance(contentArea);
            break;
        case 'payroll':
            renderPayroll(contentArea);
            break;
        case 'reports':
            renderReports(contentArea);
            break;
        case 'settings':
            renderSettings(contentArea);
            break;
    }
};

const renderDashboard = async (container) => {
    container.innerHTML = `
        <h1>Dashboard</h1>
        <div class="stats-grid">
            <div class="stat-card"><h3>Total Employees</h3><div class="value" id="total-employees">0</div></div>
            <div class="stat-card"><h3>Present Today</h3><div class="value" id="present-today">0</div></div>
            <div class="stat-card"><h3>Absent Today</h3><div class="value" id="absent-today">0</div></div>
            <div class="stat-card"><h3>Monthly Expense</h3><div class="value" id="monthly-expense">${state.currency}0</div></div>
        </div>
    `;
    try {
        const resp = await fetch(`${API_BASE_URL}/employees`, { headers: { 'Authorization': `Bearer ${state.token}` } });
        const employees = await resp.json();
        document.getElementById('total-employees').innerText = employees.length;

        const attnResp = await fetch(`${API_BASE_URL}/attendance/today`, { headers: { 'Authorization': `Bearer ${state.token}` } });
        const attendance = await attnResp.json();
        const present = attendance.filter(a => a.status === 'Present').length;
        document.getElementById('present-today').innerText = present;
        document.getElementById('absent-today').innerText = employees.length - present;

        // Calculate total monthly expense (net salary sum for current month)
        const payResp = await fetch(`${API_BASE_URL}/payroll/history`, { headers: { 'Authorization': `Bearer ${state.token}` } });
        const history = await payResp.json();
        const totalExpense = history.reduce((sum, p) => sum + parseFloat(p.net_salary), 0);
        document.getElementById('monthly-expense').innerText = `${state.currency}${totalExpense.toFixed(2)}`;

    } catch (e) {
        console.error("Dashboard stats error", e);
    }
};

// Employee Management
const renderEmployees = async (container) => {
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <h1 class="no-print">Employee Management</h1>
            <h1 class="print-only" style="display: none; text-align: center; width: 100%;">HR SYSTEM - Employee List</h1>
            <div style="display: flex; gap: 0.5rem;" class="no-print">
                <button class="btn" style="width: auto; padding: 0.5rem 1.5rem;" onclick="showEmployeeModal()">Add Employee</button>
                <button class="btn" style="width: auto; padding: 0.5rem 1.5rem; background: #6c757d;" onclick="window.print()">Print List</button>
            </div>
        </div>
        <div class="content-card">
            <table id="employee-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Department</th>
                        <th>Salary</th>
                        <th class="no-print">Actions</th>
                    </tr>
                </thead>
                <tbody id="employee-table-body">
                    <tr><td colspan="5" style="text-align:center;">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;
    fetchEmployees();
};

const fetchEmployees = async () => {
    const response = await fetch(`${API_BASE_URL}/employees`, {
        headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const employees = await response.json();
    const tbody = document.getElementById('employee-table-body');
    if (tbody) {
        tbody.innerHTML = employees.map(emp => `
            <tr>
                <td>${emp.full_name}</td>
                <td>${emp.email}</td>
                <td>${emp.phone || '-'}</td>
                <td>${emp.department || '-'}</td>
                <td>${state.currency}${emp.basic_salary}</td>
                <td style="white-space: nowrap;" class="no-print">
                    <button class="btn" style="width: auto; padding: 2px 8px; font-size: 0.8rem;" onclick="showEmployeeModal(${JSON.stringify(emp).replace(/"/g, '&quot;')})">Edit</button>
                    <button class="btn" style="width: auto; padding: 2px 8px; font-size: 0.8rem; background: var(--danger);" onclick="deleteEmployee(${emp.id})">Del</button>
                </td>
            </tr>
        `).join('');
    }
};

const showEmployeeModal = (emp = null) => {
    const modal = document.createElement('div');
    modal.id = "employee-modal";
    modal.style = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000;";
    modal.innerHTML = `
        <div class="content-card" style="width: 500px;">
            <h2>${emp ? 'Edit' : 'Add'} Employee</h2>
            <input type="hidden" id="emp-id" value="${emp ? emp.id : ''}">
            <div class="form-group"><label>Full Name</label><input type="text" id="emp-name" value="${emp ? emp.full_name : ''}"></div>
            <div class="form-group"><label>Email</label><input type="email" id="emp-email" value="${emp ? emp.email : ''}"></div>
            <div class="form-group"><label>Phone</label><input type="text" id="emp-phone" value="${emp ? emp.phone || '' : ''}"></div>
            <div class="form-group"><label>Department</label><input type="text" id="emp-dept" value="${emp ? emp.department : ''}"></div>
            <div class="form-group"><label>Designation</label><input type="text" id="emp-desig" value="${emp ? emp.designation : ''}"></div>
            <div class="form-group"><label>Basic Salary</label><input type="number" id="emp-salary" value="${emp ? emp.basic_salary : ''}"></div>
            <div class="form-group"><label>Joining Date</label><input type="date" id="emp-joining" value="${emp ? emp.joining_date.split('T')[0] : new Date().toISOString().split('T')[0]}"></div>
            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button class="btn" onclick="saveEmployee()">Save</button>
                <button class="btn" style="background: #777;" onclick="closeModal('employee-modal')">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Auto-capitalize first letter of each word for Name, Department, and Designation
    const autoCapFields = ['emp-name', 'emp-dept', 'emp-desig'];
    autoCapFields.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', (e) => {
                const start = e.target.selectionStart;
                const end = e.target.selectionEnd;
                const capitalized = e.target.value.replace(/\b\w/g, char => char.toUpperCase());
                if (e.target.value !== capitalized) {
                    e.target.value = capitalized;
                    e.target.setSelectionRange(start, end);
                }
            });
        }
    });
};

const saveEmployee = async () => {
    const id = document.getElementById('emp-id').value;
    const data = {
        full_name: document.getElementById('emp-name').value,
        email: document.getElementById('emp-email').value,
        phone: document.getElementById('emp-phone').value,
        department: document.getElementById('emp-dept').value,
        designation: document.getElementById('emp-desig').value,
        basic_salary: document.getElementById('emp-salary').value,
        joining_date: document.getElementById('emp-joining').value
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_BASE_URL}/employees/${id}` : `${API_BASE_URL}/employees`;

    await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
        body: JSON.stringify(data)
    });

    closeModal('employee-modal');
    fetchEmployees();
};

const deleteEmployee = async (id) => {
    if (confirm('Are you sure you want to delete this employee?')) {
        await fetch(`${API_BASE_URL}/employees/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        fetchEmployees();
    }
};

// Helper to get local date in YYYY-MM-DD format (timezone-safe)
const getLocalDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Helper for attendance dropdown styles
const getStatusSelectStyle = (status) => {
    switch (status) {
        case 'Present':
            return 'background-color: #d4edda; color: #155724; border-color: #c3e6cb; font-weight: bold;';
        case 'Absent':
            return 'background-color: #f8d7da; color: #721c24; border-color: #f5c6cb; font-weight: bold;';
        case 'Leave':
            return 'background-color: #fff3cd; color: #856404; border-color: #ffeeba; font-weight: bold;';
        case 'Half':
            return 'background-color: #cce5ff; color: #004085; border-color: #b8daff; font-weight: bold;';
        default:
            return 'background-color: #f8f9fa; color: #6c757d; border-color: #ced4da;';
    }
};

const updateSelectStyle = (el) => {
    const val = el.value;
    el.style.fontWeight = (val && val !== '') ? 'bold' : 'normal';
    if (val === 'Present') {
        el.style.backgroundColor = '#d4edda';
        el.style.color = '#155724';
        el.style.borderColor = '#c3e6cb';
    } else if (val === 'Absent') {
        el.style.backgroundColor = '#f8d7da';
        el.style.color = '#721c24';
        el.style.borderColor = '#f5c6cb';
    } else if (val === 'Leave') {
        el.style.backgroundColor = '#fff3cd';
        el.style.color = '#856404';
        el.style.borderColor = '#ffeeba';
    } else if (val === 'Half') {
        el.style.backgroundColor = '#cce5ff';
        el.style.color = '#004085';
        el.style.borderColor = '#b8daff';
    } else {
        el.style.backgroundColor = '#f8f9fa';
        el.style.color = '#6c757d';
        el.style.borderColor = '#ced4da';
    }
};

// Attendance
const renderAttendance = async (container) => {
    container.innerHTML = `
        <h1>Daily Attendance</h1>
        <div class="content-card">
            <div style="margin-bottom: 1.5rem; display: flex; gap: 1rem; align-items: center;">
                <label>Select Date:</label>
                <input type="date" id="attendance-date" style="padding: 5px; border-radius: 5px;" value="${getLocalDateString()}" onchange="fetchTodayAttendance()">
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Employee Name</th>
                        <th>Status</th>
                        <th>Advance (${state.currency})</th>
                    </tr>
                </thead>
                <tbody id="attendance-table-body">
                    <tr><td colspan="2" style="text-align:center;">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;
    fetchTodayAttendance();
};

const fetchTodayAttendance = async () => {
    const dateInput = document.getElementById('attendance-date');
    if (!dateInput) return;
    const date = dateInput.value;
    const response = await fetch(`${API_BASE_URL}/attendance/today?date=${date}`, {
        headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const attendance = await response.json();
    const tbody = document.getElementById('attendance-table-body');
    if (tbody) {
        tbody.innerHTML = attendance.map(att => {
            const todayStr = getLocalDateString();
            const defaultStatus = date <= todayStr ? 'Absent' : '';
            const statusVal = att.status || defaultStatus;

            return `
            <tr>
                <td>${att.full_name}</td>
                <td>
                    <select id="status-${att.id}" onchange="markAttendance(${att.id}, this.value, document.getElementById('adv-${att.id}').value); updateSelectStyle(this);" style="padding: 5px; border-radius: 5px; border: 1px solid #ddd; ${getStatusSelectStyle(statusVal)} transition: all 0.2s ease;">
                        <option value="" ${statusVal === '' ? 'selected' : ''} style="background-color: #fff; color: #333;">Not Marked</option>
                        <option value="Present" ${statusVal === 'Present' ? 'selected' : ''} style="background-color: #d4edda; color: #155724;">Present</option>
                        <option value="Absent" ${statusVal === 'Absent' ? 'selected' : ''} style="background-color: #f8d7da; color: #721c24;">Absent</option>
                        <option value="Leave" ${statusVal === 'Leave' ? 'selected' : ''} style="background-color: #fff3cd; color: #856404;">Leave</option>
                        <option value="Half" ${statusVal === 'Half' ? 'selected' : ''} style="background-color: #cce5ff; color: #004085;">Half Day</option>
                    </select>
                </td>
                <td>
                    <input type="number" id="adv-${att.id}" value="${parseFloat(att.advance_amount || 0)}" style="width: 80px; padding: 5px; border-radius: 5px; border: 1px solid #ddd;" onchange="markAttendance(${att.id}, document.getElementById('status-${att.id}').value, this.value)" onkeydown="if(event.key === 'Enter') this.blur();">
                </td>
            </tr>
        `;
        }).join('');
    }
};

const markAttendance = async (employee_id, status, advance_amount = 0) => {
    const val = parseFloat(advance_amount) || 0;
    const date = document.getElementById('attendance-date').value;
    await fetch(`${API_BASE_URL}/attendance/mark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
        body: JSON.stringify({ employee_id, date, status, advance_amount: val })
    });
};

// Payroll
const renderPayroll = async (container) => {
    const m = new Date().getMonth() + 1;
    const y = new Date().getFullYear();
    container.innerHTML = `
        <div class="print-only">HR SYSTEM</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;" class="no-print">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <h1 style="margin: 0;">Payroll Management</h1>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <select id="payroll-month" style="padding: 5px; border-radius: 5px; border: 1px solid #ddd;">
                        ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${m == i + 1 ? 'selected' : ''}>${new Date(0, i).toLocaleString('en', { month: 'long' })}</option>`).join('')}
                    </select>
                    <input type="number" id="payroll-year" value="${y}" style="width: 80px; padding: 5px; border-radius: 5px; border: 1px solid #ddd;">
                    <button class="btn" style="width: auto; padding: 5px 15px;" onclick="fetchPayrollHistory(document.getElementById('payroll-month').value, document.getElementById('payroll-year').value)">Filter</button>
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn" style="width: auto; padding: 0.5rem 1.5rem;" onclick="window.print()">Print List</button>
                <button class="btn" style="width: auto; padding: 0.5rem 1.5rem;" onclick="showPayrollModal()">Calculate Salary</button>
            </div>
        </div>
        <div class="content-card">
            <table>
                <thead>
                    <tr>
                        <th>Employee</th>
                        <th>Month/Year</th>
                        <th>Basic Salary</th>
                        <th>Absence</th>
                        <th>Overtime</th>
                        <th>Advances</th>
                        <th>Deduction</th>
                        <th>Net Salary</th>
                        <th>Generated On</th>
                        <th class="no-print">Actions</th>
                    </tr>
                </thead>
                <tbody id="payroll-table-body">
                    <tr><td colspan="8" style="text-align:center;">No records found.</td></tr>
                </tbody>
                <tfoot id="payroll-table-footer"></tfoot>
            </table>
        </div>
    `;
    fetchPayrollHistory(m, y);
};

const fetchPayrollHistory = async (month, year) => {
    let url = `${API_BASE_URL}/payroll/history`;
    if (month && year) url += `?month=${month}&year=${year}`;

    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const payroll = await response.json();
    const tbody = document.getElementById('payroll-table-body');
    if (tbody) {
        let totalBasic = 0;
        let totalAbsence = 0;
        let totalOvertime = 0;
        let totalAdvances = 0;
        let totalDeductions = 0;
        let totalNet = 0;

        tbody.innerHTML = payroll.map(p => {
            const basic = parseFloat(p.basic_salary || 0);
            const absence = parseFloat(p.absence_deduction || 0);
            const overtime = parseFloat(p.overtime_amount || 0);
            const advances = parseFloat(p.total_advances || 0);
            const deductions = parseFloat(p.deductions || 0);
            const net = parseFloat(p.net_salary || 0);
            totalBasic += basic;
            totalAbsence += absence;
            totalOvertime += overtime;
            totalAdvances += advances;
            totalDeductions += deductions;
            totalNet += net;

            return `
                <tr>
                    <td>${p.full_name}</td>
                    <td>${p.month}/${p.year}</td>
                    <td>${state.currency}${p.basic_salary}</td>
                    <td style="color: var(--danger);">${state.currency}${absence.toFixed(2)}</td>
                    <td style="color: var(--primary-color);">${state.currency}${overtime.toFixed(2)}</td>
                    <td>${state.currency}${advances}</td>
                    <td style="color: var(--danger);">${state.currency}${deductions.toFixed(2)}</td>
                    <td style="font-weight: bold; color: var(--primary-color);">${state.currency}${net}</td>
                    <td>${new Date(p.generated_at).toLocaleDateString()}</td>
                    <td style="white-space: nowrap;" class="no-print">
                        <button class="btn" style="width: auto; padding: 2px 8px; font-size: 0.8rem;" onclick="downloadPayslip(${p.id})">Payslip PDF</button>
                        <button class="btn" style="width: auto; padding: 2px 8px; font-size: 0.8rem; background: var(--danger);" onclick="deletePayrollRecord(${p.id}, ${p.month}, ${p.year})">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');

        const tfoot = document.getElementById('payroll-table-footer');
        if (tfoot && payroll.length > 0) {
            tfoot.innerHTML = `
                <tr style="background: #f8f9fa; font-weight: bold; border-top: 2px solid #ddd;">
                    <td colspan="2" style="text-align: right;">Total Monthly:</td>
                    <td>${state.currency}${totalBasic.toFixed(2)}</td>
                    <td>${state.currency}${totalAbsence.toFixed(2)}</td>
                    <td>${state.currency}${totalOvertime.toFixed(2)}</td>
                    <td>${state.currency}${totalAdvances.toFixed(2)}</td>
                    <td>${state.currency}${totalDeductions.toFixed(2)}</td>
                    <td>${state.currency}${totalNet.toFixed(2)}</td>
                    <td colspan="2"></td>
                </tr>
            `;
        } else if (tfoot) {
            tfoot.innerHTML = '';
        }
    }
};

const deletePayrollRecord = async (id, month, year) => {
    if (confirm('Are you sure you want to delete this payroll record?')) {
        await fetch(`${API_BASE_URL}/payroll/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        fetchPayrollHistory(month, year);
    }
};

const showPayrollModal = async () => {
    const resp = await fetch(`${API_BASE_URL}/employees`, { headers: { 'Authorization': `Bearer ${state.token}` } });
    const employees = await resp.json();

    const modal = document.createElement('div');
    modal.id = "payroll-modal";
    modal.style = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000;";
    modal.innerHTML = `
        <div class="content-card" style="width: 450px;">
            <h2>Calculate Payroll</h2>
            <div class="form-group">
                <label>Employee</label>
                <select id="pay-emp-id" style="width: 100%; padding: 0.8rem; border: 1px solid #ddd; border-radius: 5px;">
                    ${employees.map(e => `<option value="${e.id}">${e.full_name} (${state.currency}${e.basic_salary})</option>`).join('')}
                </select>
            </div>
            <div style="display: flex; gap: 1rem;">
                <div class="form-group" style="flex:1;">
                    <label>Month</label>
                    <select id="pay-month" style="width: 100%; padding: 0.8rem; border: 1px solid #ddd; border-radius: 5px;">
                        ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${new Date().getMonth() === i ? 'selected' : ''}>${new Date(0, i).toLocaleString('en', { month: 'long' })}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="flex:1;"><label>Year</label><input type="number" id="pay-year" value="${new Date().getFullYear()}" style="width: 100%; padding: 0.8rem; border: 1px solid #ddd; border-radius: 5px;"></div>
            </div>
            <div class="form-group"><label>Overtime Hours</label><input type="number" id="pay-ot" value="0"></div>
            <div class="form-group"><label>Deductions (${state.currency})</label><input type="number" id="pay-deduct" value="0"></div>
            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button class="btn" onclick="handleCalculatePayroll()">Generate</button>
                <button class="btn" style="background: #777;" onclick="closeModal('payroll-modal')">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

const handleCalculatePayroll = async () => {
    const data = {
        employee_id: document.getElementById('pay-emp-id').value,
        month: document.getElementById('pay-month').value,
        year: document.getElementById('pay-year').value,
        overtime_hours: document.getElementById('pay-ot').value,
        deductions: document.getElementById('pay-deduct').value
    };

    const response = await fetch(`${API_BASE_URL}/payroll/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
        body: JSON.stringify(data)
    });

    const result = await response.json();
    if (response.ok) {
        alert(`${result.message}\nNet Salary: ${state.currency}${result.net_salary}\nAdvances Deducted: ${state.currency}${result.breakdown.totalAdvances}`);
        closeModal('payroll-modal');
        fetchPayrollHistory(data.month, data.year);
    } else {
        alert(`Error: ${result.message}`);
    }
};

const downloadPayslip = async (id) => {
    try {
        const response = await fetch(`${API_BASE_URL}/payroll/payslip/${id}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (!response.ok) throw new Error('Failed to download payslip');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payslip_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        alert(error.message);
    }
};

// Toggle Reports
const renderReports = (container) => {
    container.innerHTML = `
        <h1>Reports Section</h1>
        <div class="stats-grid" style="margin-top: 2rem;">
            <div class="stat-card" style="cursor: pointer; text-align: center;" onclick="downloadExcelReport()">
                <div style="font-size: 3rem; margin-bottom: 1rem;">📊</div>
                <h3>Monthly Salary Report</h3>
                <p>Export all payroll data to Excel</p>
            </div>
            <div class="stat-card" style="cursor: pointer; text-align: center;" onclick="window.renderDetailedAttendanceReport()">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🗓️</div>
                <h3>Detailed Attendance</h3>
                <p>View daily status for all employees</p>
            </div>
            <div class="stat-card" style="cursor: pointer; text-align: center;" onclick="downloadAttendanceReport()">
                <div style="font-size: 3rem; margin-bottom: 1rem;">📄</div>
                <h3>Attendance Report (PDF)</h3>
                <p>Export attendance records to PDF</p>
            </div>
        </div>
    `;
};

const downloadExcelReport = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/payroll/report/excel`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (!response.ok) throw new Error('Failed to export Excel report');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payroll_report.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        alert(error.message);
    }
};

const downloadAttendanceReport = async () => {
    const m = document.getElementById('report-month')?.value || new Date().getMonth() + 1;
    const y = document.getElementById('report-year')?.value || new Date().getFullYear();

    try {
        const response = await fetch(`${API_BASE_URL}/attendance/report/pdf?month=${m}&year=${y}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (!response.ok) throw new Error('Failed to download attendance report');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_report_${m}_${y}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        alert(error.message);
    }
};

const renderDetailedAttendanceReport = async (month, year) => {
    const m = month || new Date().getMonth() + 1;
    const y = year || new Date().getFullYear();
    const response = await fetch(`${API_BASE_URL}/attendance/report?month=${m}&year=${y}`, {
        headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await response.json();

    const contentArea = document.getElementById('main-content-area');
    contentArea.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <h1 class="no-print" style="margin: 0;">Attendance</h1>
                <div class="no-print" style="display: flex; gap: 0.5rem; align-items: center;">
                    <select id="report-month" style="padding: 5px; border-radius: 5px; border: 1px solid #ddd;">
                        ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${m == i + 1 ? 'selected' : ''}>${new Date(0, i).toLocaleString('en', { month: 'long' })}</option>`).join('')}
                    </select>
                    <input type="number" id="report-year" value="${y}" style="width: 80px; padding: 5px; border-radius: 5px; border: 1px solid #ddd;">
                    <button class="btn" style="width: auto; padding: 5px 15px;" onclick="renderDetailedAttendanceReport(document.getElementById('report-month').value, document.getElementById('report-year').value)">View</button>
                </div>
            </div>
            <h1 class="print-only" style="display: none; text-align: center; width: 100%;">HR SYSTEM - Attendance Report (${m}/${y})</h1>
            <div style="display: flex; gap: 0.5rem;" class="no-print">
                <button class="btn" style="width: auto;" onclick="navigateTo('reports')">Back</button>
                <button class="btn" style="width: auto; background: #6c757d;" onclick="window.print()">Print Report</button>
            </div>
        </div>
        <div class="content-card" style="overflow-x: auto;">
            <table class="report-table" style="font-size: 0.8rem;">
                <thead>
                    <tr>
                        <th style="position: sticky; left: 0; background: #fff;">Employee</th>
                        ${Array.from({ length: data.daysInMonth }, (_, i) => `<th>${i + 1}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${data.report.map(emp => `
                        <tr>
                            <td style="position: sticky; left: 0; background: #fff; font-weight: bold; white-space: nowrap;">${emp.full_name}</td>
                            ${Array.from({ length: data.daysInMonth }, (_, i) => {
        const day = i + 1;
        const status = emp.days[day];
        const advance = emp.advances[day];
        let color = '#fff';
        if (status === 'Present') color = '#d4edda';
        if (status === 'Absent') color = '#f8d7da';
        if (status === 'Leave') color = '#fff3cd';
        if (status === 'Half') color = '#cce5ff';

        return `
                                    <td style="background: ${color}; text-align: center; width: 40px; padding: 4px; vertical-align: middle;">
                                        <div style="font-weight: bold;">${status ? status[0] : '-'}</div>
                                        ${advance > 0 ? `<div style="font-size: 0.6rem; color: #666;">${state.currency}${parseFloat(advance)}</div>` : ''}
                                    </td>`;
    }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div style="margin-top: 1rem; display: flex; flex-wrap: wrap; gap: 1.5rem; background: #f8f9fa; padding: 1rem; border-radius: 5px;">
             <span><b style="color: #28a745;">P</b>: Present</span>
             <span><b style="color: #dc3545;">A</b>: Absent</span>
             <span><b style="color: #ffc107;">L</b>: Leave</span>
             <span><b style="color: #007bff;">H</b>: Half Day</span>
             <span style="margin-left: auto;"><b>Total Monthly Advances:</b> ${state.currency}${data.report.reduce((sum, emp) => sum + Object.values(emp.advances).reduce((s, a) => s + parseFloat(a || 0), 0), 0).toFixed(2)}</span>
        </div>
    `;
};

// Settings
const renderSettings = (container) => {
    container.innerHTML = `
        <h1>Settings</h1>
        <div class="content-card" style="max-width: 500px;">
            <h3>Currency Preferences</h3>
            <div class="form-group">
                <label>Choose Currency Symbol</label>
                <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                    <button class="btn" style="width: auto; background: ${state.currency === '₹' ? 'var(--primary)' : '#777'}" onclick="updateCurrency('₹')">INR (₹)</button>
                    <button class="btn" style="width: auto; background: ${state.currency === '$' ? 'var(--primary)' : '#777'}" onclick="updateCurrency('$')">USD ($)</button>
                    <button class="btn" style="width: auto; background: ${state.currency === '€' ? 'var(--primary)' : '#777'}" onclick="updateCurrency('€')">EUR (€)</button>
                    <button class="btn" style="width: auto; background: ${state.currency === '£' ? 'var(--primary)' : '#777'}" onclick="updateCurrency('£')">GBP (£)</button>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <input type="text" id="custom-currency" placeholder="Custom symbol (e.g. AED)" value="${state.currency}">
                    <button class="btn" style="width: auto;" onclick="updateCurrency(document.getElementById('custom-currency').value)">Save Custom</button>
                </div>
            </div>
        </div>
    `;
};

const updateCurrency = (symbol) => {
    if (!symbol) return;
    state.currency = symbol;
    localStorage.setItem('currency', symbol);
    alert(`Currency changed to ${symbol}`);
    renderView(); // Refresh current view to show new symbol
};

// Utilities
const closeModal = (id) => {
    const el = document.getElementById(id);
    if (el) el.remove();
};

// Global exports
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.navigateTo = navigateTo;
window.saveEmployee = saveEmployee;
window.showEmployeeModal = showEmployeeModal;
window.deleteEmployee = deleteEmployee;
window.markAttendance = markAttendance;
window.fetchTodayAttendance = fetchTodayAttendance;
window.showPayrollModal = showPayrollModal;
window.handleCalculatePayroll = handleCalculatePayroll;
window.downloadPayslip = downloadPayslip;
window.downloadExcelReport = downloadExcelReport;
window.renderDetailedAttendanceReport = renderDetailedAttendanceReport;
window.downloadAttendanceReport = downloadAttendanceReport;
window.updateCurrency = updateCurrency;
window.closeModal = closeModal;
window.updateSelectStyle = updateSelectStyle;
window.getStatusSelectStyle = getStatusSelectStyle;
window.getLocalDateString = getLocalDateString;

// Handle Enter key navigation in all forms/cards (Auth, Employee Modal, etc.)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const active = document.activeElement;
        if (active && active.tagName === 'INPUT') {
            const card = active.closest('.login-card') || 
                         active.closest('.register-card') || 
                         active.closest('.content-card');
            if (card) {
                const inputs = Array.from(card.querySelectorAll('input:not([type="hidden"])'));
                const currentIndex = inputs.indexOf(active);
                if (currentIndex !== -1) {
                    e.preventDefault();
                    if (currentIndex < inputs.length - 1) {
                        inputs[currentIndex + 1].focus();
                    } else {
                        const btn = card.querySelector('.btn:not(.btn-secondary)');
                        if (btn) btn.click();
                    }
                }
            }
        }
    }
});

init();
