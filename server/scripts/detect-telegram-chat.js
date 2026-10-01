import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_DIR = path.join(__dirname, '..');
const ENV_PATH = path.join(SERVER_DIR, '.env');

dotenv.config({ path: ENV_PATH });

const detectChatId = async () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found in .env');
    process.exit(1);
  }

  console.log('🔍 Checking Telegram updates for your bot...');
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const data = await res.json();

    if (!data.ok) {
      console.error('❌ Telegram error:', data.description);
      return;
    }

    if (!data.result || data.result.length === 0) {
      console.log('\n⚠️ No messages received yet!');
      console.log('👉 Please do this:');
      console.log('1. Add @Sankalp_group_bot to your Telegram Group.');
      console.log('2. Send any message in that group (e.g. "Hello Bot" or "/start").');
      console.log('3. Run this command again: node server/scripts/detect-telegram-chat.js\n');
      return;
    }

    // Find the latest group or private chat
    const chats = [];
    data.result.forEach((update) => {
      const msg = update.message || update.channel_post || update.my_chat_member;
      if (msg && msg.chat) {
        chats.push({
          id: msg.chat.id,
          title: msg.chat.title || msg.chat.first_name || 'Direct Chat',
          type: msg.chat.type
        });
      }
    });

    const uniqueChats = Array.from(new Map(chats.map((c) => [c.id, c])).values());

    console.log('\n📋 Detected Chats:');
    uniqueChats.forEach((c, idx) => {
      console.log(`  [${idx + 1}] Title: "${c.title}" | Type: ${c.type} | Chat ID: ${c.id}`);
    });

    // Pick group chat or first chat
    const selected = uniqueChats.find((c) => c.type === 'group' || c.type === 'supergroup') || uniqueChats[0];

    if (selected) {
      console.log(`\n✅ Selected Chat ID: ${selected.id} ("${selected.title}")`);

      // Update .env
      let envContent = fs.readFileSync(ENV_PATH, 'utf-8');
      if (envContent.includes('TELEGRAM_CHAT_ID=')) {
        envContent = envContent.replace(/TELEGRAM_CHAT_ID=.*/, `TELEGRAM_CHAT_ID=${selected.id}`);
      } else {
        envContent += `\nTELEGRAM_CHAT_ID=${selected.id}\n`;
      }
      fs.writeFileSync(ENV_PATH, envContent, 'utf-8');
      console.log(`💾 Successfully updated TELEGRAM_CHAT_ID=${selected.id} in server/.env!\n`);
    }
  } catch (err) {
    console.error('❌ Failed to fetch Telegram updates:', err.message);
  }
};

detectChatId();
