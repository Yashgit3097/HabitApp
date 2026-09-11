import { collections } from '../../config/db.js';
import { processUploadedFile } from '../../middleware/uploadMiddleware.js';

// Helper to generate a clean, unique join code
const generateJoinCode = (name) => {
  const prefix = (name.replace(/[^a-zA-Z]/g, '').slice(0, 4) || 'GRP').toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${random}`;
};

// @desc    Create a new group
// @route   POST /api/groups
// @access  Private
export const createGroup = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }

    let avatarUrl = '';
    if (req.file) {
      avatarUrl = await processUploadedFile(req.file, req);
    } else {
      avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name.trim())}`;
    }

    const joinCode = generateJoinCode(name);

    const newGroup = await collections.groups.insertOne({
      name: name.trim(),
      description: description ? description.trim() : '',
      avatar: avatarUrl,
      joinCode,
      adminId: userId,
      members: [
        {
          userId,
          name: req.user.name,
          username: req.user.username,
          avatar: req.user.avatar,
          role: 'admin',
          joinedAt: new Date().toISOString()
        }
      ],
      createdAt: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      data: newGroup
    });
  } catch (error) {
    console.error('Create Group Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create group', error: error.message });
  }
};

// @desc    Get all groups joined by current user
// @route   GET /api/groups
// @access  Private
export const getUserGroups = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const allGroups = await collections.groups.find();
    const allUsers = await collections.users.find();

    const userGroups = allGroups
      .filter((g) => g.members && g.members.some((m) => (m.userId || m.userId?.toString()) === userId.toString()))
      .map((g) => {
        const freshMembers = (g.members || []).map((m) => {
          const u = allUsers.find(
            (user) => (user.id || user._id)?.toString() === (m.userId || m.userId?.toString())
          );
          return {
            ...m,
            name: u?.name || m.name,
            username: u?.username || m.username,
            avatar: u?.avatar || m.avatar
          };
        });
        return { ...g, members: freshMembers };
      });

    res.status(200).json({
      success: true,
      data: userGroups
    });
  } catch (error) {
    console.error('Get User Groups Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch groups', error: error.message });
  }
};

// @desc    Get group details with members and group habits
// @route   GET /api/groups/:id
// @access  Private
export const getGroupDetails = async (req, res) => {
  try {
    const groupId = req.params.id;
    const group = await collections.groups.findById(groupId);

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    // Always fetch latest member avatars and names from users collection
    const allUsers = await collections.users.find();
    const freshMembers = (group.members || []).map((m) => {
      const u = allUsers.find(
        (user) => (user.id || user._id)?.toString() === (m.userId || m.userId?.toString())
      );
      return {
        ...m,
        name: u?.name || m.name,
        username: u?.username || m.username,
        avatar: u?.avatar || m.avatar
      };
    });
    const freshGroup = { ...group, members: freshMembers };

    // Fetch habits belonging to this group
    const allHabits = await collections.habits.find({ groupId: group.id || group._id, isArchived: false });

    // Fetch logs for all members in this group's habits for targetDate from dailyLogs
    const targetDate = req.query.date || new Date().toISOString().split('T')[0];
    const groupHabitIds = allHabits.map((h) => (h.id || h._id).toString());
    
    // 1. Fetch from dailyLogs collection
    const dailyRecords = await collections.dailyLogs.find({ date: targetDate });
    const logsForGroupHabits = [];

    if (dailyRecords && dailyRecords.length > 0) {
      dailyRecords.forEach((rec) => {
        if (rec.items && Array.isArray(rec.items)) {
          rec.items.forEach((item) => {
            const itemHabitId = (item.habitId || item.habitId?.toString() || '');
            if (groupHabitIds.includes(itemHabitId)) {
              logsForGroupHabits.push(item);
            }
          });
        }
      });
    }

    // 2. Also check legacy habitLogs for any records not yet migrated
    const legacyLogs = await collections.habitLogs.find({ date: targetDate });
    if (legacyLogs && legacyLogs.length > 0) {
      legacyLogs.forEach((l) => {
        const itemHabitId = (l.habitId ? l.habitId.toString() : '');
        const alreadyIncluded = logsForGroupHabits.some(
          (existing) =>
            (existing.habitId?.toString() === itemHabitId) &&
            (existing.userId?.toString() === (l.userId?.toString()))
        );
        if (groupHabitIds.includes(itemHabitId) && !alreadyIncluded) {
          logsForGroupHabits.push(l);
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        group: freshGroup,
        habits: allHabits,
        todayLogs: logsForGroupHabits,
        date: targetDate
      }
    });
  } catch (error) {
    console.error('Get Group Details Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch group details', error: error.message });
  }
};

// @desc    Join group via joinCode
// @route   POST /api/groups/join
// @access  Private
export const joinGroupByCode = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { code } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Join code is required' });
    }

    const group = await collections.groups.findOne({ joinCode: code.trim().toUpperCase() });
    if (!group) {
      return res.status(404).json({ success: false, message: 'Invalid join code. Group not found.' });
    }

    // Check if already a member
    const isAlreadyMember = group.members.some((m) => m.userId === userId);
    if (isAlreadyMember) {
      return res.status(200).json({
        success: true,
        message: 'You are already a member of this group',
        data: group
      });
    }

    // Add user as member
    const updatedMembers = [
      ...group.members,
      {
        userId,
        name: req.user.name,
        username: req.user.username,
        avatar: req.user.avatar,
        role: 'member',
        joinedAt: new Date().toISOString()
      }
    ];

    const updatedGroup = await collections.groups.updateOne(
      { id: group.id || group._id },
      { members: updatedMembers }
    );

    // Notify group room via socket
    if (req.io) {
      req.io.to(`group:${group.id || group._id}`).emit('member_joined', {
        groupId: group.id || group._id,
        user: {
          userId,
          name: req.user.name,
          avatar: req.user.avatar
        }
      });
    }

    res.status(200).json({
      success: true,
      message: `Successfully joined ${group.name}! 🎉`,
      data: updatedGroup
    });
  } catch (error) {
    console.error('Join Group Error:', error);
    res.status(500).json({ success: false, message: 'Failed to join group', error: error.message });
  }
};

// @desc    Remove member from group (Admin only)
// @route   DELETE /api/groups/:id/members/:memberId
// @access  Private
export const removeMember = async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    const { id: groupId, memberId } = req.params;

    const group = await collections.groups.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    // Verify current user is admin or removing themselves (leaving)
    const isAdmin = group.adminId === currentUserId;
    const isLeavingSelf = memberId === currentUserId;

    if (!isAdmin && !isLeavingSelf) {
      return res.status(403).json({ success: false, message: 'Only group admin can remove members' });
    }

    const updatedMembers = group.members.filter((m) => m.userId !== memberId);

    const updatedGroup = await collections.groups.updateOne(
      { id: groupId },
      { members: updatedMembers }
    );

    if (req.io) {
      req.io.to(`group:${groupId}`).emit('member_removed', {
        groupId,
        memberId
      });
    }

    res.status(200).json({
      success: true,
      message: isLeavingSelf ? 'You have left the group' : 'Member removed successfully',
      data: updatedGroup
    });
  } catch (error) {
    console.error('Remove Member Error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove member', error: error.message });
  }
};

// @desc    Get group preview by join code (Public/Pre-join)
// @route   GET /api/groups/code/:code
// @access  Private
export const getGroupByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const group = await collections.groups.findOne({ joinCode: code.trim().toUpperCase() });

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found for this join code' });
    }

    res.status(200).json({
      success: true,
      data: group
    });
  } catch (error) {
    console.error('Get Group By Code Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch group code info' });
  }
};
