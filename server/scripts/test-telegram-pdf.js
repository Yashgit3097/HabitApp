import dotenv from 'dotenv';
dotenv.config();

import { connectDB, collections } from '../config/db.js';
import { sendGroupReportsToTelegram } from '../services/telegramService.js';

async function testBroadcastSeptember() {
  console.log('🧪 [Test Telegram PDF] Broadcasting September 2026 (Previous Month)...');

  try {
    await connectDB();
    const allGroups = await collections.groups.find();
    const group = allGroups[0];

    if (!group) {
      console.error('❌ No groups found in database!');
      return;
    }

    const targetMonthStr = '2026-09'; // Previous month (September 2026)

    console.log(`📤 Broadcasting September report for group "${group.name}" (${targetMonthStr}) to Telegram...`);
    const result = await sendGroupReportsToTelegram(group.id || group._id, targetMonthStr);

    if (result.success) {
      console.log(`🎉 [SUCCESS] Telegram PDF report for September sent successfully! Total pages: ${result.totalPages}`);
    } else {
      console.error(`❌ [FAILED] Telegram broadcast failed:`, result);
    }
  } catch (err) {
    console.error('❌ Test failed with error:', err);
  }
}

testBroadcastSeptember();
