require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../src/models/product.model");
const Category = require("../src/models/category.model");
const babyProducts = require("./babyProductsData.json"); // Your provided data

const importData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // 1) Get the Baby & Kids category
    const babyCategory = await Category.findOne({ slug: "baby-kids" });
    if (!babyCategory) throw new Error("Baby & Kids category not found");

    // 2) Map products to include category reference
    const productsWithCategory = babyProducts.map((product) => {
      // Determine sub-category from tags
      const subCategoryTag = product.tag.find((tag) =>
        [
          "stroller",
          "clothes",
          "towels",
          "baby-crib-bedding",
          "pacifiers",
        ].includes(tag.slug)
      );

      return {
        ...product,
        category: babyCategory._id,
        subCategory: subCategoryTag ? subCategoryTag.slug : "clothes",
      };
    });

    // 3) Clear and seed products
    await Product.deleteMany();
    await Product.insertMany(productsWithCategory);

    console.log(`${productsWithCategory.length} products seeded successfully!`);
    console.log(`All products associated with category: ${babyCategory.name}`);
    process.exit();
  } catch (err) {
    console.error("Error seeding products:", err);
    process.exit(1);
  }
};

importData();
