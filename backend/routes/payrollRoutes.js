const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');
const auth = require('../middleware/auth');

router.use(auth);

router.post('/calculate', payrollController.calculatePayroll);
router.get('/history', payrollController.getPayrollHistory);
router.get('/payslip/:id', payrollController.generatePayslip);
router.get('/report/excel', payrollController.exportPayrollToExcel);
router.delete('/:id', payrollController.deletePayroll);

module.exports = router;
