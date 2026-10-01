import { collections } from '../config/db.js';

// Cache to prevent duplicate compliments on the same day for the same user
const sentComplimentsCache = new Set();

/**
 * Send a message via Telegram Bot API
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
 * Format a single member's Group Monthly Report into a Telegram HTML message
 * (Strictly only group habits, never personal ones)
 */
export const formatGroupMemberReportTelegram = (report, groupName = 'સંકલ્પ ગ્રુપ') => {
  const { userProfile, month, overallStats, habitSummaries, activeDaysInMonth } = report;
  const userName = userProfile?.name || 'સભ્ય';
  const username = userProfile?.username ? `@${userProfile.username}` : '';

  const [yearStr, monthNumStr] = (month || '').split('-');
  const monthNames = [
    'જાન્યુઆરી', 'ફેબ્રુઆરી', 'માર્ચ', 'એપ્રિલ', 'મે', 'જૂન',
    'જુલાઈ', 'ઓગસ્ટ', 'સપ્ટેમ્બર', 'ઓક્ટોબર', 'નવેમ્બર', 'ડિસેમ્બર'
  ];
  const monthName = monthNames[parseInt(monthNumStr, 10) - 1] || month;

  let msg = `📊 <b>${groupName} - માસિક રિપોર્ટ (${monthName} ${yearStr})</b>\n`;
  msg += `👤 <b>સભ્ય:</b> ${userName} ${username ? `(${username})` : ''}\n`;
  msg += `🏆 <b>Discipline Score:</b> ${overallStats?.disciplineScore || 0} / ${activeDaysInMonth} દિવસ (૧૦૦% નિયમ પાલન)\n`;
  msg += `📈 <b>ગ્રુપ સફળતા દર:</b> ${overallStats?.overallCompletionRate || 0}%\n\n`;
  msg += `📝 <b>ગ્રુપ નિયમ વિગતવાર પ્રગતિ:</b>\n`;

  (habitSummaries || []).forEach((h) => {
    let details = '';
    if (h.type === 'yes_no' || h.type === 'boolean') {
      details = `<b>${h.completedDaysCount} / ${activeDaysInMonth} દિવસ</b> (${h.completionPercentage}%)`;
    } else if (h.type === 'count') {
      const total = h.typeDetails?.totalCount || 0;
      const unit = h.targetUnit || '';
      const avg = h.typeDetails?.dailyAverage || 0;
      details = `<b>${total.toLocaleString()} ${unit}</b> (${h.completionPercentage}%, રોજ સરેરાશ ${avg})`;
    } else if (h.type === 'time_target') {
      const hrs = h.typeDetails?.totalHours || 0;
      const mins = h.typeDetails?.totalMinutes || 0;
      const timeStr = hrs >= 1 ? `${hrs} કલાક` : `${mins} મિનિટ`;
      details = `<b>${timeStr}</b> (${h.completionPercentage}%, ${h.completedDaysCount}/${activeDaysInMonth} દિવસ)`;
    } else if (h.type === 'time_of_day') {
      details = `<b>${h.completedDaysCount} / ${activeDaysInMonth} દિવસ</b> (સરેરાશ ${h.typeDetails?.averageTime || 'N/A'})`;
    } else {
      details = `<b>${h.completedDaysCount} / ${activeDaysInMonth} દિવસ</b> (${h.completionPercentage}%)`;
    }

    msg += `• <b>${h.title}</b>: ${details}\n`;
  });

  msg += `\n🌟 <i>જય સ્વામિનારાયણ</i> 🙏🏻`;
  return msg;
};

/**
 * Format group monthly leaderboard summary
 */
