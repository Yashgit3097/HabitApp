import express from 'express';
import {
  createHabit,
  getHabits,
  updateHabit,
  logHabit,
  deleteHabit
} from './habit.controller.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // All habit routes require authentication

router.route('/')
  .post(createHabit)
  .get(getHabits);

router.route('/:id')
  .put(updateHabit)
  .delete(deleteHabit);

router.post('/:id/log', logHabit);

export default router;
