const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Category = require("../src/models/category.model");

// Load environment variables
dotenv.config({ path: "./.env" });

// Sample data
const categories = [
  {
    name: "Baby & Kids",
    type: "mega",
    productCount: 50,
    image: {
      thumbnail: "/assets/images/category/baby.jpg",
    },
    children: [
      { name: "Stroller", slug: "stroller" },
      { name: "Clothes", slug: "clothes" },
      { name: "Towels", slug: "towels" },
      { name: "Baby Crib Bedding", slug: "baby-crib-bedding" },
      { name: "Pacifiers", slug: "pacifiers" },
    ],
  },
  {
    name: "Accessories",
    type: "mega",
    productCount: 20,
    image: {
      thumbnail: "/assets/images/category/accessories.jpg",
    },
    children: [
      { name: "Chains", slug: "chains" },
      { name: "Rings", slug: "rings" },
    ],
  },
  {
    name: "Electronics",
    type: "mega",
    productCount: 120,
    image: {
      thumbnail: "/assets/images/category/electronics.jpg",
    },
    children: [
      { name: "Smartphones", slug: "smartphones" },
      { name: "Laptops", slug: "laptops" },
    ],
  },
];

const importData = async () => {
  try {
    // Connect to DB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to database");

    // Clear existing data
    await Category.deleteMany();
    console.log("Existing categories deleted");

    // Insert new data
    await Category.insertMany(categories);
    console.log("Categories seeded successfully");

    process.exit();
  } catch (err) {
    console.error("Error seeding data:", err);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await Category.deleteMany();
    console.log("Data destroyed successfully");
    process.exit();
  } catch (err) {
    console.error("Error destroying data:", err);
    process.exit(1);
  }
};

// Determine action based on command line argument
if (process.argv[2] === "-d") {
  destroyData();
} else {
  importData();
}
