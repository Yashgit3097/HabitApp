import { collections } from '../config/db.js';
import { generateGroupMonthlyReportPDF } from './pdfReportService.js';

// Cache to prevent duplicate compliments on the same day for the same user
const sentComplimentsCache = new Set();

const MONTH_NAMES = [
  'જાન્યુઆરી', 'ફેબ્રુઆરી', 'માર્ચ', 'એપ્રિલ', 'મે', 'જૂન',
  'જુલાઈ', 'ઓગસ્ટ', 'સપ્ટેમ્બર', 'ઓક્ટોબર', 'નવેમ્બર', 'ડિસેમ્બર'
];

/**
 * Send a text message via Telegram Bot API
 */
export const sendTelegramMessage = async (text, chatIdOverride = null, parseMode = 'HTML') => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = chatIdOverride || process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('⚠️ Telegram bot token or chat ID is missing in .env. Skipping Telegram message.');
    return { success: false, reason: 'Missing token or chat ID' };
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true
      })
    });

    const data = await response.json();
    if (!data.ok) {
      console.error('❌ Telegram API error:', data.description);
      return { success: false, error: data.description };
    }

    return { success: true, messageId: data.result?.message_id };
  } catch (error) {
    console.error('❌ Failed to send Telegram message:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send a document/PDF via Telegram Bot API
 */
export const sendTelegramDocument = async ({ buffer, filename, caption = '', chatIdOverride = null }) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = chatIdOverride || process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('⚠️ Telegram bot token or chat ID is missing in .env. Skipping Telegram document.');
    return { success: false, reason: 'Missing token or chat ID' };
  }

  try {
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');

    const blob = new Blob([buffer], { type: 'application/pdf' });
    formData.append('document', blob, filename || 'Monthly_Report.pdf');

    const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    if (!data.ok) {
      console.error('❌ Telegram sendDocument error:', data.description);
      return { success: false, error: data.description };
    }

    console.log(`✅ [Telegram] Successfully sent PDF document: ${filename}`);
    return { success: true, messageId: data.result?.message_id };
  } catch (error) {
    console.error('❌ Failed to send Telegram document:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Format group monthly leaderboard summary
 */
export const formatGroupLeaderboardTelegram = (groupName, month, memberReports) => {
  const [yearStr, monthNumStr] = (month || '').split('-');
  const monthName = MONTH_NAMES[parseInt(monthNumStr, 10) - 1] || month;

  let msg = `🏆 <b>${groupName || 'સંકલ્પ ગ્રુપ'} - માસિક લીડરબોર્ડ</b>\n`;
  msg += `📅 <b>મહિનો:</b> ${monthName} ${yearStr}\n`;
  msg += `👥 <b>કુલ સભ્યો:</b> ${memberReports.length}\n\n`;
  msg += `🥇 <b>સભ્યોનું રેન્કિંગ (૧૦૦% નિયમ પાલન મુજબ):</b>\n`;

  memberReports.forEach((m, idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
    msg += `${medal} <b>${m.name}</b> (@${m.username || ''})\n`;
    msg += `   └ સ્કોર: <b>${m.disciplineScore} દિવસ</b> | સફળતા દર: <b>${m.completionRate}%</b>\n`;
  });

  msg += `\n✨ <i>બધા જ હરિભક્તોને ખૂબ ખૂબ અભિનંદન! જય સ્વામિનારાયણ</i> 🙏🏻`;
  return msg;
};

/**
 * Dynamically Compile Rich Monthly Report Data for all Group Members
 */
export const compileGroupMonthlyReports = async (group, targetMonthStr) => {
  const [yearStr, monthNumStr] = (targetMonthStr || '').split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthNumStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();

  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const maxDayToCount = isCurrentMonth ? now.getDate() : daysInMonth;

  const groupId = (group.id || group._id).toString();
  const allHabits = await collections.habits.find({ isArchived: false });
  const groupHabits = allHabits.filter((h) => (h.groupId || '').toString() === groupId);
  const groupHabitIds = groupHabits.map((h) => (h.id || h._id).toString());

  const allLogs = await collections.habitLogs.find();
  const allUsers = await collections.users.find();
  const members = group.members || [];

  const memberReports = [];

  for (const member of members) {
    const memberUserId = (member.userId || '').toString();
    const freshUser = allUsers.find((u) => (u.id || u._id)?.toString() === memberUserId);

    const userCreatedAtStr = (freshUser?.createdAt || `${targetMonthStr}-01`).split('T')[0];
    let effectiveStartDay = 1;
    if (userCreatedAtStr.startsWith(targetMonthStr)) {
      const regDay = parseInt(userCreatedAtStr.split('-')[2], 10);
      effectiveStartDay = Math.max(1, isNaN(regDay) ? 1 : regDay);
    }

    const activeDaysInMonth = Math.max(1, maxDayToCount - effectiveStartDay + 1);

    // Filter member logs strictly for this group's habits in target month
    const memberLogs = allLogs.filter((l) => {
      if ((l.userId || '').toString() !== memberUserId || !l.date || !l.date.startsWith(targetMonthStr)) {
        return false;
      }
      const logDay = parseInt(l.date.split('-')[2], 10);
      return logDay >= effectiveStartDay && logDay <= maxDayToCount && groupHabitIds.includes((l.habitId || '').toString());
    });

    // Build per-habit breakdown
    const habitSummaries = groupHabits.map((habit) => {
      const habitId = (habit.id || habit._id).toString();
      const habitLogs = memberLogs.filter((l) => (l.habitId || '').toString() === habitId);

      const completedLogs = habitLogs.filter(
        (l) =>
          Boolean(l.isCompleted) ||
          (typeof l.value === 'number' && l.value > 0) ||
          (typeof l.value === 'string' && l.value.trim().length > 0)
      );

      const completedDaysCount = completedLogs.length;
      const completionPercentage = Math.min(100, Math.round((completedDaysCount / activeDaysInMonth) * 100));

      let typeDetails = {};
      if (habit.type === 'count') {
        const totalCount = completedLogs.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
        typeDetails = {
          totalCount,
          dailyAverage: Math.round((totalCount / activeDaysInMonth) * 10) / 10
        };
      } else if (habit.type === 'time_target') {
        const totalMinutes = completedLogs.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
        typeDetails = {
          totalMinutes,
          totalHours: Number((totalMinutes / 60).toFixed(1)),
          dailyAverageMinutes: Math.round(totalMinutes / activeDaysInMonth)
        };
      } else if (habit.type === 'time_of_day') {
        typeDetails = {
          averageTime: completedLogs[0]?.value || habit.targetValue || 'N/A'
        };
      }

      return {
        habitId,
        title: habit.title,
        type: habit.type,
        targetUnit: habit.targetUnit || '',
        targetValue: habit.targetValue || '',
        completedDaysCount,
        activeDaysInMonth,
        completionPercentage,
        typeDetails
      };
    });

    // Compute Discipline Score (days with 100% group habits completed)
    const logsByDate = {};
    memberLogs.forEach((l) => {
      const isDone =
        Boolean(l.isCompleted) ||
        (typeof l.value === 'number' && l.value > 0) ||
        (typeof l.value === 'string' && l.value.trim().length > 0);

      if (isDone && l.date) {
        if (!logsByDate[l.date]) logsByDate[l.date] = new Set();
        logsByDate[l.date].add((l.habitId || '').toString());
      }
    });

    let perfectDays = 0;
    if (groupHabitIds.length > 0) {
      for (const dateStr in logsByDate) {
        if (logsByDate[dateStr].size >= groupHabitIds.length) {
          perfectDays += 1;
        }
      }
    }

    const overallCompletionRate =
      habitSummaries.length > 0
        ? Math.round(habitSummaries.reduce((sum, h) => sum + h.completionPercentage, 0) / habitSummaries.length)
        : 0;

    // Check if finalized/saved report exists in monthly_reports collection
    const allMonthlyReports = await collections.monthlyReports.find();
    const savedMemberReport = allMonthlyReports.find(
      (r) => (r.groupId || '').toString() === groupId && (r.userId || '').toString() === memberUserId && r.month === targetMonthStr
    );

    // If raw member logs are empty (e.g., historical pruned logs), seamlessly use preserved static report stats
    let disciplineScore = perfectDays;
    let overallRate = overallCompletionRate;
    let activeDays = activeDaysInMonth;
    let finalHabitSummaries = habitSummaries;

    if (memberLogs.length === 0 && savedMemberReport && savedMemberReport.habitSummaries?.length > 0) {
      disciplineScore = savedMemberReport.overallStats?.disciplineScore ?? savedMemberReport.overallStats?.perfectDays ?? 0;
      overallRate = savedMemberReport.overallStats?.overallCompletionRate ?? 0;
      activeDays = savedMemberReport.activeDaysInMonth || activeDaysInMonth;
      finalHabitSummaries = savedMemberReport.habitSummaries;
    }

    memberReports.push({
      userId: memberUserId,
      userProfile: {
        id: memberUserId,
        name: freshUser?.name || member.name || 'સભ્ય',
        username: freshUser?.username || member.username || '',
        avatar: freshUser?.avatar || member.avatar || ''
      },
      groupId,
      month: targetMonthStr,
      activeDaysInMonth: activeDays,
      overallStats: {
        totalHabits: groupHabits.length,
        perfectDays: disciplineScore,
        disciplineScore,
        overallCompletionRate: overallRate
      },
      habitSummaries: finalHabitSummaries
    });
  }

  // Sort by disciplineScore descending, then completion rate
  memberReports.sort(
    (a, b) =>
      b.overallStats.disciplineScore - a.overallStats.disciplineScore ||
      b.overallStats.overallCompletionRate - a.overallStats.overallCompletionRate
  );

  return memberReports;
};

/**
 * Broadcast group monthly reports as a PDF Book (Page 1 = Leaderboard/Summary, Pages 2..N = 1 page per member)
 */
export const sendGroupReportsToTelegram = async (groupId, month = null, chatIdOverride = null) => {
  try {
    const group = await collections.groups.findById(groupId);
    if (!group) return { success: false, message: 'Group not found' };

    const now = new Date();
    const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    console.log(`📊 [Telegram] Compiling live monthly report data for ${group.name} (${targetMonth})...`);
    const groupReports = await compileGroupMonthlyReports(group, targetMonth);

    if (groupReports.length === 0) {
      console.warn(`No member reports compiled for group ${groupId} and month ${targetMonth}`);
      return { success: false, message: 'No reports compiled' };
    }

    const [yearStr, monthNumStr] = (targetMonth || '').split('-');
    const monthName = MONTH_NAMES[parseInt(monthNumStr, 10) - 1] || targetMonth;

    console.log(`📄 [PDF Generator] Generating monthly PDF report book for ${group.name} (${targetMonth}) with ${groupReports.length} members...`);
    const pdfBuffer = await generateGroupMonthlyReportPDF(group, targetMonth, groupReports);

    const filename = `${(group.name || 'Group').replace(/[^a-zA-Z0-9]/g, '_')}_Report_${targetMonth}.pdf`;
    const caption = `📊 <b>${group.name} - માસિક પ્રગતિ અહેવાલ PDF (${monthName} ${yearStr})</b>\n\n` +
      `📄 <b>આ PDF રિપોર્ટ બુકમાં સામેલ છે:</b>\n` +
      `• <b>પેજ ૧:</b> ગ્રુપ સારાંશ અને માસિક લીડરબોર્ડ 🏆\n` +
      `• <b>પેજ ૨ થી ${groupReports.length + 1}:</b> તમામ ${groupReports.length} સભ્યોના વિગતવાર પર્સનલ રિપોર્ટ પેજ 📝\n\n` +
      `✨ <i>જય સ્વામિનારાયણ</i> 🙏🏻`;

    const sendRes = await sendTelegramDocument({
      buffer: pdfBuffer,
      filename,
      caption,
      chatIdOverride
    });

    if (sendRes.success) {
      console.log(`✅ [Telegram] Broadcasted PDF Monthly Report Book to Telegram.`);
      try {
        await collections.groups.updateOne({ id: groupId.toString() }, { lastTelegramReportMonth: targetMonth });
      } catch (saveErr) {
        console.warn('⚠️ Could not update lastTelegramReportMonth on group:', saveErr.message);
      }
      return { success: true, filename, totalPages: groupReports.length + 1 };
    } else {
      console.warn('⚠️ PDF send failed, falling back to text leaderboard:', sendRes.error);
      const leaderboardData = groupReports.map((r) => ({
        name: r.userProfile?.name || 'Unknown',
        username: r.userProfile?.username || '',
        disciplineScore: r.overallStats?.disciplineScore || 0,
        completionRate: r.overallStats?.overallCompletionRate || 0
      }));
      const leaderboardMsg = formatGroupLeaderboardTelegram(group.name, targetMonth, leaderboardData);
      await sendTelegramMessage(leaderboardMsg, chatIdOverride);
      return { success: true, fallback: true };
    }
  } catch (error) {
    console.error('❌ Error broadcasting PDF report to Telegram:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check and Send Daily 100% Completion Compliment
 * Triggered whenever a member completes all group habits for today
 */
export const checkAndSendDailyCompliment = async (userId, groupId, dateStr = null) => {
  try {
    if (!userId || !groupId) return false;
    const targetUserId = userId.toString();
    const targetGroupId = groupId.toString();
    const todayStr = dateStr || new Date().toISOString().split('T')[0];

    const cacheKey = `${todayStr}:${targetGroupId}:${targetUserId}`;
    if (sentComplimentsCache.has(cacheKey)) {
      return false; // Already complimented today
    }

    const groupHabits = await collections.habits.find({ groupId: targetGroupId, isArchived: false });
    if (groupHabits.length === 0) return false;

    const groupHabitIds = groupHabits.map((h) => (h.id || h._id).toString());
    const allLogs = await collections.habitLogs.find();
    const userTodayLogs = allLogs.filter(
      (l) => (l.userId || '').toString() === targetUserId && l.date === todayStr
    );

    // Check if each group habit has a completed log
    const completedHabitIds = new Set();
    for (const log of userTodayLogs) {
      const isDone =
        Boolean(log.isCompleted) ||
        (typeof log.value === 'number' && log.value > 0) ||
        (typeof log.value === 'string' && log.value.trim().length > 0);

      if (isDone && groupHabitIds.includes((log.habitId || '').toString())) {
        completedHabitIds.add((log.habitId || '').toString());
      }
    }

    // If 100% completed all group habits today
    if (completedHabitIds.size >= groupHabitIds.length) {
      sentComplimentsCache.add(cacheKey);

      const user = await collections.users.findById(targetUserId);
      const group = await collections.groups.findById(targetGroupId);
      const userName = user?.name || 'સભ્ય';
      const username = user?.username ? `@${user.username}` : '';
      const groupName = group?.name || 'સંકલ્પ ગ્રુપ';

      const complimentMsg = `🌟 <b>અભિનંદન! આજનું ૧૦૦% નિયમ પાલન!</b> 🌟\n\n` +
        `👤 <b>${userName}</b> ${username ? `(${username})` : ''} એ <b>${groupName}</b> ના આજના બધા જ (${groupHabits.length}/${groupHabits.length}) સંકલ્પ ૧૦૦% પૂર્ણ કર્યા છે! 👏🏻🎉\n\n` +
        `🏆 <b>Discipline Score +1</b>\n` +
        `✨ <i>આવી જ રીતે નિયમ પાળતા રહો! જય સ્વામિનારાયણ</i> 🙏🏻`;

      await sendTelegramMessage(complimentMsg);
      console.log(`🎉 [Telegram] Sent daily 100% compliment for ${userName} (${username})`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('❌ Error checking/sending daily compliment:', error);
    return false;
  }
};

/**
 * Send Daily Pending Habits Reminder for the Group
 * Lists all members who still have incomplete group habits for the evaluated date
 */
export const sendDailyPendingRemindersTelegram = async (groupId, dateStr = null) => {
  try {
    const targetDateStr = dateStr || new Date().toISOString().split('T')[0];
    const group = await collections.groups.findById(groupId);
    if (!group || !group.members || group.members.length === 0) return { success: false, message: 'Group not found' };

    const groupHabits = await collections.habits.find({
      groupId: (group.id || group._id).toString(),
      isArchived: false
    });

    if (groupHabits.length === 0) return { success: false, message: 'No group habits found' };

    const totalGroupHabits = groupHabits.length;
    const groupHabitIds = groupHabits.map((h) => (h.id || h._id).toString());

    const allLogs = await collections.habitLogs.find();
    const targetLogs = allLogs.filter((l) => l.date === targetDateStr);

    const pendingMembers = [];
    const completedMembers = [];

    for (const member of group.members) {
      const memberUserId = (member.userId || '').toString();
      const memberLogs = targetLogs.filter((l) => (l.userId || '').toString() === memberUserId);

      const completedCount = groupHabitIds.filter((hId) =>
        memberLogs.some((l) => {
          const isDone =
            Boolean(l.isCompleted) ||
            (typeof l.value === 'number' && logValuePositive(l.value));
          return isDone && (l.habitId || '').toString() === hId;
        })
      ).length;

      const remainingCount = totalGroupHabits - completedCount;

      if (remainingCount > 0) {
        pendingMembers.push({
          name: member.name,
          username: member.username,
          completedCount,
          remainingCount
        });
      } else {
        completedMembers.push({
          name: member.name,
          username: member.username
        });
      }
    }

    const [year, month, day] = targetDateStr.split('-');
    const dateFormatted = `${day}-${month}-${year}`;

    if (pendingMembers.length === 0) {
      const allDoneMsg = `🎉 <b>અદભુત! આજના બધા જ સંકલ્પ ૧૦૦% પૂર્ણ!</b> 🌟\n\n` +
        `📅 <b>તારીખ:</b> ${dateFormatted}\n` +
        `👥 <b>${group.name}</b> ના બધા જ ${group.members.length} સભ્યોએ આજના તમામ ગ્રુપ નિયમ ૧૦૦% સફળતાપૂર્વક પૂર્ણ કર્યા છે! 👏🏻🎊\n\n` +
        `🏆 <i>બધા જ હરિભક્તોને ખૂબ ખૂબ અભિનંદન! આવી જ રીતે નિયમિત નિયમ પાળતા રહો!</i>\n\n` +
        `✨ <i>જય સ્વામિનારાયણ</i> 🙏🏻`;
      await sendTelegramMessage(allDoneMsg);
      return { success: true, allDone: true };
    }

    let msg = `📋 <b>${group.name} - દૈનિક સારાંશ / બાકી નિયમ (${dateFormatted})</b>\n\n`;
    msg += `<i>જય સ્વામિનારાયણ</i> 🙏🏻\n`;
    msg += `તારીખ <b>${dateFormatted}</b> ના જે સભ્યોના ગ્રુપ નિયમ બાકી રહી ગયા છે તેમની યાદી:\n\n`;

    pendingMembers.forEach((m) => {
      const userTag = m.username ? `@${m.username}` : '';
      msg += `• 👤 <b>${m.name}</b> ${userTag ? `(${userTag})` : ''} ➔ <b>${m.remainingCount} નિયમ બાકી</b> (${m.completedCount}/${totalGroupHabits})\n`;
    });

    if (completedMembers.length > 0) {
      msg += `\n👏🏻 <b>૧૦૦% નિયમ પૂર્ણ કરનાર સભ્યો (${completedMembers.length}):</b>\n`;
      msg += completedMembers.map((m) => `✅ ${m.name}`).join(', ') + '\n';
    }

    msg += `\n💪 <i>ચાલો આપણે બધા સાથે મળીને નિયમિત નિયમ પાળીએ!</i> ✨`;

    await sendTelegramMessage(msg);
    console.log(`📋 [Telegram] Broadcasted daily pending reminder (${pendingMembers.length} pending members).`);
    return { success: true, pendingCount: pendingMembers.length };
  } catch (error) {
    console.error('❌ Error sending pending reminders to Telegram:', error);
    return { success: false, error: error.message };
  }
};

const logValuePositive = (val) => {
  if (typeof val === 'number') return val > 0;
  if (typeof val === 'string') return val.trim().length > 0;
  return false;
};
