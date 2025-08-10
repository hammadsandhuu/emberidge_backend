// config/database.js
const mongoose = require("mongoose");
const logger = require("../src/utils/logger");

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn) {
    logger.info("Using cached MongoDB connection");
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        bufferCommands: false, // Disable mongoose buffering
        serverSelectionTimeoutMS: 5000, // Fail fast if no connection
        socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      })
      .then((mongoose) => {
        logger.info("MongoDB Connected");
        return mongoose;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    logger.error(`Database connection error: ${err.message}`);
    throw err;
  }
};

module.exports = connectDB;
