require("dotenv").config();
const app = require("./app");
const connectDB = require("../config/database");
const logger = require("./utils/logger");

(async () => {
  try {
    await connectDB();
    if (process.env.VERCEL !== "1") {
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => {
        logger.info(
          `Server running in ${process.env.NODE_ENV} mode on port http://localhost:${PORT}`
        );
      });
    }
  } catch (err) {
    logger.error(`Startup Error: ${err.message}`);
    process.exit(1);
  }
})();

module.exports = app;
