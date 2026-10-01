import express from 'express';
import {
  getDisciplineScore,
  getMonthlyReport,
  updateMonthlyReport,
  getGroupMonthlySummary,
  downloadGroupMonthlyReportPDF,
  triggerTelegramMonthlyReport,
  broadcastGroupMonthlyReportsTelegram,
  broadcastGroupDailyPendingRemindersTelegram
} from './report.controller.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Public test trigger (can be opened in any browser to test Render broadcast)
router.get('/trigger-telegram', triggerTelegramMonthlyReport);

router.use(protect); // Authentication required

router.get('/score', getDisciplineScore);
router.get('/monthly', getMonthlyReport);
router.put('/:id', updateMonthlyReport);
router.get('/group/:groupId', getGroupMonthlySummary);
router.get('/group/:groupId/pdf', downloadGroupMonthlyReportPDF);
router.post('/group/:groupId/telegram', broadcastGroupMonthlyReportsTelegram);
router.post('/group/:groupId/telegram/reminders', broadcastGroupDailyPendingRemindersTelegram);

export default router;
