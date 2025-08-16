require("dotenv").config();
const mongoose = require("mongoose");

const migrateDatabase = async () => {
  try {
    // Connect to DB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to database");

    // 🔹 Instead of dropping DB, clear specific collections
    const collections = await mongoose.connection.db.collections();

    for (let collection of collections) {
      await collection.deleteMany({});
      console.log(`Cleared ${collection.collectionName}`);
    }

    console.log("Database migrated successfully");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
};

migrateDatabase();
