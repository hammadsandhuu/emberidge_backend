#!/usr/bin/env node
/**
 * Database Manager Script
 *
 * Commands:
 *   --migrate : Sync schema & indexes (no data loss)
 *   --drop    : Wipe all collections (confirmation required)
 *   --seed    : Seed database with initial data
 *   --reset   : Drop, migrate, and seed (confirmation required)
 */

require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Load all models dynamically
const modelsPath = path.join(__dirname, "../src/models");
fs.readdirSync(modelsPath)
  .filter((file) => file.endsWith(".model.js"))
  .forEach((file) => {
    require(path.join(modelsPath, file));
  });

// Load Seed Data
const seedData = require("./seedData.json");

/* ================================
   HELPER FUNCTIONS
=================================*/

/** Confirmation Prompt */
const confirmAction = async (message) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "yes");
    });
  });
};

/** Connect to MongoDB */
async function connectDB() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not found in .env file.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  console.log(`Connected to database: ${mongoose.connection.name}`);
}

/** Sync schema & indexes */
async function migrateDB() {
  console.log("Migrating schema & ensuring indexes...");
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.init())
  );
  console.log("Migration complete. No data deleted.");
}

/** Drop all collections */
async function dropDB() {
  const confirmed = await confirmAction(
    "This will WIPE all collections. Are you sure?"
  );
  if (!confirmed) {
    console.log("Operation cancelled.");
    return false;
  }

  console.log("Dropping all collections...");
  const collections = Object.keys(mongoose.connection.collections);

  for (const name of collections) {
    await mongoose.connection.collections[name].drop().catch((err) => {
      if (err.message !== "ns not found") throw err;
    });
  }

  console.log("All collections cleared successfully.");
  return true;
}

/** Seed database with default data */
async function seedDB() {
  console.log("Seeding database with data from seedData.json...");

  const User = mongoose.models.User;
  const Category = mongoose.models.Category;

  // Create Users
  const users = [];
  for (const user of seedData.users) {
    const existingUser = await User.findOne({ email: user.email });
    if (!existingUser) {
      const newUser = await User.create(user);
      users.push(newUser);
      console.log(`Created user: ${user.email}`);
    } else {
      users.push(existingUser);
      console.log(`User already exists: ${user.email}`);
    }
  }

  const admin = users[0];

  // Create Categories
  for (const category of seedData.categories) {
    const existingCategory = await Category.findOne({ name: category.name });
    if (!existingCategory) {
      await Category.create({
        name: category.name,
        createdBy: admin._id,
        children: category.children.map((child) => ({ name: child })),
      });
      console.log(`Created category: ${category.name}`);
    } else {
      console.log(`Category already exists: ${category.name}`);
    }
  }

  console.log("Seeding complete.");
}

/* ================================
   MAIN SCRIPT
=================================*/
(async () => {
  try {
    await connectDB();

    const action = process.argv[2];

    if (!action) {
      console.log(
        "No action provided. Check README.md or package.json scripts for usage."
      );
      process.exit(0);
    }

    if (action === "--migrate") {
      await migrateDB();
    } else if (action === "--drop") {
      const dropped = await dropDB();
      if (!dropped) process.exit(0);
    } else if (action === "--seed") {
      await seedDB();
    } else if (action === "--reset") {
      const confirmed = await confirmAction(
        "This will DROP and RESEED the database. Are you sure?"
      );
      if (!confirmed) {
        console.log("Operation cancelled.");
        process.exit(0);
      }
      const dropped = await dropDB();
      if (!dropped) process.exit(0);
      await migrateDB();
      await seedDB();
    } else {
      console.log(
        "Unknown command. Use --migrate, --drop, --seed, or --reset."
      );
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("Operation failed:", err);
    await mongoose.connection.close();
    process.exit(1);
  }
})();
