require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/user.model");
const Category = require("../src/models/category.model");
// Import other models as needed

const migrateDatabase = async () => {
  try {
    // Connect to DB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to database");

    // Clear existing data (optional)
    await mongoose.connection.db.dropDatabase();
    console.log("Database cleared");

    // Seed admin user
    const adminUser = await User.create({
      name: "Admin User",
      email: "admin@emberidge.com",
      password: "admin123",
      passwordConfirm: "admin123",
      role: "admin",
    });

    // Seed sample categories
    const categories = await Category.insertMany([
      {
        name: "Electronics",
        type: "mega",
        productCount: 120,
        children: [
          { name: "Smartphones", slug: "smartphones" },
          { name: "Laptops", slug: "laptops" },
        ],
      },
      {
        name: "Fashion",
        type: "mega",
        productCount: 200,
        children: [
          { name: "Men's Wear", slug: "mens-wear" },
          { name: "Women's Wear", slug: "womens-wear" },
        ],
      },
    ]);

    console.log("Database migrated successfully");
    console.log("Admin credentials:", adminUser.email, "admin123");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
};

migrateDatabase();
