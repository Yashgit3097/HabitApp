import { collections } from '../../config/db.js';

// @desc    Create a new habit (Group tasks only creatable by group admin)
// @route   POST /api/habits
// @access  Private
export const createHabit = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const {
      title,
      description,
      icon = 'CheckCircle2',
      color = '#10b981',
      frequency = 'daily',
      customDays = [],
      type = 'boolean',
      targetValue = 1,
      targetUnit = '',
      question = '',
      groupId = null,
      groupName = ''
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Habit title is required' });
    }

    // If assigning to a group, verify user is group admin
    if (groupId) {
      const group = await collections.groups.findById(groupId);
      if (!group) {
        return res.status(404).json({ success: false, message: 'Group not found' });
      }
      if (group.adminId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Only the Group Admin can create habits for this group'
        });
      }
    }

    const newHabit = await collections.habits.insertOne({
      userId,
      creatorName: req.user.name,
      creatorAvatar: req.user.avatar,
      title: title.trim(),
      description: description ? description.trim() : '',
      icon,
      color,
      frequency,
      customDays,
      type,
      targetValue: Number(targetValue) || 1,
      targetUnit: targetUnit || (type === 'time_target' ? 'mins' : type === 'count' ? 'units' : ''),
      question: question || (type === 'yes_no' ? `Did you complete ${title}?` : ''),
      groupId: groupId || null,
      groupName: groupName || '',
      streak: 0,
      bestStreak: 0,
      isArchived: false,
      createdAt: new Date().toISOString()
    });

    // Real-time broadcast if socket available & group habit
    if (req.io && groupId) {
      req.io.to(`group:${groupId}`).emit('group_task_created', newHabit);
      req.io.to(`group:${groupId}`).emit('group_habit_updated', { groupId, habit: newHabit });

      try {
        const group = await collections.groups.findById(groupId);
        if (group && group.members) {
          group.members.forEach((m) => {
            req.io.to(`user:${m.userId}`).emit('user_habits_updated', {
              type: 'habit_created',
              groupId,
              habit: newHabit
            });
          });
        }
      } catch (err) {
        console.error('Socket group members broadcast error:', err);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Habit created successfully',
      data: newHabit
    });
  } catch (error) {
    console.error('Create Habit Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create habit', error: error.message });
  }
};

// @desc    Get all habits for user (personal + joined groups) with date logs
// @route   GET /api/habits?date=YYYY-MM-DD
// @access  Private
export const getHabits = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const targetDate = req.query.date || new Date().toISOString().split('T')[0];

    // 1. Get all personal habits created by the user
    const personalHabits = await collections.habits.find({ userId, isArchived: false });

    // 2. Get user's groups to include group habits
    const allGroups = await collections.groups.find();
    const userGroups = allGroups.filter((g) =>
      g.members && g.members.some((m) => m.userId === userId)
    );
    const userGroupIds = userGroups.map((g) => g.id || g._id);

    // 3. Get group habits for those groups
    let groupHabits = [];
    if (userGroupIds.length > 0) {
      const allHabits = await collections.habits.find({ isArchived: false });
      groupHabits = allHabits.filter(
        (h) => h.groupId && userGroupIds.includes(h.groupId) && h.userId !== userId
      );
    }

    const combinedHabits = [...personalHabits, ...groupHabits];

    // 4. Fetch logs for the target date for this user
    const allLogs = await collections.habitLogs.find({
      userId,
      date: targetDate
    });

    // Map logs to habits and attach isAdmin flag for group habits
    const habitsWithLogs = combinedHabits.map((habit) => {
      const habitId = habit.id || habit._id;
      const log = allLogs.find((l) => l.habitId === habitId);
      
      let isGroupAdmin = false;
      if (habit.groupId) {
        const parentGroup = userGroups.find((g) => (g.id || g._id) === habit.groupId);
        isGroupAdmin = parentGroup?.adminId === userId;
      }

      return {
        ...habit,
        isOwner: habit.userId === userId,
        isGroupAdmin,
        canManage: habit.userId === userId || isGroupAdmin,
        todayLog: log || {
          habitId,
          userId,
          date: targetDate,
          isCompleted: false,
          value: 0,
          notes: ''
        }
      };
    });

    res.status(200).json({
      success: true,
      date: targetDate,
      data: habitsWithLogs
    });
  } catch (error) {
    console.error('Get Habits Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch habits', error: error.message });
  }
};

