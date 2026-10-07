import { ZipArchive } from 'archiver';
import stream from 'stream';
import mongoose from 'mongoose';
import { collections } from '../config/db.js';
import {
  compileGroupTaskLeaderboards,
  generateGroupTaskLeaderboardPDF
} from './pdfReportService.js';

const GUJARATI_MONTH_NAMES = [
  'જાન્યુઆરી',
  'ફેબ્રુઆરી',
  'માર્ચ',
  'એપ્રિલ',
  'મે',
  'જૂન',
  'જુલાઈ',
  'ઓગસ્ટ',
  'સપ્ટેમ્બર',
  'ઓક્ટોબર',
  'નવેમ્બર',
  'ડિસેમ્બર'
];

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
 * Get current Indian Standard Time (IST, UTC+5:30) Date
 */
export const getISTDate = (date = new Date()) => {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + 330 * 60000);
};

/**
 * Format IST Date to YYYY-MM-DD
 */
export const getISTDateString = (date = new Date()) => {
  const ist = getISTDate(date);
  const year = ist.getFullYear();
  const month = String(ist.getMonth() + 1).padStart(2, '0');
  const day = String(ist.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Format IST Month to YYYY-MM
 */
export const getISTMonthString = (date = new Date()) => {
  const ist = getISTDate(date);
  const year = ist.getFullYear();
  const month = String(ist.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * Send a Telegram text message using the Bot API
 */
export const sendTelegramMessage = async (text, options = {}) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = options.chatId || process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('⚠️ [Telegram] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment variables.');
    return { success: false, message: 'Telegram credentials missing in .env' };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const parseMode = options.parseMode || 'HTML';

  // Telegram message limit is 4096 characters. Split if exceeded.
  const chunks = [];
  let remainingText = text;
  while (remainingText.length > 0) {
    if (remainingText.length <= 4000) {
      chunks.push(remainingText);
      break;
    }
    // Find last newline before 4000 limit
    let splitIndex = remainingText.lastIndexOf('\n', 4000);
    if (splitIndex === -1 || splitIndex < 1000) {
      splitIndex = 4000;
    }
    chunks.push(remainingText.substring(0, splitIndex));
    remainingText = remainingText.substring(splitIndex).trim();
  }

  const results = [];
  for (const chunk of chunks) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
          parse_mode: parseMode,
          disable_web_page_preview: options.disableWebPagePreview ?? true
        })
      });

      const data = await response.json();
      if (!data.ok) {
        console.error('❌ [Telegram] sendMessage failed:', data);
        results.push({ success: false, error: data });
      } else {
        results.push({ success: true, messageId: data.result?.message_id });
      }
    } catch (err) {
      console.error('❌ [Telegram] Error sending message:', err.message);
      results.push({ success: false, error: err.message });
    }
  }

  const allSuccess = results.every((r) => r.success);
  return { success: allSuccess, results };
};

/**
 * Send a Telegram Document / File (Buffer) using the Bot API
 */
