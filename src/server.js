require("dotenv").config();
const app = require("./app");
const connectDB = require("../config/database");
const logger = require("./utils/logger");
const { PORT, NODE_ENV } = process.env;

// Start server
connectDB();
const server = app.listen(PORT || 5000, async () => {
  logger.info(`Server running in ${NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

// Handle SIGTERM
process.on("SIGTERM", () => {
  logger.info("SIGTERM RECEIVED. Shutting down gracefully");
  server.close(() => {
    logger.info("Process terminated!");
  });
});
