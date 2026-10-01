import dotenv from 'dotenv';
dotenv.config();

import { collections } from '../config/db.js';
import { generateGroupMonthlyReportPDF } from '../services/pdfReportService.js';
import { sendTelegramDocument, sendTelegramMessage } from '../services/telegramService.js';

async function testBroadcast() {
  console.log('🧪 [Test Telegram PDF] Starting test...');
  console.log(`- Bot Token Present: ${!!process.env.TELEGRAM_BOT_TOKEN}`);
  console.log(`- Default Chat ID: ${process.env.TELEGRAM_CHAT_ID || 'Not set'}`);

  try {
    const allGroups = await collections.groups.find();
    const group = allGroups[0] || {
      id: 'mock-1',
      name: 'શ્રી સ્વામિનારાયણ સત્સંગ ગ્રુપ'
    };

    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const allMonthlyReports = await collections.monthlyReports.find();
    let groupReports = allMonthlyReports.filter(
      (r) => (r.groupId || '').toString() === (group.id || group._id || '').toString() && r.month === currentMonthStr
    );

    // If no reports in DB, use mock reports to test
    if (groupReports.length === 0) {
      console.log('ℹ️ No active reports in database for current month, generating mock member reports for testing...');
      groupReports = [
        {
          userId: 'u1',
          userProfile: {
            name: 'હાર્દિક પટેલ',
            username: 'hardik_p'
          },
          activeDaysInMonth: 30,
          overallStats: { disciplineScore: 28, overallCompletionRate: 95 },
          habitSummaries: [
            { title: 'નિત્ય પૂજા', type: 'boolean', completedDaysCount: 30, completionPercentage: 100 },
            { title: 'માળા (જપ)', type: 'count', targetUnit: 'માળા', completedDaysCount: 29, completionPercentage: 97, typeDetails: { totalCount: 145, dailyAverage: 4.8 } }
          ]
        },
        {
          userId: 'u2',
          userProfile: {
            name: 'યશ ગોંડલિયા',
            username: 'yash_g'
          },
          activeDaysInMonth: 30,
          overallStats: { disciplineScore: 26, overallCompletionRate: 90 },
          habitSummaries: [
            { title: 'નિત્ય પૂજા', type: 'boolean', completedDaysCount: 28, completionPercentage: 93 }
          ]
        }
      ];
    }

    console.log(`📄 Generating PDF for "${group.name}" with ${groupReports.length} members...`);
    const pdfBuffer = await generateGroupMonthlyReportPDF(group, currentMonthStr, groupReports);
    console.log(`✅ Generated PDF Buffer: ${pdfBuffer.length} bytes (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);

    const filename = `${(group.name || 'Group').replace(/[^a-zA-Z0-9]/g, '_')}_Report_${currentMonthStr}.pdf`;
    const caption = `📊 <b>${group.name} - ટેસ્ટ માસિક પ્રગતિ અહેવાલ PDF</b>\n\n` +
      `📄 <b>ફાઇલ સાઇઝ:</b> ${(pdfBuffer.length / 1024).toFixed(1)} KB\n` +
      `👥 <b>કુલ સભ્યો:</b> ${groupReports.length}\n\n` +
      `✨ <i>જય સ્વામિનારાયણ</i> 🙏🏻`;

    console.log(`📤 Sending PDF document to Telegram...`);
    const sendResult = await sendTelegramDocument({
      buffer: pdfBuffer,
      filename,
      caption
    });

    if (sendResult.success) {
      console.log(`🎉 [SUCCESS] Telegram document sent successfully! Message ID: ${sendResult.messageId}`);
    } else {
      console.log(`⚠️ Telegram send returned:`, sendResult);
    }
  } catch (err) {
    console.error('❌ Test failed with error:', err);
  }
}

testBroadcast();
