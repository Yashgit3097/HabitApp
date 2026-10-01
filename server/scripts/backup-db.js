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

const createBackup = async () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupBaseDir = path.join(ROOT_DIR, 'backup');
  const timestampedBackupDir = path.join(backupBaseDir, `backup_${timestamp}`);
  const latestBackupDir = path.join(backupBaseDir, 'latest');

  [backupBaseDir, timestampedBackupDir, latestBackupDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const mongoUri = process.env.MONGO_URI;
  console.log('🚀 Starting Database Backup...');
  console.log(`📁 Backup destination: ${timestampedBackupDir}`);

  const summary = {
    timestamp: new Date().toISOString(),
    source: mongoUri ? 'MongoDB Atlas' : 'Local File Storage',
    collections: {},
    totalDocuments: 0
  };

  if (mongoUri) {
    try {
      console.log('🍃 Connecting to MongoDB...');
      await mongoose.connect(mongoUri);
      console.log(' Connected to MongoDB.');

      const db = mongoose.connection.db;
      const collectionsList = await db.listCollections().toArray();
      const collectionNames = collectionsList.map((c) => c.name);

      console.log(`📋 Found ${collectionNames.length} collection(s): ${collectionNames.join(', ')}`);

      for (const colName of collectionNames) {
        const collection = db.collection(colName);
        const docs = await collection.find({}).toArray();

        summary.collections[colName] = docs.length;
        summary.totalDocuments += docs.length;

        // 1. Save standard JSON Array (importable with mongoimport --jsonArray or Node script)
        const jsonPath = path.join(timestampedBackupDir, `${colName}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(docs, null, 2), 'utf-8');

        // Copy to latest/
        fs.writeFileSync(path.join(latestBackupDir, `${colName}.json`), JSON.stringify(docs, null, 2), 'utf-8');

        // 2. Save JSON Lines format (NDJSON / .jsonl, standard mongoimport format)
        const jsonlPath = path.join(timestampedBackupDir, `${colName}.jsonl`);
        const jsonlContent = docs.map((doc) => JSON.stringify(doc)).join('\n');
        fs.writeFileSync(jsonlPath, jsonlContent, 'utf-8');
        fs.writeFileSync(path.join(latestBackupDir, `${colName}.jsonl`), jsonlContent, 'utf-8');

        console.log(`  💾 Saved collection [${colName}]: ${docs.length} document(s) -> ${colName}.json & ${colName}.jsonl`);
      }

      await mongoose.disconnect();
      console.log('🔌 MongoDB connection closed.');
    } catch (err) {
      console.error('❌ MongoDB Backup failed, checking local storage fallback:', err.message);
    }
  } else {
    // Fallback to local data dir
    const dataDir = path.join(SERVER_DIR, 'data');
    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        const colName = file.replace('.json', '');
        const content = fs.readFileSync(path.join(dataDir, file), 'utf-8');
        const docs = JSON.parse(content || '[]');

        summary.collections[colName] = docs.length;
        summary.totalDocuments += docs.length;

        fs.writeFileSync(path.join(timestampedBackupDir, `${colName}.json`), JSON.stringify(docs, null, 2), 'utf-8');
        fs.writeFileSync(path.join(latestBackupDir, `${colName}.json`), JSON.stringify(docs, null, 2), 'utf-8');

        const jsonlContent = docs.map((doc) => JSON.stringify(doc)).join('\n');
        fs.writeFileSync(path.join(timestampedBackupDir, `${colName}.jsonl`), jsonlContent, 'utf-8');
        fs.writeFileSync(path.join(latestBackupDir, `${colName}.jsonl`), jsonlContent, 'utf-8');

        console.log(`  💾 Saved local collection [${colName}]: ${docs.length} document(s)`);
      }
    }
  }

  // Write metadata summary
  fs.writeFileSync(
    path.join(timestampedBackupDir, 'backup_summary.json'),
    JSON.stringify(summary, null, 2),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(latestBackupDir, 'backup_summary.json'),
    JSON.stringify(summary, null, 2),
    'utf-8'
  );

  console.log('\n========================================');
  console.log('✅ BACKUP COMPLETED SUCCESSFULLY!');
  console.log(`📁 Timestamped Folder: ${timestampedBackupDir}`);
  console.log(`📁 Latest Backup Folder: ${latestBackupDir}`);
  console.log(`📊 Total Collections: ${Object.keys(summary.collections).length}`);
  console.log(`📄 Total Documents: ${summary.totalDocuments}`);
  console.log('========================================\n');
};

createBackup().catch((err) => {
  console.error('Fatal backup error:', err);
  process.exit(1);
});
