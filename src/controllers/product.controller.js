const Product = require("../models/product.model");
const Category = require("../models/category.model");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const APIFeatures = require("../utils/apiFeatures");

exports.getAllProducts = catchAsync(async (req, res, next) => {
  // 1) BUILD QUERY
  const filter = {};

  // Category Filter
  if (req.query.category) {
    const category = await Category.findOne({ slug: req.query.category });
    if (!category) {
      return next(new AppError("No category found with that slug", 404));
    }
    filter.category = category._id;
  }

  // Sub-Category Filter
  if (req.query.subCategory) {
    filter.subCategory = req.query.subCategory;
  }

  // Price Range Filter
  if (req.query.minPrice || req.query.maxPrice) {
    filter.price = {};
    if (req.query.minPrice) filter.price.$gte = Number(req.query.minPrice);
    if (req.query.maxPrice) filter.price.$lte = Number(req.query.maxPrice);
  }

  // Rating Filter
  if (req.query.minRating) {
    filter.ratingsAverage = { $gte: Number(req.query.minRating) };
  }

  // Tag Filter
  if (req.query.tag) {
    filter["tag.slug"] = req.query.tag;
  }

  // Search Query
  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: "i" } },
      { description: { $regex: req.query.search, $options: "i" } },
    ];
  }

  // 2) EXECUTE QUERY
  const features = new APIFeatures(
    Product.find(filter).populate("category"),
    req.query
  )
    .sort()
    .limitFields()
    .paginate();

  const products = await features.query;

  // 3) SEND RESPONSE
  res.status(200).json({
    status: "success",
    results: products.length,
    data: {
      products,
    },
  });
});

exports.getProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findOne({ slug: req.params.slug });

  if (!product) {
    return next(new AppError("No product found with that slug", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      product,
    },
  });
});

exports.createProduct = catchAsync(async (req, res, next) => {
  // 1) Check if category exists
  const category = await Category.findById(req.body.category);
  if (!category) {
    return next(new AppError("No category found with that ID", 404));
  }

  // 2) Create product
  const newProduct = await Product.create(req.body);

  res.status(201).json({
    status: "success",
    data: {
      product: newProduct,
    },
  });
});

exports.updateProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!product) {
    return next(new AppError("No product found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      product,
    },
  });
});

exports.deleteProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findByIdAndDelete(req.params.id);

  if (!product) {
    return next(new AppError("No product found with that ID", 404));
  }

  res.status(204).json({
    status: "success",
    data: null,
  });
});

exports.getProductsByCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findOne({ slug: req.params.categorySlug });
  if (!category) {
    return next(new AppError("No category found with that slug", 404));
  }

  const products = await Product.find({ category: category._id });

  res.status(200).json({
    status: "success",
    results: products.length,
    data: {
      category: category.name,
      products,
    },
  });
});

exports.getProductsBySubCategory = catchAsync(async (req, res, next) => {
  const products = await Product.find({
    subCategory: req.params.subCategorySlug,
  });

  res.status(200).json({
    status: "success",
    results: products.length,
    data: {
      subCategory: req.params.subCategorySlug,
      products,
    },
  });
});
