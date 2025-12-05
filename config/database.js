const mongoose = require("mongoose");

// Cache the connection promise to avoid multiple connection attempts
let cachedConnection = null;

const connectDB = async () => {
  // If already connected, return
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // If connection is in progress, return the existing promise
  if (cachedConnection) {
    return cachedConnection;
  }

  // Create new connection promise
  cachedConnection = mongoose
    .connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => {
      console.log("MongoDB Connected Successfully");
      return mongoose.connection;
    })
    .catch((error) => {
      console.error("MongoDB Connection Failed:", error.message);
      cachedConnection = null; // Reset on error so we can retry
      
      // Only exit process in non-serverless environments
      if (process.env.VERCEL !== "1" && process.env.AWS_LAMBDA_FUNCTION_NAME === undefined) {
        process.exit(1);
      }
      
      throw error;
    });

  return cachedConnection;
};

module.exports = connectDB;
