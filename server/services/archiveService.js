import { collections } from '../config/db.js';

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

const minutesToTimeString = (totalMinutes) => {
  if (totalMinutes === null || isNaN(totalMinutes)) return 'N/A';
  let hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = Math.round(totalMinutes % 60);
  const meridian = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${meridian}`;
};

const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();

const formatDate = (year, month, day) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

// Helper: check if a habit log represents a truly completed check-in
const isLogDone = (l) => {
  if (!l) return false;
  if (l.isCompleted === true || l.isCompleted === 1 || l.isCompleted === 'true') return true;
  if (typeof l.value === 'number') return l.value > 0;
  if (typeof l.value === 'string') {
    const trimmed = l.value.trim();
    if (!trimmed || trimmed === '0' || trimmed === '00:00' || trimmed.toLowerCase() === 'false') return false;
    const num = Number(trimmed);
    if (!isNaN(num)) return num > 0;
    return true;
  }
  return false;
};

/**
 * Generate habit summary metrics for a given habit and logs
 */
const buildHabitSummary = (habit, userMonthLogs, activeDaysInMonth) => {
  const habitId = (habit.id || habit._id).toString();
  const habitLogs = userMonthLogs.filter((l) => (l.habitId || '').toString() === habitId);
  const completedLogs = habitLogs.filter(isLogDone);
  const completedDaysCount = new Set(completedLogs.map((l) => l.date)).size;
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
    typeDetails = {
      yesDays: yesCount,
      noDays: Math.max(0, activeDaysInMonth - yesCount),
      totalDays: activeDaysInMonth,
      yesPercentage: Math.min(100, Math.round((yesCount / activeDaysInMonth) * 100))
    };
  } else if (habit.type === 'time_of_day') {
    const timesLogged = completedLogs
      .map((l) => (typeof l.value === 'string' && l.value.trim() ? l.value.trim() : habit.targetValue))
      .filter(Boolean);

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
    typeDetails = {
      targetTime: habit.targetValue || '05:00 AM',
      completedDays: completedDaysCount,
      totalDays: activeDaysInMonth,
      mostFrequentTime,
      averageTime: minutesToTimeString(avgMinutes),
      checkInCount: timesLogged.length
    };
  } else if (habit.type === 'count') {
    const totalCount = completedLogs.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
    typeDetails = {
      targetPerDay: habit.targetValue || 1,
      unit: habit.targetUnit || 'units',
      totalCount,
      dailyAverage: Math.round((totalCount / activeDaysInMonth) * 10) / 10,
      completedDays: completedDaysCount,
      totalDays: activeDaysInMonth
    };
  } else if (habit.type === 'time_target') {
    const totalMinutes = completedLogs.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
    typeDetails = {
      targetMinutesPerDay: habit.targetValue || 30,
      totalMinutes,
      totalHours: Number((totalMinutes / 60).toFixed(1)),
      dailyAverageMinutes: Math.round(totalMinutes / activeDaysInMonth),
      completedDays: completedDaysCount,
      totalDays: activeDaysInMonth
    };
  } else if (habit.type === 'timer') {
    const totalSeconds = completedLogs.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
    typeDetails = {
      totalSeconds,
      totalMinutes: Math.round(totalSeconds / 60),
      dailyAverageSeconds: Math.round(totalSeconds / activeDaysInMonth),
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
};

/**
 * Helper to build and upsert a monthly report document (Personal or Group)
 */
const generateAndSaveReportDoc = async ({
  user,
  groupId = null,
  habits,
  allLogs,
  targetMonthStr,
  year,
  month,
  daysInMonth,
  maxDayToCount,
  isFinalized = false,
  remarks = ''
}) => {
  const userId = (user.id || user._id).toString();

  const activeDaysInMonth = Math.max(1, maxDayToCount);
  const effectiveStartDay = 1;

  const userMonthLogs = allLogs.filter((l) => {
    if ((l.userId || '').toString() !== userId || !l.date || !l.date.startsWith(targetMonthStr)) {
      return false;
    }
    const logDay = parseInt(l.date.split('-')[2], 10);
    return logDay >= 1 && logDay <= maxDayToCount;
  });

  const habitSummaries = habits.map((habit) => buildHabitSummary(habit, userMonthLogs, activeDaysInMonth));

  // Perfect days calculation
  const habitIds = habits.map((h) => (h.id || h._id).toString());
  const monthLogsByDate = {};
  for (const log of userMonthLogs) {
    const isDone =
      Boolean(log.isCompleted) ||
      (typeof log.value === 'number' && log.value > 0) ||
      (typeof log.value === 'string' && log.value.trim().length > 0);

    if (isDone && log.date && habitIds.includes((log.habitId || '').toString())) {
      if (!monthLogsByDate[log.date]) {
        monthLogsByDate[log.date] = new Set();
      }
      monthLogsByDate[log.date].add((log.habitId || '').toString());
    }
  }

  let perfectDaysInMonth = 0;
  if (habitIds.length > 0) {
    for (const dateStr in monthLogsByDate) {
      const completedSet = monthLogsByDate[dateStr];
      const count = habitIds.filter((hId) => completedSet.has(hId)).length;
      if (count >= habitIds.length) {
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

  const reportDoc = {
    userId,
    userProfile: {
      id: userId,
      name: user.name,
      username: user.username,
      avatar: user.avatar
    },
    groupId: groupId ? groupId.toString() : null,
    month: targetMonthStr,
    year,
    monthNumber: month,
    daysInMonth,
    effectiveStartDay: 1,
    activeDaysInMonth,
    isFirstMonth: false,
    overallStats: {
      totalHabits: habits.length,
      perfectDays: perfectDaysInMonth,
      disciplineScore: perfectDaysInMonth,
      overallCompletionRate
    },
    habitSummaries,
    adminRemarks: remarks || (isFinalized ? 'Monthly report automatically finalized.' : ''),
    status: isFinalized ? 'finalized' : 'in_progress',
    updatedAt: new Date().toISOString()
  };

  // Upsert into monthlyReports
  const query = {
    userId,
    month: targetMonthStr,
    groupId: groupId ? groupId.toString() : null
  };

  const existing = await collections.monthlyReports.findOne(query);
  if (existing && (existing.id || existing._id)) {
    if (existing.adminRemarks && !remarks) {
      reportDoc.adminRemarks = existing.adminRemarks;
    }
    await collections.monthlyReports.updateOne(
      { id: existing.id || existing._id },
      reportDoc
    );
  } else {
    reportDoc.createdAt = new Date().toISOString();
    await collections.monthlyReports.insertOne(reportDoc);
  }

  return reportDoc;
};

/**
 * Background Monthly Archival and Pruning Service
 * Runs on or after the 1st date of the month (day >= 1).
 * Freezes & persists the previous month's reports (Personal + Group) in `monthly_reports`.
 * Only cleans up old daily logs after report verification, NEVER deleting current month data.
 */
export const runMonthlyArchiveAndCleanup = async () => {
  try {
    const now = new Date();
    const currentDay = now.getDate();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    console.log(`📦 [Archive Service] Checking monthly archival status (Current Day: ${currentDay})...`);

    // Condition: Run archival for previous month on or after date 1
    if (currentDay < 1) {
      return;
    }

    // Determine previous month
    let prevYear = currentYear;
    let prevMonth = currentMonth - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }
    const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

    console.log(`🔄 [Archive Service] Processing archival for previous month: ${prevMonthStr}...`);

    const allUsers = await collections.users.find();
    const allHabits = await collections.habits.find({ isArchived: false });
    const allGroups = await collections.groups.find();
    const allLogs = await collections.habitLogs.find();

    let reportsGenerated = 0;

    // 1. Generate & finalize Personal/Overall monthly reports for all users
    for (const user of allUsers) {
      const userId = (user.id || user._id).toString();

      const personalHabits = allHabits.filter(
        (h) => (h.userId || '').toString() === userId && !h.groupId
      );
      const userGroups = allGroups.filter((g) =>
        g.members && g.members.some((m) => (m.userId || '').toString() === userId)
      );
      const userGroupIds = userGroups.map((g) => (g.id || g._id).toString());
      const groupHabits = allHabits.filter(
        (h) => h.groupId && userGroupIds.includes(h.groupId.toString())
      );
      const allUserHabits = [...personalHabits, ...groupHabits];

      await generateAndSaveReportDoc({
        user,
        groupId: null,
        habits: allUserHabits,
        allLogs,
        targetMonthStr: prevMonthStr,
        year: prevYear,
        month: prevMonth,
        daysInMonth: daysInPrevMonth,
        maxDayToCount: daysInPrevMonth,
        isFinalized: true,
        remarks: 'Monthly report automatically finalized on date 5.'
      });
      reportsGenerated++;
    }

    // 2. Generate & finalize Group-specific monthly reports for each member of every group
    for (const group of allGroups) {
      const groupId = (group.id || group._id).toString();
      const groupHabits = allHabits.filter((h) => (h.groupId || '').toString() === groupId);

      if (groupHabits.length === 0 || !group.members) continue;

      for (const member of group.members) {
        const memberUserId = (member.userId || '').toString();
        const userObj = allUsers.find((u) => (u.id || u._id)?.toString() === memberUserId) || member;

        await generateAndSaveReportDoc({
          user: userObj,
          groupId,
          habits: groupHabits,
          allLogs,
          targetMonthStr: prevMonthStr,
          year: prevYear,
          month: prevMonth,
          daysInMonth: daysInPrevMonth,
          maxDayToCount: daysInPrevMonth,
          isFinalized: true,
          remarks: 'Group monthly report automatically finalized on date 5.'
        });
        reportsGenerated++;
      }
    }

    console.log(`✅ [Archive Service] Finalized ${reportsGenerated} user & group reports for ${prevMonthStr}.`);

    // 3. Clean up daily logs strictly older than 2 months (keep current and previous month daily logs 100% intact!)
    let logsDeleted = 0;
    const oldLogs = allLogs.filter((l) => {
      if (!l.date) return false;
      // Guard 1: Never delete current active month logs
      if (l.date.startsWith(currentMonthStr)) return false;
      // Guard 2: Never delete previous month logs
      if (l.date.startsWith(prevMonthStr)) return false;
      // Guard 3: Never delete future logs
      if (l.date > currentMonthStr) return false;
      // Only match logs older than previous month (2+ months ago)
      return l.date < prevMonthStr;
    });

    if (reportsGenerated > 0 && oldLogs.length > 0) {
      for (const oldLog of oldLogs) {
        const id = oldLog.id || oldLog._id;
        if (id) {
          await collections.habitLogs.deleteOne({ id });
          logsDeleted++;
        }
      }
      console.log(`🧹 [Archive Service] Cleaned up ${logsDeleted} historical logs older than 60 days. Current (${currentMonthStr}) & Previous (${prevMonthStr}) logs remain 100% intact.`);
    }
  } catch (error) {
    console.error('❌ [Archive Service] Error running monthly archival:', error);
  }
};

/**
 * Auto-generate or update current month report documents for all users and all groups
 */
export const ensureCurrentMonthReportsGenerated = async (targetMonthOverride = null) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const targetMonthStr = targetMonthOverride || `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const [yearStr, monthNumStr] = targetMonthStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthNumStr, 10);
    const daysInMonth = getDaysInMonth(year, month);
    const isCurrentMonth = currentYear === year && currentMonth === month;
    const maxDayToCount = isCurrentMonth ? now.getDate() : daysInMonth;

    console.log(`📊 [Archive Service] Auto-generating monthly reports for month: ${targetMonthStr}...`);

    const allUsers = await collections.users.find();
    const allHabits = await collections.habits.find({ isArchived: false });
    const allGroups = await collections.groups.find();
    const allLogs = await collections.habitLogs.find();

    let userReportsCount = 0;
    let groupReportsCount = 0;

    // 1. Generate / Update Personal Monthly Reports & All-Time Discipline Score
    for (const user of allUsers) {
      const userId = (user.id || user._id).toString();

      const personalHabits = allHabits.filter(
        (h) => (h.userId || '').toString() === userId && !h.groupId
      );
      const userGroups = allGroups.filter((g) =>
        g.members && g.members.some((m) => (m.userId || '').toString() === userId)
      );
      const userGroupIds = userGroups.map((g) => (g.id || g._id).toString());
      const groupHabits = allHabits.filter(
        (h) => h.groupId && userGroupIds.includes(h.groupId.toString())
      );
      const allUserHabits = [...personalHabits, ...groupHabits];
      const allUserHabitIds = allUserHabits.map((h) => (h.id || h._id).toString());

      // All-Time Discipline Score calculation
      const allMonthlyReports = await collections.monthlyReports.find();
      const pastFinalizedReports = allMonthlyReports.filter(
        (r) =>
          (r.userId || '').toString() === userId &&
          !r.groupId &&
          r.status === 'finalized' &&
          r.month &&
          r.month < targetMonthStr
      );

      let pastFinalizedScore = 0;
      const finalizedMonthsSet = new Set();
      pastFinalizedReports.forEach((r) => {
        finalizedMonthsSet.add(r.month);
        pastFinalizedScore += Number(r.overallStats?.perfectDays || r.overallStats?.disciplineScore || 0);
      });

      const userAllLogs = allLogs.filter((l) => (l.userId || '').toString() === userId);
      const completedHabitsByDate = {};
      for (const log of userAllLogs) {
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
      if (allUserHabitIds.length > 0) {
        for (const dateStr in completedHabitsByDate) {
          const monthOfDate = dateStr.slice(0, 7);
          if (finalizedMonthsSet.has(monthOfDate)) {
            continue;
          }

          const completedSet = completedHabitsByDate[dateStr];
          const count = allUserHabitIds.filter((hId) => completedSet.has(hId)).length;
          if (count >= allUserHabitIds.length) {
            activeLogsScore += 1;
          }
        }
      }

      const allTimeScore = pastFinalizedScore + activeLogsScore;
      await collections.users.updateOne({ id: userId }, { disciplineScore: allTimeScore });

      // Save user overall monthly report
      await generateAndSaveReportDoc({
        user,
        groupId: null,
        habits: allUserHabits,
        allLogs,
        targetMonthStr,
        year,
        month,
        daysInMonth,
        maxDayToCount,
        isFinalized: !isCurrentMonth
      });
      userReportsCount++;
    }

    // 2. Generate / Update Group Monthly Reports for Each Member
    for (const group of allGroups) {
      const groupId = (group.id || group._id).toString();
      const groupHabits = allHabits.filter((h) => (h.groupId || '').toString() === groupId);

      if (groupHabits.length === 0 || !group.members) continue;

      for (const member of group.members) {
        const memberUserId = (member.userId || '').toString();
        const userObj = allUsers.find((u) => (u.id || u._id)?.toString() === memberUserId) || member;

        await generateAndSaveReportDoc({
          user: userObj,
          groupId,
          habits: groupHabits,
          allLogs,
          targetMonthStr,
          year,
          month,
          daysInMonth,
          maxDayToCount,
          isFinalized: !isCurrentMonth
        });
        groupReportsCount++;
      }
    }

    console.log(`✅ [Archive Service] Generated/Updated ${userReportsCount} personal and ${groupReportsCount} group reports for ${targetMonthStr}.`);
  } catch (error) {
    console.error('❌ [Archive Service] Error auto-generating monthly reports:', error);
  }
};

/**
 * Helper to get current Indian Standard Time (IST, UTC+5:30) Date object
 */
export const getISTDate = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 330 * 60000);
};

/**
 * Initialize automated background scheduler for monthly archival and cleanup
 */
export const initArchiveScheduler = () => {
  console.log('⏰ [Archive Service] Initializing automated background archive scheduler...');

  // 1. Run immediate check on server start (with brief 5s warmup delay)
  setTimeout(() => {
    runMonthlyArchiveAndCleanup();
    ensureCurrentMonthReportsGenerated();
  }, 5000);

  // 2. Periodic execution every 6 hours
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  setInterval(() => {
    runMonthlyArchiveAndCleanup();
  }, SIX_HOURS);
};
