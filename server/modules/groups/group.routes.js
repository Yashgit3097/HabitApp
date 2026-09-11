import express from 'express';
import {
  createGroup,
  getUserGroups,
  getGroupDetails,
  joinGroupByCode,
  removeMember,
  getGroupByCode
} from './group.controller.js';
import { protect } from '../../middleware/authMiddleware.js';
import { upload } from '../../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(protect); // All group routes protected

router.route('/')
  .post(upload.single('avatar'), createGroup)
  .get(getUserGroups);

router.post('/join', joinGroupByCode);
router.get('/code/:code', getGroupByCode);

router.route('/:id')
  .get(getGroupDetails);

router.delete('/:id/members/:memberId', removeMember);

export default router;
