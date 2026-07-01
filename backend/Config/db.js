const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const dbState = {
  connected: false,
  isFallback: false,
  fallbackFile: path.join(__dirname, '../database_fallback.json'),
  
  readFallbackData() {
    try {
      if (!fs.existsSync(this.fallbackFile)) {
        fs.writeFileSync(this.fallbackFile, JSON.stringify({ users: [], portfolios: [] }, null, 2));
      }
      const data = fs.readFileSync(this.fallbackFile, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Error reading fallback DB:', err);
      return { users: [], portfolios: [] };
    }
  },
  
  writeFallbackData(data) {
    try {
      fs.writeFileSync(this.fallbackFile, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Error writing fallback DB:', err);
    }
  }
};

const connectDB = async () => {
  try {
    mongoose.set('strictQuery', false);
    const connUri = process.env.MONGO_URI || 'mongodb://localhost:27017/risk-analyzer';
    await mongoose.connect(connUri, {
      serverSelectionTimeoutMS: 3000 // 3 seconds timeout
    });
    dbState.connected = true;
    dbState.isFallback = false;
    console.log('MongoDB Connected successfully!');
  } catch (error) {
    dbState.connected = false;
    dbState.isFallback = true;
    console.warn('\n⚠️ WARNING: Could not connect to MongoDB. Database Fallback enabled!');
    console.warn(`Local JSON fallback store initialized at: ${dbState.fallbackFile}\n`);
    dbState.readFallbackData();
  }
};

module.exports = { connectDB, dbState };
