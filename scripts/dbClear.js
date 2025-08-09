require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/user.model");
const Category = require("../src/models/category.model");
const Product = require("../src/models/product.model");
// Import other models as needed

const clearDatabase = async () => {
  try {
    // Connect to DB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to database");

    // Clear all collections
    await User.deleteMany();
    await Category.deleteMany();
    await Product.deleteMany();
    // Add other models here

    console.log("Database cleared successfully");
    process.exit(0);
  } catch (err) {
    console.error("Error clearing database:", err);
    process.exit(1);
  }
};

clearDatabase();
