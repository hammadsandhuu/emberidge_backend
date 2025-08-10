const mongoose = require("mongoose");
const logger = require("../src/utils/logger");

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    logger.info("Using existing MongoDB connection");
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    isConnected = conn.connections[0].readyState === 1;
    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on("error", (err) => {
      logger.error(`Mongoose connection error: ${err}`);
    });
  } catch (err) {
    logger.error(`Database connection error: ${err.message}`);
    throw err;
  }
};

module.exports = connectDB;
