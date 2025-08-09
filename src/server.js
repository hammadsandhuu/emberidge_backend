require("dotenv").config();
const app = require("./app");
const connectDB = require("../config/database");

// Connect to DB (lazy connection pattern)
let dbConnected = false;
async function ensureDBConnection() {
  if (!dbConnected) {
    await connectDB();
    dbConnected = true;
  }
}

module.exports = async (req, res) => {
  await ensureDBConnection();
  return app(req, res);
};
