// controllers/product.controller.js
const Product = require("../models/product.model");
const Category = require("../models/category.model");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const APIFeatures = require("../utils/apiFeatures");
const slugify = require("slugify");
const { cloudinary } = require("../../config/cloudinary");

// Helper to delete cloudinary images (safe)
async function safeDestroy(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    // log error, but don't crash (you can use your logger)
    console.error("Cloudinary destroy error:", err.message);
  }
}

// GET ALL PRODUCTS (same merged filters as before)
exports.getAllProducts = catchAsync(async (req, res, next) => {
  const filter = {};
  const andConditions = [];

  if (req.query.category) {
    const category = await Category.findOne({
      slug: req.query.category,
    }).select("_id");
    if (!category)
      return next(new AppError("No category found with that slug", 404));
    andConditions.push({ category: category._id });
  }

  if (req.query.subCategory) {
    andConditions.push({ subCategory: req.query.subCategory });
  }

  if (req.query.minPrice || req.query.maxPrice) {
    const priceFilter = {};
    if (req.query.minPrice) priceFilter.$gte = Number(req.query.minPrice);
    if (req.query.maxPrice) priceFilter.$lte = Number(req.query.maxPrice);
    andConditions.push({ price: priceFilter });
  }

  if (req.query.minRating) {
    andConditions.push({
      ratingsAverage: { $gte: Number(req.query.minRating) },
    });
  }

  if (req.query.tag) {
    andConditions.push({ "tag.slug": req.query.tag });
  }

  if (req.query.search) {
    const searchRegex = { $regex: req.query.search, $options: "i" };
    andConditions.push({
      $or: [{ name: searchRegex }, { description: searchRegex }],
    });
  }

  if (andConditions.length > 0) filter.$and = andConditions;

  const features = new APIFeatures(
    Product.find(filter).populate("category"),
    req.query
  )
    .sort()
    .limitFields()
    .paginate();
  const products = await features.query;

  res
    .status(200)
    .json({ status: "success", results: products.length, data: { products } });
});

// GET SINGLE PRODUCT BY SLUG
exports.getProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findOne({ slug: req.params.slug }).populate(
    "category"
  );
  if (!product)
    return next(new AppError("No product found with that slug", 404));
  res.status(200).json({ status: "success", data: { product } });
});

// CREATE PRODUCT
exports.createProduct = catchAsync(async (req, res, next) => {
  const productData = JSON.parse(req.body.product); // from form-data

  // Auto-generate slug only
  productData.slug = slugify(productData.name, { lower: true });

  // Handle main image
  if (req.files?.image?.[0]) {
    const img = req.files.image[0];
    productData.image = {
      index: 1,
      thumbnail: img.path,
      original: img.path,
    };
  }

  // Handle gallery images
  if (req.files?.gallery) {
    productData.gallery = req.files.gallery.map((file, index) => ({
      index: index + 1,
      thumbnail: file.path,
      original: file.path,
    }));
  }

  const product = await Product.create(productData);
  res.status(201).json({ status: "success", data: { product } });
});

exports.getProducts = async (req, res, next) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    next(err);
  }
};

// UPDATE PRODUCT
exports.updateProduct = catchAsync(async (req, res, next) => {
  const productId = req.params.id;
  const existingProduct = await Product.findById(productId);
  if (!existingProduct)
    return next(new AppError("No product found with that ID", 404));

  // Validate category/subCategory if provided
  if (req.body.category || req.body.subCategory) {
    const categoryId = req.body.category || existingProduct.category;
    const subCatId = req.body.subCategory || existingProduct.subCategory;
    const category = await Category.findById(categoryId);
    if (!category)
      return next(new AppError("No category found with that ID", 404));
    const childCategory = category.children.id(subCatId);
    if (!childCategory)
      return next(
        new AppError("No sub-category found with that ID in this category", 404)
      );
    req.body.category = categoryId;
    req.body.subCategory = subCatId;
  }

  // If new main image uploaded -> delete old, then set new
  if (req.files?.image?.[0]) {
    // destroy old
    if (existingProduct.image?.id) await safeDestroy(existingProduct.image.id);

    // set new
    req.body.image = {
      id: req.files.image[0].filename,
      original: req.files.image[0].path,
      thumbnail: req.files.image[0].path,
    };
  }

  // If new gallery uploaded -> delete all old gallery images, then set new
  if (req.files?.gallery && req.files.gallery.length > 0) {
    if (existingProduct.gallery && existingProduct.gallery.length > 0) {
      for (const img of existingProduct.gallery) {
        if (img?.id) await safeDestroy(img.id);
      }
    }

    req.body.gallery = req.files.gallery.map((file) => ({
      id: file.filename,
      original: file.path,
      thumbnail: file.path,
    }));
  }

  // Let model's pre('save') handle slug — but findByIdAndUpdate doesn't run save middleware.
  // So if name is updated we must update slug here:
  if (req.body.name) {
    req.body.slug = slugify(req.body.name, { lower: true });
  }

  const updated = await Product.findByIdAndUpdate(productId, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ status: "success", data: { product: updated } });
});

// DELETE PRODUCT
exports.deleteProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) return next(new AppError("No product found with that ID", 404));

  // delete main image
  if (product.image?.id) await safeDestroy(product.image.id);

  // delete gallery images
  if (product.gallery && product.gallery.length) {
    for (const img of product.gallery) {
      if (img?.id) await safeDestroy(img.id);
    }
  }

  await Product.findByIdAndDelete(req.params.id);
  res.status(204).json({ status: "success", data: null });
});
