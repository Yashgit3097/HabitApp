import { collections } from '../../config/db.js';

// Helper: parse HH:MM AM/PM to minutes from midnight
const timeStringToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridian = match[3] ? match[3].toUpperCase() : null;

  if (meridian === 'PM' && hours < 12) hours += 12;
  if (meridian === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
};

// Helper: convert minutes from midnight to HH:MM AM/PM
const minutesToTimeString = (totalMinutes) => {
  if (totalMinutes === null || isNaN(totalMinutes)) return 'N/A';
  let hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = Math.round(totalMinutes % 60);
  const meridian = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${meridian}`;
};

// Helper: calculate total days in a given YYYY-MM
const getDaysInMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

// Helper: format YYYY-MM-DD
const formatDate = (year, month, day) => {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/**
 * Compute and persist user's all-time Discipline Score in database
 * (+1 for each distinct day where 100% of all assigned habits were completed)
 * This score NEVER resets on new days or after monthly log archiving.
 * Dynamically increases when 100% is reached and decreases if past editable days are uncompleted.
 */
export const computeAndSaveUserDisciplineScore = async (userId) => {
  if (!userId) return 0;
  const targetUserId = userId.toString();

  // 1. Fetch all user habits (Personal + Joined Groups)
  const allHabits = await collections.habits.find({ isArchived: false });
  const personalHabits = allHabits.filter(
    (h) => (h.userId || '').toString() === targetUserId && !h.groupId
  );

  const allGroups = await collections.groups.find();
  const userGroups = allGroups.filter((g) =>
    g.members && g.members.some((m) => (m.userId || '').toString() === targetUserId)
  );
  const userGroupIds = userGroups.map((g) => (g.id || g._id).toString());

  const groupHabits = allHabits.filter(
    (h) => h.groupId && userGroupIds.includes(h.groupId.toString())
  );

  const allUserHabits = [...personalHabits, ...groupHabits];
  const allUserHabitIds = allUserHabits.map((h) => (h.id || h._id).toString());
  const totalHabitsCount = allUserHabitIds.length;

  // 2. Fetch past finalized monthly reports to preserve historical score after raw logs are archived/pruned
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const allMonthlyReports = await collections.monthlyReports.find();
  const pastFinalizedReports = allMonthlyReports.filter(
    (r) =>
      (r.userId || '').toString() === targetUserId &&
      !r.groupId &&
      r.status === 'finalized' &&
      r.month &&
      r.month < currentMonthStr
  );

  let pastFinalizedScore = 0;
  const finalizedMonthsSet = new Set();
  pastFinalizedReports.forEach((r) => {
    finalizedMonthsSet.add(r.month);
    pastFinalizedScore += Number(r.overallStats?.perfectDays || r.overallStats?.disciplineScore || 0);
  });

  // 3. Fetch active logs for this user (current month and unfinalized recent logs)
  const allLogs = await collections.habitLogs.find();
  const userLogs = allLogs.filter((l) => (l.userId || '').toString() === targetUserId);

  // Group completed distinct habit IDs by date
  const completedHabitsByDate = {};
  for (const log of userLogs) {
    const isDone =
      Boolean(log.isCompleted) ||
      (typeof log.value === 'number' && log.value > 0) ||
      (typeof log.value === 'string' && log.value.trim().length > 0);

    if (isDone && log.date) {
      if (!completedHabitsByDate[log.date]) {
        completedHabitsByDate[log.date] = new Set();
      }
      completedHabitsByDate[log.date].add((log.habitId || '').toString());
    }
  }

  let activeLogsScore = 0;
  if (totalHabitsCount > 0) {
    for (const dateStr in completedHabitsByDate) {
      const monthOfDate = dateStr.slice(0, 7);
      // Skip if date belongs to an already finalized past month to prevent double counting
      if (finalizedMonthsSet.has(monthOfDate)) {
        continue;
      }

      const completedSet = completedHabitsByDate[dateStr];
      const completedCountForDate = allUserHabitIds.filter((hId) => completedSet.has(hId)).length;

      // Check if all assigned habits were 100% completed on this date
      if (completedCountForDate >= totalHabitsCount) {
        activeLogsScore += 1;
      }
    }
  }

  const totalAllTimeScore = pastFinalizedScore + activeLogsScore;

  // Update disciplineScore in user document in database
  await collections.users.updateOne({ id: targetUserId }, { disciplineScore: totalAllTimeScore });
  return totalAllTimeScore;
};

// @desc    Get user's all-time Discipline Score
// @route   GET /api/reports/score
// @access  Private
export const getDisciplineScore = async (req, res) => {
  try {
    const userId = (req.user.id || req.user._id).toString();
    const score = await computeAndSaveUserDisciplineScore(userId);
    const user = await collections.users.findById(userId);

    res.status(200).json({
      success: true,
      data: {
        score: typeof user?.disciplineScore === 'number' ? user.disciplineScore : score,
        perfectDays: score,
        userId
      }
    });
  } catch (error) {
    console.error('Get Discipline Score Error:', error);
    res.status(500).json({ success: false, message: 'Failed to calculate discipline score', error: error.message });
  }
};

// @desc    Generate or fetch overall monthly report
// @route   GET /api/reports/monthly
// @access  Private
export const getMonthlyReport = async (req, res) => {
  try {
    const currentUserId = (req.user.id || req.user._id).toString();
    const targetUserId = (req.query.userId || currentUserId).toString();
    const groupId = req.query.groupId || null;

    // Target month: format YYYY-MM (default to current month)
    const now = new Date();
    const targetMonthStr = req.query.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [yearStr, monthNumStr] = targetMonthStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthNumStr, 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: 'Invalid month format. Expected YYYY-MM' });
    }

    const targetUser = await collections.users.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if this report is already in monthlyReports collection
    const allReports = await collections.monthlyReports.find();
    const existingReport = allReports.find(
      (r) =>
        (r.userId || '').toString() === targetUserId.toString() &&
        r.month === targetMonthStr &&
        (groupId ? (r.groupId || '').toString() === groupId.toString() : !r.groupId)
    );

    const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;

    // Compute report details
    const daysInMonth = getDaysInMonth(year, month);
    const startDateOfMonth = formatDate(year, month, 1);

    // Check user registration date to handle first month offset
    const userCreatedAtStr = (targetUser.createdAt || startDateOfMonth).split('T')[0];
    const userRegMonth = userCreatedAtStr.slice(0, 7);

    let effectiveStartDay = 1;
    if (userRegMonth === targetMonthStr) {
      const regDay = parseInt(userCreatedAtStr.split('-')[2], 10);
      effectiveStartDay = Math.max(1, isNaN(regDay) ? 1 : regDay);
    }

    // Total active days in month up to today (or end of month if past month)
    const currentDayOfMonth = now.getDate();
    const maxDayToCount = isCurrentMonth ? currentDayOfMonth : daysInMonth;
    const activeDaysInMonth = Math.max(1, maxDayToCount - effectiveStartDay + 1);

    // Fetch relevant habits (Personal + Joined Group Habits for complete monthly report)
    const allHabits = await collections.habits.find({ isArchived: false });
    let habitsToReport = [];

    if (groupId) {
      habitsToReport = allHabits.filter((h) => (h.groupId || '').toString() === groupId.toString());
    } else {
      const personalHabits = allHabits.filter(
        (h) => (h.userId || '').toString() === targetUserId.toString() && !h.groupId
      );

      // Include group habits for groups the user is an active member of
      const allGroups = await collections.groups.find();
      const userGroups = allGroups.filter((g) =>
        g.members && g.members.some((m) => (m.userId || '').toString() === targetUserId.toString())
      );
      const userGroupIds = userGroups.map((g) => (g.id || g._id).toString());

      const groupHabits = allHabits.filter(
        (h) => h.groupId && userGroupIds.includes(h.groupId.toString())
      );

      habitsToReport = [...personalHabits, ...groupHabits];
    }

    // Fetch all logs in target month for this user
    const allLogs = await collections.habitLogs.find();
    const monthLogs = allLogs.filter(
      (l) => (l.userId || '').toString() === targetUserId.toString() && l.date && l.date.startsWith(targetMonthStr)
    );

    // Aggregate statistics per habit
    const habitSummaries = habitsToReport.map((habit) => {
      const habitId = (habit.id || habit._id).toString();
      const habitLogs = monthLogs.filter((l) => (l.habitId || '').toString() === habitId);

      const completedLogs = habitLogs.filter(
        (l) =>
          Boolean(l.isCompleted) ||
          (typeof l.value === 'number' && l.value > 0) ||
          (typeof l.value === 'string' && l.value.trim().length > 0)
      );
      const completedDaysCount = completedLogs.length;
      const completionPercentage = Math.min(100, Math.round((completedDaysCount / activeDaysInMonth) * 100));

      let typeDetails = {};

      if (habit.type === 'boolean') {
        typeDetails = {
          completedDays: completedDaysCount,
          totalDays: activeDaysInMonth,
          percentage: completionPercentage
        };
      } else if (habit.type === 'yes_no') {
        const yesCount = habitLogs.filter(
          (l) => l.isCompleted || l.value === 1 || l.value === '1' || l.value === true
        ).length;
        const noCount = activeDaysInMonth - yesCount;
        typeDetails = {
          yesDays: yesCount,
          noDays: Math.max(0, noCount),
          totalDays: activeDaysInMonth,
          yesPercentage: Math.min(100, Math.round((yesCount / activeDaysInMonth) * 100))
        };
      } else if (habit.type === 'time_of_day') {
        const timesLogged = completedLogs
          .map((l) => (typeof l.value === 'string' && l.value.trim() ? l.value.trim() : habit.targetValue))
          .filter(Boolean);

        // Find most frequent time (mode)
        const frequencyMap = {};
        let mostFrequentTime = timesLogged[0] || habit.targetValue || '05:00 AM';
        let maxFreq = 0;

        let totalMinutesSum = 0;
        let validMinutesCount = 0;

        timesLogged.forEach((t) => {
          frequencyMap[t] = (frequencyMap[t] || 0) + 1;
          if (frequencyMap[t] > maxFreq) {
            maxFreq = frequencyMap[t];
            mostFrequentTime = t;
          }

          const mins = timeStringToMinutes(t);
          if (mins !== null) {
            totalMinutesSum += mins;
            validMinutesCount++;
          }
        });

        const avgMinutes = validMinutesCount > 0 ? Math.round(totalMinutesSum / validMinutesCount) : null;
        const averageTime = minutesToTimeString(avgMinutes);

        typeDetails = {
          targetTime: habit.targetValue || '05:00 AM',
          completedDays: completedDaysCount,
          totalDays: activeDaysInMonth,
          mostFrequentTime,
          averageTime,
          checkInCount: timesLogged.length
        };
      } else if (habit.type === 'count') {
        const totalCount = completedLogs.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
        const dailyAverage = Math.round((totalCount / activeDaysInMonth) * 10) / 10;

        typeDetails = {
          targetPerDay: habit.targetValue || 1,
          unit: habit.targetUnit || 'units',
          totalCount,
          dailyAverage,
          completedDays: completedDaysCount,
          totalDays: activeDaysInMonth
        };
      } else if (habit.type === 'time_target') {
        const totalMinutes = completedLogs.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
        const dailyAverageMinutes = Math.round(totalMinutes / activeDaysInMonth);
        const totalHours = (totalMinutes / 60).toFixed(1);

        typeDetails = {
          targetMinutesPerDay: habit.targetValue || 30,
          totalMinutes,
          totalHours: Number(totalHours),
          dailyAverageMinutes,
          completedDays: completedDaysCount,
          totalDays: activeDaysInMonth
        };
      } else if (habit.type === 'timer') {
        const totalSeconds = completedLogs.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
        const totalMinutes = Math.round(totalSeconds / 60);
        const dailyAverageSeconds = Math.round(totalSeconds / activeDaysInMonth);

        typeDetails = {
          totalSeconds,
          totalMinutes,
          dailyAverageSeconds,
          completedDays: completedDaysCount,
          totalDays: activeDaysInMonth
        };
      }

      return {
        habitId,
        title: habit.title,
        description: habit.description || '',
        icon: habit.icon,
        color: habit.color,
        type: habit.type,
        frequency: habit.frequency,
        targetValue: habit.targetValue,
        targetUnit: habit.targetUnit,
        completedDaysCount,
        activeDaysInMonth,
        completionPercentage,
        typeDetails
      };
    });

    // Calculate Discipline Score & Perfect Days for this Month
    let perfectDaysInMonth = 0;
    const allUserHabitIds = habitsToReport.map((h) => (h.id || h._id).toString());

    const completedHabitsByDateMonth = {};
    for (const log of monthLogs) {
      const isDone =
        Boolean(log.isCompleted) ||
        (typeof log.value === 'number' && log.value > 0) ||
        (typeof log.value === 'string' && log.value.trim().length > 0);

      if (isDone && log.date) {
        if (!completedHabitsByDateMonth[log.date]) {
          completedHabitsByDateMonth[log.date] = new Set();
        }
        completedHabitsByDateMonth[log.date].add((log.habitId || '').toString());
      }
    }

    if (allUserHabitIds.length > 0) {
      for (const dateStr in completedHabitsByDateMonth) {
        const completedSet = completedHabitsByDateMonth[dateStr];
        const count = allUserHabitIds.filter((hId) => completedSet.has(hId)).length;
        if (count >= allUserHabitIds.length) {
          perfectDaysInMonth += 1;
        }
      }
    }

    const overallCompletionRate =
      habitSummaries.length > 0
        ? Math.round(
            habitSummaries.reduce((sum, h) => sum + h.completionPercentage, 0) / habitSummaries.length
          )
        : 0;

    const reportDocument = {
      userId: targetUserId,
      userProfile: {
        id: targetUserId,
        name: targetUser.name,
        username: targetUser.username,
        avatar: targetUser.avatar
      },
      groupId: groupId || null,
      month: targetMonthStr,
      year,
      monthNumber: month,
      daysInMonth,
      effectiveStartDay,
      activeDaysInMonth,
      isFirstMonth: userRegMonth === targetMonthStr,
      overallStats: {
        totalHabits: allUserHabitIds.length,
        perfectDays: perfectDaysInMonth,
        disciplineScore: perfectDaysInMonth,
        overallCompletionRate
      },
      habitSummaries,
      adminRemarks: existingReport?.adminRemarks || '',
      status: existingReport?.status || (isCurrentMonth ? 'in_progress' : 'finalized'),
      updatedAt: new Date().toISOString()
    };

    // ALWAYS Upsert into monthlyReports collection so the document is physically saved in DB!
    let savedReport;
    if (existingReport && (existingReport.id || existingReport._id)) {
      savedReport = await collections.monthlyReports.updateOne(
        { id: existingReport.id || existingReport._id },
        reportDocument
      );
    } else {
      savedReport = await collections.monthlyReports.insertOne(reportDocument);
    }

    res.status(200).json({
      success: true,
      data: savedReport || reportDocument
    });
  } catch (error) {
    console.error('Get Monthly Report Error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate monthly report', error: error.message });
  }
};

// @desc    Update or edit monthly report (Admin / Creator)
// @route   PUT /api/reports/:id
// @access  Private
export const updateMonthlyReport = async (req, res) => {
  try {
    const currentUserId = (req.user.id || req.user._id).toString();
    const { id } = req.params;
    const { adminRemarks, status, habitSummaries, overallStats } = req.body;

    let report = await collections.monthlyReports.findById(id);
    
    // If not saved yet, check if report data is passed to create/save it
    if (!report && req.body.month && req.body.userId) {
      report = await collections.monthlyReports.insertOne({
        userId: req.body.userId,
        groupId: req.body.groupId || null,
        month: req.body.month,
        userProfile: req.body.userProfile || {},
        overallStats: overallStats || {},
        habitSummaries: habitSummaries || [],
        adminRemarks: adminRemarks || '',
        status: status || 'draft',
        lastEditedBy: currentUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return res.status(200).json({
        success: true,
        message: 'Monthly report saved successfully',
        data: report
      });
    }

    if (!report) {
      return res.status(404).json({ success: false, message: 'Monthly report not found' });
    }

    // Permission check: if group report, must be group admin; if personal, must be owner
    if (report.groupId) {
      const group = await collections.groups.findById(report.groupId);
      if (!group || (group.adminId || '').toString() !== currentUserId) {
        return res.status(403).json({ success: false, message: 'Only group admin can edit this group report' });
      }
    } else if (report.userId.toString() !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this report' });
    }

    const updates = {};
    if (adminRemarks !== undefined) updates.adminRemarks = adminRemarks;
    if (status !== undefined) updates.status = status;
    if (habitSummaries !== undefined) updates.habitSummaries = habitSummaries;
    if (overallStats !== undefined) updates.overallStats = overallStats;
    updates.lastEditedBy = currentUserId;
    updates.updatedAt = new Date().toISOString();

    const updated = await collections.monthlyReports.updateOne({ id }, updates);

    res.status(200).json({
      success: true,
      message: 'Monthly report updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('Update Monthly Report Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update report', error: error.message });
  }
};

// @desc    Get group monthly summary (Performance of all members)
// @route   GET /api/reports/group/:groupId
// @access  Private
export const getGroupMonthlySummary = async (req, res) => {
  try {
    const { groupId } = req.params;
    const currentUserId = (req.user.id || req.user._id).toString();

    const group = await collections.groups.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const isMember = group.members && group.members.some((m) => (m.userId || '').toString() === currentUserId);
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Must be a group member to view group reports' });
    }

    const now = new Date();
    const targetMonthStr = req.query.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [yearStr, monthNumStr] = targetMonthStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthNumStr, 10);
    const daysInMonth = getDaysInMonth(year, month);
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
    const maxDayToCount = isCurrentMonth ? now.getDate() : daysInMonth;

    const groupHabits = await collections.habits.find({ groupId: groupId.toString(), isArchived: false });
    const allUsers = await collections.users.find();

    // Fetch month logs for all group habits
    const groupHabitIds = groupHabits.map((h) => (h.id || h._id).toString());
    const allLogs = await collections.habitLogs.find();
    const relevantLogs = allLogs.filter(
      (l) => l.date && l.date.startsWith(targetMonthStr) && groupHabitIds.includes((l.habitId || '').toString())
    );

    // Compute metrics for each group member
    const memberReports = (group.members || []).map((m) => {
      const memberUserId = (m.userId || '').toString();
      const freshUser = allUsers.find((u) => (u.id || u._id)?.toString() === memberUserId);

      const userCreatedAtStr = (freshUser?.createdAt || `${targetMonthStr}-01`).split('T')[0];
      let effectiveStartDay = 1;
      if (userCreatedAtStr.startsWith(targetMonthStr)) {
        const regDay = parseInt(userCreatedAtStr.split('-')[2], 10);
        effectiveStartDay = Math.max(1, isNaN(regDay) ? 1 : regDay);
      }

      const activeDays = Math.max(1, maxDayToCount - effectiveStartDay + 1);

      const memberLogs = relevantLogs.filter((l) => (l.userId || '').toString() === memberUserId);
      const completedLogs = memberLogs.filter(
        (l) =>
          Boolean(l.isCompleted) ||
          (typeof l.value === 'number' && l.value > 0) ||
          (typeof l.value === 'string' && l.value.trim().length > 0)
      );

      // Group logs by date to compute perfect days
      const memberLogsByDate = {};
      memberLogs.forEach((l) => {
        const isDone =
          Boolean(l.isCompleted) ||
          (typeof l.value === 'number' && l.value > 0) ||
          (typeof l.value === 'string' && l.value.trim().length > 0);

        if (isDone && l.date) {
          if (!memberLogsByDate[l.date]) memberLogsByDate[l.date] = new Set();
          memberLogsByDate[l.date].add((l.habitId || '').toString());
        }
      });

      let perfectDays = 0;
      if (groupHabits.length > 0) {
        for (const dateStr in memberLogsByDate) {
          const completedSet = memberLogsByDate[dateStr];
          const count = groupHabitIds.filter((hId) => completedSet.has(hId)).length;
          if (count >= groupHabitIds.length) {
            perfectDays += 1;
          }
        }
      }

      const totalExpectedTasks = groupHabits.length * activeDays;
      const completionRate =
        totalExpectedTasks > 0 ? Math.min(100, Math.round((completedLogs.length / totalExpectedTasks) * 100)) : 0;

      return {
        userId: memberUserId,
        name: freshUser?.name || m.name,
        username: freshUser?.username || m.username,
        avatar: freshUser?.avatar || m.avatar,
        role: m.role,
        activeDays,
        perfectDays,
        disciplineScore: perfectDays,
        completedTasksCount: completedLogs.length,
        totalExpectedTasks,
        completionRate
      };
    });

    // Sort by disciplineScore descending
    memberReports.sort((a, b) => b.disciplineScore - a.disciplineScore || b.completionRate - a.completionRate);

    res.status(200).json({
      success: true,
      data: {
        groupId,
        groupName: group.name,
        groupAvatar: group.avatar,
        adminId: group.adminId,
        isAdmin: (group.adminId || '').toString() === currentUserId,
        month: targetMonthStr,
        totalGroupHabits: groupHabits.length,
        memberCount: memberReports.length,
        memberReports
      }
    });
  } catch (error) {
    console.error('Get Group Monthly Summary Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch group summary', error: error.message });
  }
};
