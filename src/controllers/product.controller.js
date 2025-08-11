// controllers/product.controller.js
const { Product, Tag } = require("../models/product.model");
const Category = require("../models/category.model");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const APIFeatures = require("../utils/apiFeatures");
const slugify = require("slugify");
const safeDestroy = require("../utils/safeDestroy");
const { Attribute } = require("../models/product.model");
const { Variation } = require("../models/product.model");
const { VariationOption } = require("../models/product.model");

// GET ALL PRODUCTS
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
    const tag = await Tag.findOne({ slug: req.query.tag }).select("_id");
    if (!tag) return next(new AppError("No tag found with that slug", 404));
    andConditions.push({ tags: tag._id });
  }

  if (req.query.search) {
    const searchRegex = { $regex: req.query.search, $options: "i" };
    andConditions.push({
      $or: [{ name: searchRegex }, { description: searchRegex }],
    });
  }

  if (andConditions.length > 0) filter.$and = andConditions;

  // Build query with populate BEFORE execution
  let query = Product.find(filter)
    .populate("category tags")
    .populate({
      path: "variations",
      populate: {
        path: "attribute",
        model: "Attribute",
        select: "slug name type values",
      },
    })
    .populate("variation_options");

  // Apply APIFeatures on the query object
  const features = new APIFeatures(query, req.query)
    .sort()
    .limitFields()
    .paginate();

  const products = await features.query;

  res.status(200).json({
    status: "success",
    results: products.length,
    data: { products },
  });
});

// GET SINGLE PRODUCT
exports.getProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findOne({ slug: req.params.slug })
    .populate("category tags")
    .populate({
      path: "variations",
      populate: {
        path: "attribute",
        model: "Attribute",
        select: "slug name type values",
      },
    })
    .populate("variation_options");

  if (!product)
    return next(new AppError("No product found with that slug", 404));

  res.status(200).json({ status: "success", data: { product } });
});

// CREATE PRODUCT
exports.createProduct = catchAsync(async (req, res, next) => {
  // Step 0: If product data is inside req.body.product as a JSON string, parse it first
  let productData = req.body;
  if (typeof req.body.product === "string") {
    try {
      productData = JSON.parse(req.body.product);
    } catch {
      return next(new AppError("Invalid JSON in product field", 400));
    }
  }

  // Destructure productData
  let {
    name,
    category,
    subCategory,
    description,
    videoUrl,
    price,
    sale_price,
    brand,
    operating,
    screen,
    model,
    tags,
    variations,
    variation_options,
    product_type,
    max_price,
    min_price,
  } = productData;

  // Helper to safely parse JSON strings to arrays
  function parseToArray(data, fieldName) {
    if (!data) return [];
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed)) {
          throw new Error(`${fieldName} must be an array`);
        }
        return parsed;
      } catch {
        throw new AppError(`Invalid JSON format for ${fieldName}`, 400);
      }
    }
    if (!Array.isArray(data)) {
      throw new AppError(`${fieldName} must be an array`, 400);
    }
    return data;
  }

  // Parse arrays safely
  try {
    tags = parseToArray(tags, "tags");
    variations = parseToArray(variations, "variations");
    variation_options = parseToArray(variation_options, "variation_options");
  } catch (err) {
    return next(err);
  }

  // 1. Create or find Tags
  const tagIds = [];
  for (const tag of tags) {
    let existingTag = await Tag.findOne({ slug: tag.slug });
    if (!existingTag) {
      existingTag = await Tag.create(tag);
    }
    tagIds.push(existingTag._id);
  }

  // 2. Create or find Attributes + their Values + Variations
  const variationIds = [];
  for (const variation of variations) {
    // Check if attribute exists
    let attribute = await Attribute.findOne({ slug: variation.attribute.slug });
    if (!attribute) {
      attribute = await Attribute.create({
        slug: variation.attribute.slug,
        name: variation.attribute.name,
        type: variation.attribute.type,
        values: variation.attribute.values.map((v) => ({
          value: v.value,
          image: v.image || null,
        })),
      });
    }
    // Create Variation with attribute reference
    const variationDoc = await Variation.create({
      value: variation.value,
      attribute: attribute._id,
    });
    variationIds.push(variationDoc._id);
  }

  // 3. Create VariationOptions
  const variationOptionIds = [];
  for (const option of variation_options) {
    const variationOptionDoc = await VariationOption.create({
      title: option.title,
      price: option.price,
      quantity: option.quantity,
      sku: option.sku,
      is_disable: option.is_disable || false,
      image: option.image || null,
      options: option.options, // array of {name, value}
    });
    variationOptionIds.push(variationOptionDoc._id);
  }

  // 4. Prepare image and gallery from files if uploaded
  let image = null;
  if (req.files?.image && req.files.image.length > 0) {
    image = {
      original: req.files.image[0].path,
      thumbnail: req.files.image[0].path,
    };
  }

  let gallery = [];
  if (req.files?.gallery && req.files.gallery.length > 0) {
    gallery = req.files.gallery.map((file) => file.path);
  }

  // 5. Validate name and create slug from name
  if (!name || typeof name !== "string") {
    return next(
      new AppError("Product name is required and must be a string", 400)
    );
  }
  const slug = slugify(name, { lower: true, strict: true });

  // 6. Create Product
  const product = await Product.create({
    name,
    slug,
    category,
    subCategory,
    description,
    videoUrl,
    price,
    sale_price,
    brand,
    operating,
    screen,
    model,
    tags: tagIds,
    product_type,
    max_price,
    min_price,
    variations: variationIds,
    variation_options: variationOptionIds,
    image,
    gallery,
    is_active: true,
  });

  res.status(201).json({
    status: "success",
    data: { product },
  });
});

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
    if (!category.children.id(subCatId)) {
      return next(
        new AppError("No sub-category found with that ID in this category", 404)
      );
    }
    req.body.category = categoryId;
    req.body.subCategory = subCatId;
  }

  // Replace main image if uploaded
  if (req.files?.image?.[0]) {
    if (existingProduct.image?.original)
      await safeDestroy(existingProduct.image.original);
    req.body.image = {
      original: req.files.image[0].path,
      thumbnail: req.files.image[0].path,
    };
  }

  // Replace gallery if uploaded
  if (req.files?.gallery && req.files.gallery.length > 0) {
    if (existingProduct.gallery?.length > 0) {
      for (const imgId of existingProduct.gallery) {
        await safeDestroy(imgId); // if storing paths, adjust here
      }
    }
    req.body.gallery = [];
  }

  // Update slug if name changed
  if (req.body.name) {
    req.body.slug = slugify(req.body.name, { lower: true, strict: true });
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

  if (product.image?.original) await safeDestroy(product.image.original);
  if (product.gallery?.length) {
    for (const imgId of product.gallery) {
      await safeDestroy(imgId);
    }
  }

  await Product.findByIdAndDelete(req.params.id);
  res.status(204).json({ status: "success", data: null });
});
