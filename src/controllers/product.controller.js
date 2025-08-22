const {
  Product,
  Tag,
  Image,
  Attribute,
  Variation,
  VariationOption,
} = require("../models/product.model");
const Category = require("../models/category.model");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const APIFeatures = require("../utils/apiFeatures");
const slugify = require("slugify");
const safeDestroy = require("../utils/safeDestroy");

const successResponse = require("../utils/successResponse");
const errorResponse = require("../utils/errorResponse");

// ------------------ GET ALL PRODUCTS ------------------
exports.getAllProducts = catchAsync(async (req, res, next) => {
  const filter = {};
  const andConditions = [];

  if (req.query.category) {
    const category = await Category.findOne({
      slug: req.query.category,
    }).select("_id");
    if (!category)
      return errorResponse(res, "No category found with that slug", 404);
    andConditions.push({ category: category._id });
  }

  if (req.query.subCategory)
    andConditions.push({ subCategory: req.query.subCategory });

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
    if (!tag) return errorResponse(res, "No tag found with that slug", 404);
    andConditions.push({ tags: tag._id });
  }

  if (req.query.search) {
    const searchRegex = { $regex: req.query.search, $options: "i" };
    andConditions.push({
      $or: [{ name: searchRegex }, { description: searchRegex }],
    });
  }

  if (andConditions.length > 0) filter.$and = andConditions;

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
    .populate("variation_options")
    .populate("image")
    .populate("gallery");

  const features = new APIFeatures(query, req.query)
    .sort()
    .limitFields()
    .paginate();
  const products = await features.query;

  return successResponse(
    res,
    { products, results: products.length },
    "Products fetched successfully"
  );
});

// ------------------ GET SINGLE PRODUCT ------------------
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
    .populate("variation_options")
    .populate("image")
    .populate("gallery");

  if (!product)
    return errorResponse(res, "No product found with that slug", 404);

  return successResponse(res, { product }, "Product fetched successfully");
});

// ------------------ CREATE PRODUCT ------------------
exports.createProduct = catchAsync(async (req, res, next) => {
  let productData = req.body;
  if (typeof req.body.product === "string") {
    try {
      productData = JSON.parse(req.body.product);
    } catch {
      return next(new AppError("Invalid JSON in product field", 400));
    }
  }

  // Destructure
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

  // ------------------ ✅ CATEGORY EXISTENCE CHECK ------------------
  if (!category) {
    return next(new AppError("Category ID is required", 400));
  }

  const categoryDoc = await Category.findById(category);
  if (!categoryDoc) {
    return next(new AppError("No category found with that ID", 404));
  }

  if (subCategory) {
    // Agar subCategory id di gai hai to check karein ke woh isi category ke andar hai
    const subCatExists = categoryDoc.children.id(subCategory);
    if (!subCatExists) {
      return next(
        new AppError("No sub-category found with that ID in this category", 404)
      );
    }
  }

  // ------------------ Helper: Parse Arrays ------------------
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

  try {
    tags = parseToArray(tags, "tags");
    variations = parseToArray(variations, "variations");
    variation_options = parseToArray(variation_options, "variation_options");
  } catch (err) {
    return next(err);
  }

  // ------------------ Tags ------------------
  const tagIds = [];
  for (const tag of tags) {
    let existingTag = await Tag.findOne({ slug: tag.slug });
    if (!existingTag) {
      existingTag = await Tag.create(tag);
    }
    tagIds.push(existingTag._id);
  }

  // ------------------ Variations ------------------
  const variationIds = [];
  for (const variation of variations) {
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

    const variationDoc = await Variation.create({
      value: variation.value,
      attribute: attribute._id,
    });
    variationIds.push(variationDoc._id);
  }

  // ------------------ Variation Options ------------------
  const variationOptionIds = [];
  for (const option of variation_options) {
    const variationOptionDoc = await VariationOption.create({
      title: option.title,
      price: option.price,
      quantity: option.quantity,
      sku: option.sku,
      is_disable: option.is_disable || false,
      image: option.image || null,
      options: option.options,
    });
    variationOptionIds.push(variationOptionDoc._id);
  }

  // ------------------ Image & Gallery ------------------
  let image = null;
  if (req.files?.image && req.files.image.length > 0) {
    const file = req.files.image[0];
    const imageDoc = new Image({
      original: file.path,
      thumbnail: file.path,
    });
    await imageDoc.save();
    image = imageDoc._id;
  }

  let galleryIds = [];
  if (req.files?.gallery && req.files.gallery.length > 0) {
    const imageDocs = await Promise.all(
      req.files.gallery.map(async (file) => {
        const img = new Image({
          original: file.path,
          thumbnail: file.path,
        });
        await img.save();
        return img;
      })
    );
    galleryIds = imageDocs.map((img) => img._id);
  }

  // ------------------ Name Required ------------------
  if (!name || typeof name !== "string") {
    return next(
      new AppError("Product name is required and must be a string", 400)
    );
  }

  // ------------------ CREATE PRODUCT ------------------
  const product = await Product.create({
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
    tags: tagIds,
    product_type,
    max_price,
    min_price,
    variations: variationIds,
    variation_options: variationOptionIds,
    image,
    gallery: galleryIds,
    is_active: true,
  });

  res.status(201).json({
    status: "success",
    data: { product },
  });
});

