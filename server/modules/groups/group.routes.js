import express from 'express';
import {
  createGroup,
  getUserGroups,
  getGroupDetails,
  joinGroupByCode,
  removeMember,
  getGroupByCode,
  updateMemberAvatar,
  updateGroup,
  deleteGroup
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
  .get(getGroupDetails)
  .put(upload.single('avatar'), updateGroup)
  .delete(deleteGroup);

router.delete('/:id/members/:memberId', removeMember);
router.put('/:id/members/:memberId/avatar', upload.single('avatar'), updateMemberAvatar);

export default router;