export const sendTelegramDocument = async (fileBuffer, filename, caption = '', options = {}) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = options.chatId || process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('⚠️ [Telegram] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID.');
    return { success: false, message: 'Telegram credentials missing' };
  }

  const url = `https://api.telegram.org/bot${token}/sendDocument`;

  try {
    const formData = new FormData();
    formData.append('chat_id', chatId);

    const blob = new Blob([fileBuffer], {
      type: options.contentType || 'application/octet-stream'
    });
    formData.append('document', blob, filename);

    if (caption) {
      formData.append('caption', caption.substring(0, 1024)); // Telegram caption limit 1024 chars
      formData.append('parse_mode', options.parseMode || 'HTML');
    }

    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    if (!data.ok) {
      console.error('❌ [Telegram] sendDocument failed:', data);
      return { success: false, error: data };
    }

    console.log(`✅ [Telegram] Successfully sent document "${filename}" to chat ${chatId}`);
    return { success: true, messageId: data.result?.message_id };
  } catch (err) {
    console.error('❌ [Telegram] Error sending document:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * 1. DAILY END-OF-DAY GROUP COMPLIANCE & ABSENT REPORT
 * Compiles today's compliance for each group and sends categorized Telegram reports:
 * - 🌟 100% Done (Perfect Day)
 * - ⚠️ Incomplete / Partial (lists pending habits)
 * - ❌ 0% Done (Not done anything today)
 */
export const sendDailyGroupComplianceReport = async (targetDateStr = null) => {
  try {
    const todayStr = targetDateStr || getISTDateString();
    const [year, month, day] = todayStr.split('-');
    const formattedDate = `${day}-${month}-${year}`;

    console.log(`📡 [Telegram Daily Report] Generating report for date: ${todayStr} (${formattedDate})...`);

    const allGroups = await collections.groups.find();
    const activeGroups = allGroups.filter((g) => !g.isArchived);

    if (activeGroups.length === 0) {
      console.log('ℹ️ [Telegram Daily Report] No active groups found.');
      return { success: true, message: 'No active groups found' };
    }

    const allHabits = await collections.habits.find({ isArchived: false });
    const allLogs = await collections.habitLogs.find();
    const allUsers = await collections.users.find();

    const reportsSent = [];

    for (const group of activeGroups) {
      const groupId = (group.id || group._id).toString();
      const groupHabits = allHabits.filter((h) => (h.groupId || '').toString() === groupId);

      if (groupHabits.length === 0 || !group.members || group.members.length === 0) {
        continue;
      }

      const groupHabitIds = groupHabits.map((h) => (h.id || h._id).toString());
      const totalGroupHabitsCount = groupHabits.length;

      // Filter today's logs for this group's habits
      const groupDayLogs = allLogs.filter((l) => {
        return l.date === todayStr && groupHabitIds.includes((l.habitId || '').toString());
      });

      const perfectMembers = [];
      const partialMembers = [];
      const absentMembers = [];

      let totalCompletedTasks = 0;
      const totalPossibleTasks = totalGroupHabitsCount * group.members.length;

      for (const member of group.members) {
        const memberUserId = (member.userId || '').toString();
        const userObj = allUsers.find((u) => (u.id || u._id)?.toString() === memberUserId);
        const memberName = userObj?.name || member.name || 'Unknown';

        // Find which habits the user completed today
        const userCompletedHabitIds = new Set();
        groupDayLogs.forEach((l) => {
          if ((l.userId || '').toString() === memberUserId) {
            if (isLogDone(l)) {
              userCompletedHabitIds.add((l.habitId || '').toString());
            }
          }
        });

        const completedCount = userCompletedHabitIds.size;
        totalCompletedTasks += completedCount;

        if (completedCount >= totalGroupHabitsCount) {
          // 100% Completed
          perfectMembers.push({
            name: memberName,
            username: userObj?.username || member.username || ''
          });
        } else if (completedCount > 0) {
          // Partial: find pending habits
          const pendingHabits = groupHabits
            .filter((h) => !userCompletedHabitIds.has((h.id || h._id).toString()))
            .map((h) => h.title);

          partialMembers.push({
            name: memberName,
            username: userObj?.username || member.username || '',
            completedCount,
            totalCount: totalGroupHabitsCount,
            pendingHabits
          });
        } else {
          // 0% Absent / Nothing done
          absentMembers.push({
            name: memberName,
            username: userObj?.username || member.username || ''
          });
        }
      }

      const groupComplianceRate =
        totalPossibleTasks > 0
          ? Math.round((totalCompletedTasks / totalPossibleTasks) * 100)
          : 0;

      // Construct Telegram HTML message
      let msg = `✨ <b>સંકલ્પ હેબિટ ટ્રેકર - દૈનિક ગ્રુપ રિપોર્ટ</b> ✨\n`;
      msg += `📅 <b>તારીખ</b>: <code>${formattedDate}</code>\n`;
      msg += `👥 <b>ગ્રુપ</b>: <b>${group.name || 'Sankalp Group'}</b>\n`;
      msg += `📊 <b>આજનું ગ્રુપ પાલન</b>: <b>${groupComplianceRate}%</b> (${totalCompletedTasks}/${totalPossibleTasks} નિયમો પૂર્ણ)\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

      // 1. 100% Compliant Members
      msg += `🌟 <b>૧૦૦% નિયમ પાલન (Perfect Day) [${perfectMembers.length}]:</b>\n`;
      if (perfectMembers.length > 0) {
        perfectMembers.forEach((m) => {
          const userTag = m.username ? ` (@${m.username})` : '';
          msg += `  ✅ <b>${m.name}</b>${userTag}\n`;
        });
      } else {
        msg += `  <i>આજે કોઈએ ૧૦૦% નિયમો પૂર્ણ કર્યા નથી.</i>\n`;
      }
      msg += `\n`;

      // 2. Partial / Incomplete Members
      msg += `⚠️ <b>બાકી નિયમો (અધૂરી પ્રગતિ) [${partialMembers.length}]:</b>\n`;
      if (partialMembers.length > 0) {
        partialMembers.forEach((m) => {
          const userTag = m.username ? ` (@${m.username})` : '';
          const pendingStr = m.pendingHabits.join(', ');
          msg += `  ⏳ <b>${m.name}</b>${userTag} (${m.completedCount}/${m.totalCount})\n`;
          msg += `     ↳ <i>બાકી: ${pendingStr}</i>\n`;
        });
      } else {
        msg += `  <i>કોઈ અધૂરી પ્રગતિ નથી.</i>\n`;
      }
      msg += `\n`;

      // 3. 0% Absent Members
      msg += `❌ <b>આજે એકપણ નિયમ નથી કર્યો (૦% પ્રગતિ) [${absentMembers.length}]:</b>\n`;
      if (absentMembers.length > 0) {
        absentMembers.forEach((m) => {
          const userTag = m.username ? ` (@${m.username})` : '';
          msg += `  ❌ <b>${m.name}</b>${userTag}\n`;
        });
      } else {
        msg += `  <i>બધા જ સભ્યોએ ઓછામાં ઓછો એક નિયમ કર્યો છે! 🎉</i>\n`;
      }

      msg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `🙏 <i>"નિયમ અને સંકલ્પનું દ્રઢ પાલન એ જ ભક્તિનું બળ છે."</i>\n`;
      msg += `👉 <i>હવે તમારો નિયમ પૂરો કરો:</i> <a href="https://habitsankalp.netlify.app">Sankalp Habit App</a>\n`;

      const sendRes = await sendTelegramMessage(msg);
      reportsSent.push({ groupId, groupName: group.name, result: sendRes });
    }

    console.log(`✅ [Telegram Daily Report] Sent daily compliance reports for ${reportsSent.length} group(s).`);
    return { success: true, reportsSent };
  } catch (error) {
    console.error('❌ [Telegram Daily Report Error]:', error);
    return { success: false, error: error.message };
  }
};

/**
 * 2. MONTHLY 1ST TASK LEADERBOARD PDF REPORT DISPATCH
 * Automatically generates multi-page Task Leaderboard PDF for all groups for the target month
 * and sends each document to the Telegram chat.
 */
export const sendMonthlyTaskLeaderboardsToTelegram = async (targetMonthStr = null) => {
  try {
    let monthStr = targetMonthStr;
    if (!monthStr) {
      // Default to previous month
      const ist = getISTDate();
      const prevMonthDate = new Date(ist.getFullYear(), ist.getMonth() - 1, 1);
      monthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
    }

    const [yearStr, monthNumStr] = monthStr.split('-');
    const monthIndex = parseInt(monthNumStr, 10) - 1;
    const gujaratiMonth = GUJARATI_MONTH_NAMES[monthIndex] || monthStr;

    console.log(`🚀 [Telegram Monthly Leaderboard] Preparing Task Leaderboard PDFs for ${monthStr} (${gujaratiMonth} ${yearStr})...`);

    const allGroups = await collections.groups.find();
    const activeGroups = allGroups.filter((g) => !g.isArchived);

    const results = [];

    for (const group of activeGroups) {
      const taskLeaderboards = await compileGroupTaskLeaderboards(group, monthStr);
      if (taskLeaderboards.length === 0) {
        console.log(`ℹ️ [Telegram Monthly Leaderboard] No habits found for group "${group.name}". Skipping.`);
        continue;
      }

      console.log(`📄 Generating PDF for group "${group.name}" with ${taskLeaderboards.length} task(s)...`);
      const pdfBuffer = await generateGroupTaskLeaderboardPDF(group, monthStr, taskLeaderboards);

      const safeGroupName = (group.name || 'Group').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${safeGroupName}_Task_Leaderboard_${monthStr}.pdf`;

      const caption = `🏆 <b>${group.name || 'Sankalp Group'} - માસિક નિયમ લીડરબોર્ડ બુક</b>\n📅 <b>મહિનો</b>: ${gujaratiMonth} ${yearStr}\n📋 <b>કુલ નિયમો</b>: ${taskLeaderboards.length} નિયમો\n👥 <b>સભ્યો</b>: ${group.members?.length || 0} સભ્યો\n\n<i>દરેક નિયમમાં ટોપ પરફોર્મર અને સંપૂર્ણ રેન્કિંગ વિગતવાર જોવા માટે ઉપરની PDF ડાઉનલોડ કરો.</i>\n\n🙏 જય સ્વામિનારાયણ`;

      const sendRes = await sendTelegramDocument(pdfBuffer, filename, caption, {
        contentType: 'application/pdf'
      });

      results.push({
        groupId: group.id || group._id,
        groupName: group.name,
        result: sendRes
      });
    }

    console.log(`✅ [Telegram Monthly Leaderboard] Dispatched ${results.length} Task Leaderboard PDF(s) to Telegram.`);
    return { success: true, results };
  } catch (error) {
    console.error('❌ [Telegram Monthly Leaderboard Error]:', error);
    return { success: false, error: error.message };
  }
};

/**
 * 3. MONTHLY 1ST FULL DATABASE BACKUP ZIP DISPATCH
 * Dumps all MongoDB / local database collections into JSON files,
 * compresses into a .zip archive using streaming archiver with minimal RAM,
 * and sends it directly to Telegram chat.
 */
export const sendMonthlyDatabaseBackupToTelegram = async (targetMonthStr = null) => {
  try {
    const timestamp = getISTDate().toISOString().replace(/[:.]/g, '-');
    const monthStr = targetMonthStr || getISTMonthString();

    console.log(`📦 [Telegram DB Backup] Starting complete database export for ${monthStr}...`);

    const summary = {
      createdAt: new Date().toISOString(),
      month: monthStr,
      collections: {},
      totalDocuments: 0
    };

    const zipBuffers = [];
    const archive = new ZipArchive({
      zlib: { level: 9 } // Maximum compression
    });

    archive.on('data', (chunk) => zipBuffers.push(chunk));

    const archiveFinished = new Promise((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(zipBuffers)));
      archive.on('error', (err) => reject(err));
    });

    // Check if MongoDB is connected
    const mongoUri = process.env.MONGO_URI;
    if (mongoUri && mongoose.connection.readyState === 1 && mongoose.connection.db) {
      const db = mongoose.connection.db;
      const collectionsList = await db.listCollections().toArray();
      const collectionNames = collectionsList.map((c) => c.name);

      for (const colName of collectionNames) {
        const collection = db.collection(colName);
        const docs = await collection.find({}).toArray();

        summary.collections[colName] = docs.length;
        summary.totalDocuments += docs.length;

        // Add formatted JSON file
        const jsonContent = JSON.stringify(docs, null, 2);
        archive.append(jsonContent, { name: `data/${colName}.json` });

        // Add NDJSON / JSON Lines file for easy mongoimport
        const jsonlContent = docs.map((doc) => JSON.stringify(doc)).join('\n');
        archive.append(jsonlContent, { name: `data/${colName}.jsonl` });
      }
    } else {
      // Fallback: Export from collections wrapper in db.js
      const collectionKeys = ['users', 'habits', 'habitLogs', 'groups', 'monthlyReports'];
      for (const key of collectionKeys) {
        const docs = (await collections[key]?.find()) || [];
        summary.collections[key] = docs.length;
        summary.totalDocuments += docs.length;

        const jsonContent = JSON.stringify(docs, null, 2);
        archive.append(jsonContent, { name: `data/${key}.json` });

        const jsonlContent = docs.map((doc) => JSON.stringify(doc)).join('\n');
        archive.append(jsonlContent, { name: `data/${key}.jsonl` });
      }
    }

    // Append metadata summary
    archive.append(JSON.stringify(summary, null, 2), { name: 'backup_summary.json' });

    // Finalize the archive
    await archive.finalize();
    const zipBuffer = await archiveFinished;

    console.log(`📦 [Telegram DB Backup] ZIP Archive created: ${(zipBuffer.length / 1024).toFixed(1)} KB with ${summary.totalDocuments} document(s).`);

    const filename = `Habit_Tracker_DB_Backup_${monthStr}_${timestamp}.zip`;

    let collectionsBreakdown = Object.entries(summary.collections)
      .map(([k, v]) => `• <b>${k}</b>: <code>${v}</code> docs`)
      .join('\n');

    const caption = `💾 <b>સંકલ્પ હેબિટ ટ્રેકર - માસિક ડેટાબેઝ બેકઅપ (.ZIP)</b>\n📅 <b>તારીખ</b>: ${getISTDateString()}\n📦 <b>ફાઇલ સાઇઝ</b>: ${(zipBuffer.length / 1024).toFixed(1)} KB\n📄 <b>કુલ રેકોર્ડ્સ</b>: ${summary.totalDocuments} documents\n\n<b>કલેક્શન વિગત:</b>\n${collectionsBreakdown}\n\n✅ <i>તમારો સંપૂર્ણ ડેટા સુરક્ષિત રીતે Telegram પર આર્કાઇવ થઈ ગયો છે.</i>`;

    const sendRes = await sendTelegramDocument(zipBuffer, filename, caption, {
      contentType: 'application/zip'
    });

    console.log(`✅ [Telegram DB Backup] Dispatched backup ZIP to Telegram.`);
    return { success: true, summary, result: sendRes };
  } catch (error) {
    console.error('❌ [Telegram DB Backup Error]:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Helper: parse HH:MM AM/PM to minutes from midnight
 */
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

/**
 * Helper: convert minutes from midnight to HH:MM AM/PM
 */
const minutesToTimeString = (totalMinutes) => {
  if (totalMinutes === null || isNaN(totalMinutes)) return 'N/A';
  let hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = Math.round(totalMinutes % 60);
  const meridian = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${meridian}`;
};

/**
 * 4. GET USER MONTHLY PERSONAL REPORT IN TEXT FORMAT
 * When a user types /yash907 or /report yash907, generates their current month report in text.
 */
export const getUserMonthlyReportText = async (userIdentifier, targetMonthStr = null) => {
  try {
    if (!userIdentifier || typeof userIdentifier !== 'string') {
      return '⚠️ કૃપા કરીને યુઝરનેમ લખો, દા.ત. <b>/yash907</b>';
    }

    const cleanInput = userIdentifier.trim().replace(/^[/@]/, '').trim();
    if (!cleanInput) {
      return '⚠️ કૃપા કરીને યુઝરનેમ લખો, દા.ત. <b>/yash907</b>';
    }

    const allUsers = await collections.users.find();
    
    // Find user by exact username, case-insensitive username, or name
    let user = allUsers.find(
      (u) => (u.username || '').toLowerCase() === cleanInput.toLowerCase()
    );

    if (!user) {
      user = allUsers.find(
        (u) => (u.name || '').toLowerCase() === cleanInput.toLowerCase()
      );
    }

    if (!user) {
      user = allUsers.find(
        (u) => (u.username || '').toLowerCase().includes(cleanInput.toLowerCase()) ||
               (u.name || '').toLowerCase().includes(cleanInput.toLowerCase())
      );
    }

    if (!user) {
      const validUsernames = allUsers
        .filter((u) => u.username)
        .map((u) => `• <b>/${u.username}</b> (${u.name})`)
        .join('\n');

      return `❌ <b>'${cleanInput}' યુઝર મળ્યો નથી.</b>\n\nકૃપા કરીને નીચેનામાંથી કોઈ એક યુઝરનેમ લખો:\n${validUsernames}\n\n👉 <i>ઉદાહરણ: <b>/yash907</b></i>`;
    }

    const targetUserId = (user.id || user._id).toString();
    const now = getISTDate();
    const monthStr = targetMonthStr || getISTMonthString(now);
    const [yearStr, monthNumStr] = monthStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthNumStr, 10);
    const monthName = GUJARATI_MONTH_NAMES[month - 1] || monthStr;

    const daysInMonth = new Date(year, month, 0).getDate();
    const isCurrentMonth = now.getFullYear() === year && (now.getMonth() + 1) === month;

    const currentDayOfMonth = now.getDate();
    const maxDayToCount = isCurrentMonth ? currentDayOfMonth : daysInMonth;
    const activeDaysInMonth = Math.max(1, maxDayToCount);

    // Fetch user habits (Personal + Joined Group Habits)
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

    const userHabits = [...groupHabits, ...personalHabits];

    if (userHabits.length === 0) {
      return `ℹ️ <b>${user.name}</b> (@${user.username || 'user'}) પાસે આ મહિનામાં કોઈ નિયમો સોંપાયેલ નથી.`;
    }

    // Fetch logs in target month
    const allLogs = await collections.habitLogs.find();
    const monthLogs = allLogs.filter((l) => {
      if ((l.userId || '').toString() !== targetUserId || !l.date || !l.date.startsWith(monthStr)) {
        return false;
      }
      const logDay = parseInt(l.date.split('-')[2], 10);
      return logDay >= 1 && logDay <= maxDayToCount;
    });

    // Compute metrics per habit
    const habitDetails = userHabits.map((habit) => {
      const habitId = (habit.id || habit._id).toString();
      const habitLogs = monthLogs.filter((l) => (l.habitId || '').toString() === habitId);

      const completedLogs = habitLogs.filter(isLogDone);

      const completedCount = new Set(completedLogs.map((l) => l.date)).size;
      const percentage = Math.min(100, Math.round((completedCount / activeDaysInMonth) * 100));

      let metricText = '';

      if (habit.type === 'count') {
        const totalCount = completedLogs.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
        const dailyAvg = Math.round((totalCount / activeDaysInMonth) * 10) / 10;
        metricText = `કુલ: <b>${totalCount.toLocaleString()} ${habit.targetUnit || ''}</b> (રોજિંદી સરેરાશ: ${dailyAvg} ${habit.targetUnit || ''})`;
      } else if (habit.type === 'time_target') {
        const totalMinutes = completedLogs.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
        const hrs = (totalMinutes / 60).toFixed(1);
        const dailyAvgMinutes = Math.round(totalMinutes / activeDaysInMonth);
        metricText = `કુલ: <b>${totalMinutes} મિ. (${hrs} કલાક)</b> (રોજ ${dailyAvgMinutes} મિનિટ)`;
      } else if (habit.type === 'timer') {
        const totalSeconds = completedLogs.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
        const totalMinutes = Math.round(totalSeconds / 60);
        const dailyAvgMins = Math.round(totalMinutes / activeDaysInMonth);
        metricText = `કુલ: <b>${totalMinutes} મિનિટ</b> (રોજ ${dailyAvgMins} મિનિટ)`;
      } else if (habit.type === 'time_of_day') {
        const timesLogged = completedLogs
          .map((l) => (typeof l.value === 'string' && l.value.trim() ? l.value.trim() : habit.targetValue))
          .filter(Boolean);

        let totalMinutesSum = 0;
        let validMinutesCount = 0;
        timesLogged.forEach((t) => {
          const mins = timeStringToMinutes(t);
          if (mins !== null) {
            totalMinutesSum += mins;
            validMinutesCount++;
          }
        });
        const avgMinutes = validMinutesCount > 0 ? Math.round(totalMinutesSum / validMinutesCount) : null;
        const averageTime = minutesToTimeString(avgMinutes);
        metricText = `સરેરાશ સમય: <b>${averageTime}</b> (લક્ષ્ય: ${habit.targetValue || '05:00 AM'})`;
      } else if (habit.type === 'yes_no') {
        const yesCount = habitLogs.filter(
          (l) => l.isCompleted || l.value === 1 || l.value === '1' || l.value === true
        ).length;
        metricText = `હાજરી: <b>${yesCount}/${activeDaysInMonth} દિવસ</b> (${Math.min(100, Math.round((yesCount / activeDaysInMonth) * 100))}%)`;
      } else {
        metricText = `હાજરી: <b>${completedCount}/${activeDaysInMonth} દિવસ</b> (${percentage}%)`;
      }

      return {
        title: habit.title,
        type: habit.type,
        completedCount,
        activeDaysInMonth,
        percentage,
        metricText
      };
    });

    // Compute Discipline Score (days where ALL assigned habits were done)
    const userHabitIds = userHabits.map((h) => (h.id || h._id).toString());
    const logsByDate = {};
    monthLogs.forEach((l) => {
      if (isLogDone(l) && l.date) {
        if (!logsByDate[l.date]) logsByDate[l.date] = new Set();
        logsByDate[l.date].add((l.habitId || '').toString());
      }
    });

    let disciplineScore = 0;
    if (userHabitIds.length > 0) {
      for (const dateStr in logsByDate) {
        const set = logsByDate[dateStr];
        const count = userHabitIds.filter((hId) => set.has(hId)).length;
        if (count >= userHabitIds.length) {
          disciplineScore++;
        }
      }
    }

    const overallRate =
      habitDetails.length > 0
        ? Math.round(habitDetails.reduce((sum, h) => sum + h.percentage, 0) / habitDetails.length)
        : 0;

    // Check today's progress for this user
    const todayStr = getISTDateString(now);
    const todayLogs = monthLogs.filter((l) => l.date === todayStr);
    const todayDoneHabitIds = new Set(
      todayLogs.filter(isLogDone).map((l) => (l.habitId || '').toString())
    );
    const todayDoneCount = todayDoneHabitIds.size;

    // Format final Telegram text message
    let out = `👤 <b>સંકલ્પ હેબિટ ટ્રેકર - વ્યક્તિગત રિપોર્ટ</b> 👤\n`;
    out += `━━━━━━━━━━━━━━━━━━━━\n`;
    out += `👤 <b>સભ્યનું નામ</b>: <b>${user.name}</b> (@${user.username || 'user'})\n`;
    out += `📅 <b>મહિનો</b>: <b>${monthName} ${year}</b>\n`;
    out += `⭐ <b>ડિસિપ્લિન સ્કોર</b>: <b>${disciplineScore} / ${activeDaysInMonth} દિવસ</b> (૧૦૦% પાલન)\n`;
    out += `📊 <b>માસિક સફળતા દર</b>: <b>${overallRate}%</b>\n`;
    out += `🎯 <b>આજની પ્રગતિ</b>: <b>${todayDoneCount}/${userHabits.length} નિયમો પૂર્ણ</b>\n`;
    out += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    out += `📋 <b>નિયમોની વિગતવાર પ્રગતિ:</b>\n\n`;

    habitDetails.forEach((h, idx) => {
      const badge = h.percentage >= 80 ? '🟢' : h.percentage >= 50 ? '🟡' : '🔴';
      out += `${idx + 1}. ${badge} <b>${h.title}</b>\n`;
      out += `   ↳ પ્રગતિ: <b>${h.completedCount}/${h.activeDaysInMonth} દિવસ</b> (${h.percentage}%)\n`;
      out += `   ↳ ${h.metricText}\n\n`;
    });

    out += `━━━━━━━━━━━━━━━━━━━━\n`;
    out += `🙏 <i>"નિયમ, ધર્મ અને સંકલ્પનું દ્રઢ પાલન એ જ ભક્તિની સાચી શોભા છે."</i>\n`;
    out += `👉 <i>હવે તમારો નિયમ પૂરો કરો:</i> <a href="https://habitsankalp.netlify.app">Sankalp Habit App</a>\n`;

    return out;
  } catch (error) {
    console.error('❌ [Telegram User Monthly Report Error]:', error);
    return `❌ ભૂલ: રિપોર્ટ તૈયાર કરવામાં તકલીફ આવી. (${error.message})`;
  }
};

/**
 * Handle incoming commands from Telegram chat (e.g. /yash907, /report, /help, /today)
 */
export const handleTelegramCommand = async (commandText, chatId, msg = {}) => {
  try {
    const rawText = (commandText || '').trim();
    const cleanCmd = rawText.split(' ')[0].split('@')[0].toLowerCase();
    const args = rawText.split(' ').slice(1);

    console.log(`💬 [Telegram Bot] Received command: "${rawText}" from chat ${chatId}`);

    if (cleanCmd === '/start' || cleanCmd === '/help') {
      const allUsers = await collections.users.find();
      const userList = allUsers
        .filter((u) => u.username)
        .slice(0, 8)
        .map((u) => `• <b>/${u.username}</b> (${u.name})`)
        .join('\n');

      let helpMsg = `🙏 <b>જય સ્વામિનારાયણ! સંકલ્પ હેબિટ ટ્રેકર બોટમાં સ્વાગત છે.</b>\n\n`;
      helpMsg += `📌 <b>ઉપલબ્ધ કમાન્ડ્સ:</b>\n`;
      helpMsg += `• <b>/username</b> - તમારો ચાલુ મહિનાનો વિગતવાર રિપોર્ટ જોવા માટે (દા.ત. <b>/yash907</b>)\n`;
      helpMsg += `• <b>/report username</b> - કોઈ પણ સભ્યનો રિપોર્ટ જોવા માટે (દા.ત. <b>/report yash907</b>)\n`;
      helpMsg += `• <b>/today</b> - આજનું લાઈવ ગ્રુપ રિપોર્ટ જોવા માટે\n`;
      helpMsg += `• <b>/users</b> - બધા ગ્રુપ સભ્યોના યુઝરનેમ જોવા માટે\n\n`;
      helpMsg += `📋 <b>કેટલાક સભ્યોના યુઝરનેમ:</b>\n${userList}\n\n`;
      helpMsg += `👉 <i>તમારો રિપોર્ટ જોવા માટે અત્યારે જ તમારો યુઝરનેમ લખો!</i>`;

      await sendTelegramMessage(helpMsg, { chatId });
      return;
    }

    if (cleanCmd === '/users' || cleanCmd === '/members') {
      const allUsers = await collections.users.find();
      const userList = allUsers
        .filter((u) => u.username)
        .map((u) => `• <b>/${u.username}</b> (${u.name})`)
        .join('\n');

      const response = `👥 <b>સંકલ્પ ગ્રુપના સભ્યો:</b>\n\n${userList}\n\n👉 <i>કોઈપણ સભ્યનો રિપોર્ટ જોવા માટે તેમના <b>/username</b> પર ક્લિક કરો.</i>`;
      await sendTelegramMessage(response, { chatId });
      return;
    }

    if (cleanCmd === '/today' || cleanCmd === '/daily') {
      await sendTelegramMessage('⏳ <i>આજનો ગ્રુપ રિપોર્ટ તૈયાર થઈ રહ્યો છે...</i>', { chatId });
      await sendDailyGroupComplianceReport();
      return;
    }

    if (cleanCmd === '/report') {
      const targetUser = args[0] || '';
      const targetMonth = args[1] || null;
      if (!targetUser) {
        await sendTelegramMessage('⚠️ કૃપા કરીને યુઝરનેમ લખો, દા.ત. <b>/report yash907</b> અથવા <b>/yash907</b>', { chatId });
        return;
      }
      const reportText = await getUserMonthlyReportText(targetUser, targetMonth);
      await sendTelegramMessage(reportText, { chatId });
      return;
    }

    // Any other /username command (e.g. /yash907, /dharm, /shubh, /om76, etc.)
    if (cleanCmd.startsWith('/')) {
      const requestedUsername = cleanCmd.replace('/', '').trim();
      if (requestedUsername) {
        const reportText = await getUserMonthlyReportText(requestedUsername, args[0] || null);
        await sendTelegramMessage(reportText, { chatId });
        return;
      }
    }
  } catch (err) {
    console.error('❌ [Telegram Command Handler Error]:', err);
    await sendTelegramMessage(`⚠️ કમાન્ડ પ્રોસેસ કરવામાં ભૂલ: ${err.message}`, { chatId });
  }
};

/**
 * Real-Time Telegram Bot Polling Listener
 * Automatically listens for incoming messages (/yash907, /report, etc.) without requiring webhooks
 */
let isListenerRunning = false;

export const startTelegramBotListener = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('⚠️ [Telegram Bot Listener] No TELEGRAM_BOT_TOKEN provided. Listener not started.');
    return;
  }

  if (isListenerRunning) {
    return;
  }
  isListenerRunning = true;

  console.log('🤖 [Telegram Bot Listener] Real-time command listener started for /username and /report!');

  let offset = 0;
  let isPolling = false;

  const poll = async () => {
    if (isPolling) return;
    isPolling = true;

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=20`, {
        signal: AbortSignal.timeout(25000)
      });
      const data = await res.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          const msg = update.message || update.channel_post;
          if (!msg || !msg.text) continue;

          const text = msg.text.trim();
          const chatId = msg.chat?.id;
          if (!chatId) continue;

          if (text.startsWith('/') || text.startsWith('@')) {
            await handleTelegramCommand(text, chatId, msg);
          }
        }
      }
    } catch (err) {
      if (!err.message?.includes('aborted') && !err.message?.includes('timeout')) {
        console.warn('⚠️ [Telegram Bot Listener Polling Error]:', err.message);
      }
    } finally {
      isPolling = false;
      setTimeout(poll, 1500);
    }
  };

  poll();
};

