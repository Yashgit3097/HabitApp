import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_DIR = path.join(__dirname, '..');
const ROOT_DIR = path.join(SERVER_DIR, '..');

// Load .env
dotenv.config({ path: path.join(SERVER_DIR, '.env') });

const restoreBackup = async () => {
  // Can pass custom backup folder path as first argument, defaults to backup/latest
  const targetDirArg = process.argv[2];
  const backupDir = targetDirArg
    ? path.resolve(process.cwd(), targetDirArg)
    : path.join(ROOT_DIR, 'backup', 'latest');

  if (!fs.existsSync(backupDir)) {
    console.error(`❌ Backup directory not found: ${backupDir}`);
    process.exit(1);
  }

  const mongoUri = process.env.MONGO_URI;
  console.log('🚀 Starting Database Restore...');
  console.log(`📁 Source folder: ${backupDir}`);

  const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.json') && f !== 'backup_summary.json');

  if (files.length === 0) {
    console.warn('⚠️ No collection JSON files found to restore.');
    return;
  }

  if (mongoUri) {
    try {
      console.log('🍃 Connecting to MongoDB...');
      await mongoose.connect(mongoUri);
      console.log(' Connected to MongoDB.');

      const db = mongoose.connection.db;

      for (const file of files) {
        const colName = file.replace('.json', '');
        const filePath = path.join(backupDir, file);
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const docs = JSON.parse(rawData || '[]');

        if (docs.length === 0) {
          console.log(`  ℹ️ Skipping empty collection: ${colName}`);
          continue;
        }

        const collection = db.collection(colName);
        // Clear existing data or replace
        console.log(`  🔄 Restoring collection [${colName}] (${docs.length} documents)...`);
        await collection.deleteMany({});
        
        // Convert string _ids with 24 hex chars or preserve original _id
        const sanitizedDocs = docs.map((doc) => {
          if (doc._id && typeof doc._id === 'string' && mongoose.Types.ObjectId.isValid(doc._id) && doc._id.length === 24) {
            return { ...doc, _id: new mongoose.Types.ObjectId(doc._id) };
          }
          return doc;
        });

        await collection.insertMany(sanitizedDocs);
        console.log(`  ✅ Restored [${colName}]: ${sanitizedDocs.length} documents.`);
      }

      await mongoose.disconnect();
      console.log('🔌 MongoDB connection closed.');
    } catch (err) {
      console.error('❌ MongoDB Restore failed:', err.message);
    }
  } else {
    // Restore to local storage
    const dataDir = path.join(SERVER_DIR, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    for (const file of files) {
      const srcPath = path.join(backupDir, file);
      const destPath = path.join(dataDir, file);
      fs.copyFileSync(srcPath, destPath);
      console.log(`  ✅ Restored local collection file: ${file}`);
    }
  }

  console.log('\n========================================');
  console.log('🎉 RESTORE COMPLETED SUCCESSFULLY!');
  console.log('========================================\n');
};

restoreBackup().catch((err) => {
  console.error('Fatal restore error:', err);
  process.exit(1);
});
