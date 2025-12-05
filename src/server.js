require("dotenv").config();
const app = require("./app");
const connectDB = require("../config/database");
const logger = require("./utils/logger");

// Initialize database connection (non-blocking for serverless)
(async () => {
  try {
    await connectDB();
  } catch (err) {
    logger.error(`Database connection error: ${err.message}`);
    // In serverless, don't exit - let it retry on next request
    if (process.env.VERCEL !== "1") {
      process.exit(1);
    }
  }
})();

// Only start HTTP server if not in Vercel
if (process.env.VERCEL !== "1") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    logger.info(
      `Server running in ${process.env.NODE_ENV} mode on port http://localhost:${PORT}`
    );
  });
}

module.exports = app;
