const mongoose = require("mongoose");
const logger = require("../src/utils/logger");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
      useFindAndModify: false,
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    // Connection events
    mongoose.connection.on("connected", () => {
      logger.info("Mongoose connected to DB");
    });

    mongoose.connection.on("error", (err) => {
      logger.error(`Mongoose connection error: ${err}`);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("Mongoose disconnected");
    });

    // Close connection on app termination
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      logger.info("Mongoose connection closed due to app termination");
      process.exit(0);
    });
  } catch (err) {
    logger.error(`Database connection error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