// ------------------ UPDATE PRODUCT ------------------
exports.updateProduct = catchAsync(async (req, res, next) => {
  let productData = req.body;
  if (typeof req.body.product === "string") {
    try {
      productData = JSON.parse(req.body.product);
    } catch {
      return next(new AppError("Invalid JSON in product field", 400));
    }
  }

  const { category, subCategory, tags, variations, variation_options } =
    productData;

  // ------------------ ✅ CATEGORY EXISTENCE CHECK ------------------
  if (category) {
    const categoryDoc = await Category.findById(category);
    if (!categoryDoc) {
      return next(new AppError("No category found with that ID", 404));
    }

    if (subCategory) {
      const subCatExists = categoryDoc.children.id(subCategory);
      if (!subCatExists) {
        return next(
          new AppError(
            "No sub-category found with that ID in this category",
            404
          )
        );
      }
    }
  }

  // ------------------ Helper: Parse Arrays ------------------
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

  let parsedTags = [];
  let parsedVariations = [];
  let parsedVariationOptions = [];

  try {
    parsedTags = parseToArray(tags, "tags");
    parsedVariations = parseToArray(variations, "variations");
    parsedVariationOptions = parseToArray(
      variation_options,
      "variation_options"
    );
  } catch (err) {
    return next(err);
  }

  // ------------------ Tags ------------------
  const tagIds = [];
  for (const tag of parsedTags) {
    let existingTag = await Tag.findOne({ slug: tag.slug });
    if (!existingTag) {
      existingTag = await Tag.create(tag);
    }
    tagIds.push(existingTag._id);
  }

  // ------------------ Variations ------------------
  const variationIds = [];
  for (const variation of parsedVariations) {
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

    const variationDoc = await Variation.create({
      value: variation.value,
      attribute: attribute._id,
    });
    variationIds.push(variationDoc._id);
  }

  // ------------------ Variation Options ------------------
  const variationOptionIds = [];
  for (const option of parsedVariationOptions) {
    const variationOptionDoc = await VariationOption.create({
      title: option.title,
      price: option.price,
      quantity: option.quantity,
      sku: option.sku,
      is_disable: option.is_disable || false,
      image: option.image || null,
      options: option.options,
    });
    variationOptionIds.push(variationOptionDoc._id);
  }

  // ------------------ Image & Gallery ------------------
  let image = null;
  if (req.files?.image && req.files.image.length > 0) {
    const file = req.files.image[0];
    const imageDoc = new Image({
      original: file.path,
      thumbnail: file.path,
    });
    await imageDoc.save();
    image = imageDoc._id;
  }

  let galleryIds = [];
  if (req.files?.gallery && req.files.gallery.length > 0) {
    const imageDocs = await Promise.all(
      req.files.gallery.map(async (file) => {
        const img = new Image({
          original: file.path,
          thumbnail: file.path,
        });
        await img.save();
        return img;
      })
    );
    galleryIds = imageDocs.map((img) => img._id);
  }

  // ------------------ UPDATE PRODUCT ------------------
  const updatedProduct = await Product.findByIdAndUpdate(
    req.params.id,
    {
      ...productData,
      tags: tagIds,
      variations: variationIds,
      variation_options: variationOptionIds,
      ...(image && { image }),
      ...(galleryIds.length > 0 && { gallery: galleryIds }),
    },
    { new: true, runValidators: true }
  );

  if (!updatedProduct) {
    return next(new AppError("No product found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: { product: updatedProduct },
  });
});

// ------------------ DELETE PRODUCT ------------------
exports.deleteProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) return errorResponse(res, "No product found with that ID", 404);

  if (product.image?.original) await safeDestroy(product.image.original);
  if (product.gallery?.length) {
    for (const imgId of product.gallery) await safeDestroy(imgId);
  }

  await Product.findByIdAndDelete(req.params.id);

  return successResponse(res, null, "Product deleted successfully", 204);
});
