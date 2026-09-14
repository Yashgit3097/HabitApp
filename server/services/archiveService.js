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

/**
 * Background Monthly Archival and Pruning Service
 * Runs on or after the 5th date of the month (day >= 5).
 * Freezes & persists the previous month's overall report in `monthly_reports`.
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

    // Condition: Only archive & cleanup after date 5 of the month
    if (currentDay < 5) {
      console.log(`ℹ️ [Archive Service] Today is day ${currentDay}. Archival for previous month runs on or after the 5th date.`);
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
    const allLogs = await collections.habitLogs.find();

    let reportsGenerated = 0;

    for (const user of allUsers) {
      const userId = (user.id || user._id).toString();

      // Check if report already exists and is finalized
      const existingReport = await collections.monthlyReports.findOne({
        userId,
        month: prevMonthStr,
        groupId: null
      });

      if (existingReport && existingReport.status === 'finalized') {
        continue;
      }

      // Check user registration date to handle first month offset
      const userCreatedAtStr = (user.createdAt || `${prevMonthStr}-01`).split('T')[0];
      const userRegMonth = userCreatedAtStr.slice(0, 7);

      let effectiveStartDay = 1;
      if (userRegMonth === prevMonthStr) {
        const regDay = parseInt(userCreatedAtStr.split('-')[2], 10);
        effectiveStartDay = Math.max(1, isNaN(regDay) ? 1 : regDay);
      }

      const activeDaysInMonth = Math.max(1, daysInPrevMonth - effectiveStartDay + 1);

      // Personal habits
      const personalHabits = allHabits.filter(
        (h) => (h.userId || '').toString() === userId && !h.groupId
      );

      const userMonthLogs = allLogs.filter(
        (l) => (l.userId || '').toString() === userId && l.date && l.date.startsWith(prevMonthStr)
      );

      const habitSummaries = personalHabits.map((habit) => {
        const habitId = (habit.id || habit._id).toString();
        const habitLogs = userMonthLogs.filter((l) => (l.habitId || '').toString() === habitId);
        const completedLogs = habitLogs.filter((l) => l.isCompleted);
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
      });

      // Perfect days calculation
      const logsByDate = {};
      userMonthLogs.forEach((l) => {
        if (!logsByDate[l.date]) logsByDate[l.date] = [];
        logsByDate[l.date].push(l);
      });

      let perfectDaysInMonth = 0;
      if (personalHabits.length > 0) {
        for (let d = effectiveStartDay; d <= daysInPrevMonth; d++) {
          const dateKey = formatDate(prevYear, prevMonth, d);
          const dayLogs = logsByDate[dateKey] || [];
          if (dayLogs.filter((l) => l.isCompleted).length >= personalHabits.length) {
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
        groupId: null,
        month: prevMonthStr,
        year: prevYear,
        monthNumber: prevMonth,
        daysInMonth: daysInPrevMonth,
        effectiveStartDay,
        activeDaysInMonth,
        isFirstMonth: userRegMonth === prevMonthStr,
        overallStats: {
          totalHabits: personalHabits.length,
          perfectDays: perfectDaysInMonth,
          disciplineScore: perfectDaysInMonth,
          overallCompletionRate
        },
        habitSummaries,
        adminRemarks: 'Monthly report automatically finalized on date 5.',
        status: 'finalized',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (existingReport) {
        await collections.monthlyReports.updateOne(
          { id: existingReport.id || existingReport._id },
          reportDoc
        );
      } else {
        await collections.monthlyReports.insertOne(reportDoc);
      }

      reportsGenerated++;
    }

    console.log(`✅ [Archive Service] Finalized ${reportsGenerated} user reports for ${prevMonthStr}.`);

    // Clean up daily logs strictly from prior months that have completed reports
    // Strict Safety Assertion: Current month data is NEVER deleted. Only previous months data is pruned after archiving.
    let logsDeleted = 0;
    const oldLogs = allLogs.filter((l) => {
      if (!l.date) return false;
      // Guard 1: Never match any log from current active month (e.g. 2026-09)
      if (l.date.startsWith(currentMonthStr)) return false;
      // Guard 2: Never match any future logs or logs past the end of previous month
      if (l.date > `${prevMonthStr}-${daysInPrevMonth}`) return false;
      // Guard 3: Only match logs strictly belonging to previous months (e.g. <= 2026-08-31)
      return true;
    });

    // If reports for prevMonth are securely sealed, delete old raw logs to keep DB clean
    if (reportsGenerated >= 0 && oldLogs.length > 0) {
      for (const oldLog of oldLogs) {
        const id = oldLog.id || oldLog._id;
        if (id) {
          await collections.habitLogs.deleteOne({ id });
          logsDeleted++;
        }
      }
      console.log(`🧹 [Archive Service] Cleaned up ${logsDeleted} raw daily logs strictly from previous month (${prevMonthStr}) and older. Current month (${currentMonthStr}) logs remain 100% untouched.`);
    }
  } catch (error) {
    console.error('❌ [Archive Service] Error running monthly archival:', error);
  }
};

/**
 * Auto-generate or update current month report documents for all users
 * This ensures on Day 1 of any month (and continuously), monthly report documents exist in DB.
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

    let createdCount = 0;
    let updatedCount = 0;

    for (const user of allUsers) {
      const userId = (user.id || user._id).toString();

      // Find user habits (Personal + Joined Group Habits)
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

      // 1. Calculate All-Time Discipline Score
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

      let allTimeScore = 0;
      if (allUserHabitIds.length > 0) {
        for (const dateStr in completedHabitsByDate) {
          const completedSet = completedHabitsByDate[dateStr];
          const count = allUserHabitIds.filter((hId) => completedSet.has(hId)).length;
          if (count >= allUserHabitIds.length) {
            allTimeScore += 1;
          }
        }
      }

      // Update user disciplineScore in database
      await collections.users.updateOne({ id: userId }, { disciplineScore: allTimeScore });

      // 2. Build Current Month Report Document
      const userMonthLogs = userAllLogs.filter((l) => l.date && l.date.startsWith(targetMonthStr));

      const userCreatedAtStr = (user.createdAt || `${targetMonthStr}-01`).split('T')[0];
      const userRegMonth = userCreatedAtStr.slice(0, 7);

      let effectiveStartDay = 1;
      if (userRegMonth === targetMonthStr) {
        const regDay = parseInt(userCreatedAtStr.split('-')[2], 10);
        effectiveStartDay = Math.max(1, isNaN(regDay) ? 1 : regDay);
      }

      const activeDaysInMonth = Math.max(1, maxDayToCount - effectiveStartDay + 1);

      const habitSummaries = allUserHabits.map((habit) => {
        const habitId = (habit.id || habit._id).toString();
        const habitLogs = userMonthLogs.filter((l) => (l.habitId || '').toString() === habitId);
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
      });

      // Perfect days calculation for current month
      const monthLogsByDate = {};
      for (const log of userMonthLogs) {
        const isDone =
          Boolean(log.isCompleted) ||
          (typeof log.value === 'number' && log.value > 0) ||
          (typeof log.value === 'string' && log.value.trim().length > 0);

        if (isDone && log.date) {
          if (!monthLogsByDate[log.date]) {
            monthLogsByDate[log.date] = new Set();
          }
          monthLogsByDate[log.date].add((log.habitId || '').toString());
        }
      }

      let perfectDaysInMonth = 0;
      if (allUserHabitIds.length > 0) {
        for (const dateStr in monthLogsByDate) {
          const completedSet = monthLogsByDate[dateStr];
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

      const reportDoc = {
        userId,
        userProfile: {
          id: userId,
          name: user.name,
          username: user.username,
          avatar: user.avatar
        },
        groupId: null,
        month: targetMonthStr,
        year,
        monthNumber: month,
        daysInMonth,
        effectiveStartDay,
        activeDaysInMonth,
        isFirstMonth: userRegMonth === targetMonthStr,
        overallStats: {
          totalHabits: allUserHabits.length,
          perfectDays: perfectDaysInMonth,
          disciplineScore: perfectDaysInMonth,
          overallCompletionRate
        },
        habitSummaries,
        adminRemarks: '',
        status: isCurrentMonth ? 'in_progress' : 'finalized',
        updatedAt: new Date().toISOString()
      };

      // Check if document already exists
      const existing = await collections.monthlyReports.findOne({
        userId,
        month: targetMonthStr,
        groupId: null
      });

      if (existing && (existing.id || existing._id)) {
        await collections.monthlyReports.updateOne(
          { id: existing.id || existing._id },
          reportDoc
        );
        updatedCount++;
      } else {
        await collections.monthlyReports.insertOne(reportDoc);
        createdCount++;
      }
    }

    console.log(`✅ [Archive Service] Generated ${createdCount} new and updated ${updatedCount} monthly reports for ${targetMonthStr}.`);
  } catch (error) {
    console.error('❌ [Archive Service] Error auto-generating monthly reports:', error);
  }
};

/**
 * Initialize background schedule
 */
export const initArchiveScheduler = () => {
  // 1. Immediately ensure current month documents are generated on server startup (after 2s)
  setTimeout(() => {
    ensureCurrentMonthReportsGenerated();
  }, 2000);

  // 2. Run previous month archival on/after day 5 (after 10s)
  setTimeout(() => {
    runMonthlyArchiveAndCleanup();
  }, 10000);

  // 3. Repeat monthly reports sync every 2 hours
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  setInterval(() => {
    ensureCurrentMonthReportsGenerated();
  }, TWO_HOURS);

  // 4. Repeat archival check every 6 hours
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  setInterval(() => {
    runMonthlyArchiveAndCleanup();
  }, SIX_HOURS);
};