/**
 * 5. AUTOMATED TELEGRAM BACKGROUND SCHEDULER & REAL-TIME LISTENER
 * Checks every minute in Indian Standard Time (IST):
 * - 22:30 IST (Every Day) -> Daily Group Compliance Report
 * - 08:00 IST (1st of Every Month) -> Monthly Task Leaderboard PDF
 * - 08:30 IST (1st of Every Month) -> Monthly Database Backup ZIP
 * - Real-time Bot Listener for /yash907, /report, /today, /users
 */
export const initTelegramScheduler = () => {
  console.log('⏰ [Telegram Scheduler] Initializing automated Telegram background scheduler (IST)...');

  // 1. Start real-time bot command listener
  startTelegramBotListener();

  let lastDailyReportDate = null;
  let lastMonthlyLeaderboardMonth = null;
  let lastMonthlyBackupMonth = null;

  const checkSchedules = async () => {
    try {
      const ist = getISTDate();
      const hours = ist.getHours();
      const minutes = ist.getMinutes();
      const dayOfMonth = ist.getDate();
      const todayDateStr = getISTDateString(ist);
      const currentMonthStr = getISTMonthString(ist);

      // 1. Daily End-of-Day Report at 22:30 IST (10:30 PM)
      if (hours === 22 && minutes >= 30 && minutes <= 35) {
        if (lastDailyReportDate !== todayDateStr) {
          lastDailyReportDate = todayDateStr;
          console.log(`⏰ [Telegram Scheduler] Triggering daily report for ${todayDateStr} at 22:30 IST...`);
          await sendDailyGroupComplianceReport(todayDateStr);
        }
      }

      // 2. Monthly Task Leaderboard PDF at 08:00 IST on 1st of Month
      if (dayOfMonth === 1 && hours === 8 && minutes >= 0 && minutes <= 5) {
        if (lastMonthlyLeaderboardMonth !== currentMonthStr) {
          lastMonthlyLeaderboardMonth = currentMonthStr;
          console.log(`⏰ [Telegram Scheduler] Triggering monthly task leaderboard PDF on 1st of month at 08:00 IST...`);
          await sendMonthlyTaskLeaderboardsToTelegram();
        }
      }

      // 3. Monthly Database Backup ZIP at 08:30 IST on 1st of Month
      if (dayOfMonth === 1 && hours === 8 && minutes >= 30 && minutes <= 35) {
        if (lastMonthlyBackupMonth !== currentMonthStr) {
          lastMonthlyBackupMonth = currentMonthStr;
          console.log(`⏰ [Telegram Scheduler] Triggering monthly database backup zip on 1st of month at 08:30 IST...`);
          await sendMonthlyDatabaseBackupToTelegram();
        }
      }
    } catch (err) {
      console.error('⚠️ [Telegram Scheduler Check Error]:', err.message);
    }
  };

  // Run initial check after 8 seconds warmup, then every 60 seconds
  setTimeout(() => {
    checkSchedules();
    setInterval(checkSchedules, 60 * 1000);
  }, 8000);
};