// @desc    Update a habit (Only Group Admin or Personal Owner)
// @route   PUT /api/habits/:id
// @access  Private
export const updateHabit = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const habitId = req.params.id;

    const habit = await collections.habits.findById(habitId);
    if (!habit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }

    // Permission check
    if (habit.groupId) {
      const group = await collections.groups.findById(habit.groupId);
      if (!group || group.adminId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Only the Group Admin can edit this group habit'
        });
      }
    } else if (habit.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to edit this habit'
      });
    }

    const updates = {};
    if (req.body.title) updates.title = req.body.title.trim();
    if (req.body.description !== undefined) updates.description = req.body.description.trim();
    if (req.body.icon) updates.icon = req.body.icon;
    if (req.body.color) updates.color = req.body.color;
    if (req.body.frequency) updates.frequency = req.body.frequency;
    if (req.body.targetValue !== undefined) updates.targetValue = Number(req.body.targetValue);
    if (req.body.targetUnit !== undefined) updates.targetUnit = req.body.targetUnit;
    if (req.body.question !== undefined) updates.question = req.body.question;

    const updatedHabit = await collections.habits.updateOne({ id: habitId }, updates);

    // Socket update
    if (req.io && habit.groupId) {
      req.io.to(`group:${habit.groupId}`).emit('group_habit_updated', {
        groupId: habit.groupId,
        habit: updatedHabit
      });
    }

    res.status(200).json({
      success: true,
      message: 'Habit updated successfully',
      data: updatedHabit
    });
  } catch (error) {
    console.error('Update Habit Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update habit', error: error.message });
  }
};

// @desc    Log/Check-in habit progress for a date
// @route   POST /api/habits/:id/log
// @access  Private
export const logHabit = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const habitId = req.params.id;
    const {
      date = new Date().toISOString().split('T')[0],
      isCompleted,
      value = 0,
      notes = ''
    } = req.body;

    const habit = await collections.habits.findById(habitId);
    if (!habit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }

    const existingLog = await collections.habitLogs.findOne({
      habitId,
      userId,
      date
    });

    let updatedLog;
    if (existingLog) {
      updatedLog = await collections.habitLogs.updateOne(
        { id: existingLog.id || existingLog._id },
        {
          isCompleted: isCompleted !== undefined ? Boolean(isCompleted) : existingLog.isCompleted,
          value: value !== undefined ? Number(value) : existingLog.value,
          notes: notes !== undefined ? notes : existingLog.notes,
          loggedAt: new Date().toISOString()
        }
      );
    } else {
      updatedLog = await collections.habitLogs.insertOne({
        habitId,
        userId,
        userName: req.user.name,
        userAvatar: req.user.avatar,
        date,
        isCompleted: Boolean(isCompleted),
        value: Number(value) || 0,
        notes: notes || '',
        loggedAt: new Date().toISOString()
      });
    }

    // Real-time broadcast if socket available & group habit
    if (req.io && habit.groupId) {
      req.io.to(`group:${habit.groupId}`).emit('group_habit_updated', {
        groupId: habit.groupId,
        habitId,
        userId,
        userName: req.user.name,
        userAvatar: req.user.avatar,
        isCompleted: Boolean(isCompleted),
        value: Number(value) || 0,
        date
      });

      if (isCompleted) {
        req.io.to(`group:${habit.groupId}`).emit('task_completed_notification', {
          id: Math.random().toString(36).substring(2, 9),
          userName: req.user.name,
          userAvatar: req.user.avatar,
          habitTitle: habit.title,
          groupId: habit.groupId,
          groupName: habit.groupName || 'Group',
          timestamp: new Date().toISOString()
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Habit progress logged',
      data: updatedLog
    });
  } catch (error) {
    console.error('Log Habit Error:', error);
    res.status(500).json({ success: false, message: 'Failed to log habit progress', error: error.message });
  }
};

// @desc    Delete a habit (Only Group Admin or Personal Owner)
// @route   DELETE /api/habits/:id
// @access  Private
export const deleteHabit = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const habitId = req.params.id;

    const habit = await collections.habits.findById(habitId);
    if (!habit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }

    // Check permissions
    if (habit.groupId) {
      const group = await collections.groups.findById(habit.groupId);
      if (!group || (group.adminId !== userId && habit.userId !== userId)) {
        return res.status(403).json({
          success: false,
          message: 'Only the Group Admin can delete this group habit'
        });
      }
    } else if (habit.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this habit'
      });
    }

    await collections.habits.deleteOne({ id: habitId });

    if (req.io && habit.groupId) {
      req.io.to(`group:${habit.groupId}`).emit('group_task_deleted', {
        habitId,
        groupId: habit.groupId
      });
      req.io.to(`group:${habit.groupId}`).emit('group_habit_updated', {
        groupId: habit.groupId
      });
    }

    res.status(200).json({
      success: true,
      message: 'Habit deleted successfully'
    });
  } catch (error) {
    console.error('Delete Habit Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete habit', error: error.message });
  }
};
