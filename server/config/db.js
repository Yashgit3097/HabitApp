import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let isUsingMongo = false;

// Helper to format documents so both _id and id are accessible as strings
const formatDoc = (doc) => {
  if (!doc) return null;
  const idStr = doc._id ? doc._id.toString() : (doc.id ? doc.id.toString() : '');
  return {
    ...doc,
    _id: idStr,
    id: idStr
  };
};

// Helper to convert query object so that any 'id' or '_id' converts to ObjectId if valid
const normalizeMongoQuery = (query) => {
  if (!query || typeof query !== 'object') return query;
  const mongoQuery = {};

  for (const key in query) {
    if (query[key] === undefined) continue;

    if (key === 'id' || key === '_id') {
      const val = query[key];
      if (typeof val === 'string' && mongoose.Types.ObjectId.isValid(val) && val.length === 24) {
        mongoQuery.$or = [
          { _id: new mongoose.Types.ObjectId(val) },
          { _id: val },
          { id: val }
        ];
      } else {
        mongoQuery.$or = [{ _id: val }, { id: val }];
      }
    } else {
      mongoQuery[key] = query[key];
    }
  }

  return mongoQuery;
};

// Fallback Local File Storage
class LocalCollection {
  constructor(name) {
    this.name = name;
    this.filePath = path.join(DATA_DIR, `${name}.json`);
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  _read() {
    try {
      const data = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(data || '[]');
    } catch (err) {
      console.error(`Error reading ${this.name}:`, err);
      return [];
    }
  }

  _write(data) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error(`Error writing ${this.name}:`, err);
    }
  }

  async find(query = {}) {
    const items = this._read();
    return items
      .filter((item) => {
        for (const key in query) {
          if (query[key] !== undefined && item[key] !== query[key]) {
            return false;
          }
        }
        return true;
      })
      .map(formatDoc);
  }

  async findOne(query = {}) {
    const items = this._read();
    const result = items.find((item) => {
      for (const key in query) {
        if (query[key] !== undefined && item[key] !== query[key]) {
          return false;
        }
      }
      return true;
    });
    return result ? formatDoc(result) : null;
  }

  async findById(id) {
    return this.findOne({ id }) || this.findOne({ _id: id });
  }

  async insertOne(doc) {
    const items = this._read();
    const id = doc.id || doc._id || new mongoose.Types.ObjectId().toString();
    const newDoc = {
      _id: id,
      id: id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...doc
    };
    items.push(newDoc);
    this._write(items);
    return formatDoc(newDoc);
  }

  async updateOne(query, updates) {
    const items = this._read();
    const index = items.findIndex((item) => {
      for (const key in query) {
        if (
          query[key] !== undefined &&
          item[key] !== query[key] &&
          item._id !== query[key] &&
          item.id !== query[key]
        ) {
          return false;
        }
      }
      return true;
    });

    if (index === -1) return null;

    const updateData = updates.$set ? updates.$set : updates;
    items[index] = {
      ...items[index],
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    this._write(items);
    return formatDoc(items[index]);
  }

  async deleteOne(query) {
    const items = this._read();
    const index = items.findIndex((item) => {
      for (const key in query) {
        if (
          query[key] !== undefined &&
          item[key] !== query[key] &&
          item._id !== query[key] &&
          item.id !== query[key]
        ) {
          return false;
        }
      }
      return true;
    });

    if (index === -1) return false;
    items.splice(index, 1);
    this._write(items);
    return true;
  }
}

// Unified Database Collection Adapter (Switches to MongoDB when connected)
class CollectionProxy {
  constructor(name) {
    this.name = name;
    this.local = new LocalCollection(name);
  }

  _getMongoColl() {
    return mongoose.connection.collection(this.name);
  }

  async find(query = {}) {
    if (isUsingMongo) {
      const mongoQuery = normalizeMongoQuery(query);
      const results = await this._getMongoColl().find(mongoQuery).toArray();
      return results.map(formatDoc);
    }
    return this.local.find(query);
  }

  async findOne(query = {}) {
    if (isUsingMongo) {
      const mongoQuery = normalizeMongoQuery(query);
      const result = await this._getMongoColl().findOne(mongoQuery);
      return formatDoc(result);
    }
    return this.local.findOne(query);
  }

  async findById(id) {
    if (isUsingMongo) {
      if (!id) return null;
      const idStr = id.toString();
      const mongoQuery = (mongoose.Types.ObjectId.isValid(idStr) && idStr.length === 24)
        ? { $or: [{ _id: new mongoose.Types.ObjectId(idStr) }, { _id: idStr }, { id: idStr }] }
        : { $or: [{ _id: idStr }, { id: idStr }] };

      const result = await this._getMongoColl().findOne(mongoQuery);
      return formatDoc(result);
    }
    return this.local.findById(id);
  }

  async insertOne(doc) {
    if (isUsingMongo) {
      const { id, _id, ...cleanDoc } = doc;
      const insertData = {
        ...cleanDoc,
        createdAt: cleanDoc.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // If an _id was explicitly provided, keep it; otherwise MongoDB will auto-generate its native ObjectId
      if (_id) {
        insertData._id = (typeof _id === 'string' && mongoose.Types.ObjectId.isValid(_id) && _id.length === 24)
          ? new mongoose.Types.ObjectId(_id)
          : _id;
      }

      const result = await this._getMongoColl().insertOne(insertData);
      const insertedId = result.insertedId ? result.insertedId.toString() : '';

      return {
        ...insertData,
        _id: insertedId,
        id: insertedId
      };
    }
    return this.local.insertOne(doc);
  }

  async updateOne(query, updates) {
    if (isUsingMongo) {
      const mongoQuery = normalizeMongoQuery(query);
      const updateData = updates.$set ? updates.$set : { ...updates };
      delete updateData._id;
      delete updateData.id;
      updateData.updatedAt = new Date().toISOString();

      await this._getMongoColl().updateOne(mongoQuery, { $set: updateData });
      return this.findOne(query);
    }
    return this.local.updateOne(query, updates);
  }

  async deleteOne(query) {
    if (isUsingMongo) {
      const mongoQuery = normalizeMongoQuery(query);
      const res = await this._getMongoColl().deleteOne(mongoQuery);
      return res.deletedCount > 0;
    }
    return this.local.deleteOne(query);
  }
}

export const collections = {
  users: new CollectionProxy('users'),
  habits: new CollectionProxy('habits'),
  habitLogs: new CollectionProxy('habit_logs'),
  dailyLogs: new CollectionProxy('daily_logs'),
  groups: new CollectionProxy('groups'),
  notifications: new CollectionProxy('notifications'),
  monthlyReports: new CollectionProxy('monthly_reports')
};

export const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri);
      isUsingMongo = true;
      console.log(`🍃 Connected to MongoDB successfully!`);
      return;
    } catch (err) {
      console.warn('⚠️ MongoDB connection error, using local disk storage:', err.message);
    }
  }
  console.log('📁 Using local storage in ./server/data/');
};
