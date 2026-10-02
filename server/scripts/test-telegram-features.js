import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from '../config/db.js';
import {
  sendDailyGroupComplianceReport,
  sendMonthlyDatabaseBackupToTelegram,
  sendMonthlyTaskLeaderboardsToTelegram
} from '../services/telegramService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function runTests() {
  console.log('🚀 Connecting to Database...');
  await connectDB();
  console.log('✅ DB Connected.');

  console.log('\n========================================');
  console.log('🧪 TEST 1: Daily Group Compliance Report');
  console.log('========================================');
  const dailyRes = await sendDailyGroupComplianceReport();
  console.log('Daily Report Result:', JSON.stringify(dailyRes, null, 2));

  console.log('\n========================================');
  console.log('🧪 TEST 2: Monthly Database Backup ZIP to Telegram');
  console.log('========================================');
  const backupRes = await sendMonthlyDatabaseBackupToTelegram();
  console.log('Backup Result:', JSON.stringify(backupRes, null, 2));

  console.log('\n========================================');
  console.log('🧪 TEST 3: Monthly Task Leaderboard PDF to Telegram');
  console.log('========================================');
  const leaderboardRes = await sendMonthlyTaskLeaderboardsToTelegram();
  console.log('Leaderboard Result:', JSON.stringify(leaderboardRes, null, 2));

  console.log('\n========================================');
  console.log('🎉 ALL TELEGRAM FEATURES TESTED!');
  console.log('========================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