export const formatGroupLeaderboardTelegram = (groupName, month, memberReports) => {
  const [yearStr, monthNumStr] = (month || '').split('-');
  const monthNames = [
    'જાન્યુઆરી', 'ફેબ્રુઆરી', 'માર્ચ', 'એપ્રિલ', 'મે', 'જૂન',
    'જુલાઈ', 'ઓગસ્ટ', 'સપ્ટેમ્બર', 'ઓક્ટોબર', 'નવેમ્બર', 'ડિસેમ્બર'
  ];
  const monthName = monthNames[parseInt(monthNumStr, 10) - 1] || month;

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
 * Broadcast group monthly reports strictly (Only Group Habits, Never Personal)
 */
export const sendGroupReportsToTelegram = async (groupId, month, chatIdOverride = null) => {
  try {
    const group = await collections.groups.findById(groupId);
    if (!group) return { success: false, message: 'Group not found' };

    const allMonthlyReports = await collections.monthlyReports.find();
    // Strictly filter by groupId
    const groupReports = allMonthlyReports.filter(
      (r) => (r.groupId || '').toString() === groupId.toString() && r.month === month
    );

    if (groupReports.length === 0) {
      console.warn(`No monthly reports found for group ${groupId} and month ${month}`);
      return { success: false, message: 'No reports found' };
    }

    // Sort by disciplineScore descending
    groupReports.sort(
      (a, b) =>
        (b.overallStats?.disciplineScore || 0) - (a.overallStats?.disciplineScore || 0) ||
        (b.overallStats?.overallCompletionRate || 0) - (a.overallStats?.overallCompletionRate || 0)
    );

    // 1. Send Leaderboard Summary
    const leaderboardData = groupReports.map((r) => ({
      name: r.userProfile?.name || 'Unknown',
      username: r.userProfile?.username || '',
      disciplineScore: r.overallStats?.disciplineScore || 0,
      completionRate: r.overallStats?.overallCompletionRate || 0
    }));

    const leaderboardMsg = formatGroupLeaderboardTelegram(group.name, month, leaderboardData);
    await sendTelegramMessage(leaderboardMsg, chatIdOverride);
    await new Promise((res) => setTimeout(res, 1500));

    // 2. Send Individual Group Reports for each member
    let sentCount = 0;
    for (const report of groupReports) {
      const reportMsg = formatGroupMemberReportTelegram(report, group.name);
      await sendTelegramMessage(reportMsg, chatIdOverride);
      sentCount++;
      await new Promise((res) => setTimeout(res, 1200));
    }

    console.log(`✅ [Telegram] Broadcasted ${sentCount} group member reports to Telegram.`);
    return { success: true, sentCount };
  } catch (error) {
    console.error('❌ Error broadcasting group reports to Telegram:', error);
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
 * Lists all members who still have incomplete group habits for today
 */
export const sendDailyPendingRemindersTelegram = async (groupId, dateStr = null) => {
  try {
    const todayStr = dateStr || new Date().toISOString().split('T')[0];
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
    const todayLogs = allLogs.filter((l) => l.date === todayStr);

    const pendingMembers = [];
    const completedMembers = [];

    for (const member of group.members) {
      const memberUserId = (member.userId || '').toString();
      const memberLogs = todayLogs.filter((l) => (l.userId || '').toString() === memberUserId);

      const completedCount = groupHabitIds.filter((hId) =>
        memberLogs.some((l) => {
          const isDone =
            Boolean(l.isCompleted) ||
            (typeof l.value === 'number' && l.value > 0) ||
            (typeof l.value === 'string' && l.value.trim().length > 0);
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

    // Format Reminder Message
    const [year, month, day] = todayStr.split('-');
    const dateFormatted = `${day}-${month}-${year}`;

    if (pendingMembers.length === 0) {
      const allDoneMsg = `🎉 <b>અદભુત! આજના બધા જ સંકલ્પ પૂર્ણ!</b>\n\n` +
        `📅 <b>તારીખ:</b> ${dateFormatted}\n` +
        `👥 <b>${group.name}</b> ના બધા જ ${group.members.length} સભ્યોએ આજના નિયમ ૧૦૦% પૂર્ણ કર્યા છે! 🌟\n\n` +
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
    console.log(`📋 [Telegram] Broadcasted daily pending reminders (${pendingMembers.length} pending members).`);
    return { success: true, pendingCount: pendingMembers.length };
  } catch (error) {
    console.error('❌ Error sending pending reminders to Telegram:', error);
    return { success: false, error: error.message };
  }
};
