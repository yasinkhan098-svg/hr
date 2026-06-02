const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const auth = require('../middleware/auth');

router.use(auth);

router.post('/mark', attendanceController.markAttendance);
router.get('/report', attendanceController.getAttendanceReport);
router.get('/report/pdf', attendanceController.generateAttendanceReportPDF);
router.get('/today', attendanceController.getTodayAttendance);

module.exports = router;
