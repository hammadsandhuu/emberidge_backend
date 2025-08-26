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
const safeDestroy = require("../utils/safeDestroy");

const successResponse = require("../utils/successResponse");
const errorResponse = require("../utils/errorResponse");
const { generateUniqueSlug, createSlug } = require("../utils/slug");

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
    .populate("tags")
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
    .populate("tags")
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

  // Parse JSON if sent as string
  if (typeof req.body.product === "string") {
    try {
      productData = JSON.parse(req.body.product);
    } catch {
      return errorResponse(res, "Invalid JSON in product field", 400);
    }
  }

  let {
    name,
    category,
    subCategory,
    description,
    videoUrl,
    price,
    sale_price,
    brand,
    model,
    tags,
    variations,
    variation_options,
    product_type,
    max_price,
    min_price,
    quantity,
  } = productData;

  // ------------------ CATEGORY VALIDATION ------------------
  if (!category) return errorResponse(res, "Category ID is required", 400);
  const categoryDoc = await Category.findById(category);
  if (!categoryDoc) return errorResponse(res, "Category not found", 404);
  if (subCategory && !categoryDoc.children.id(subCategory))
    return errorResponse(res, "Sub-category not found in this category", 404);

  // ------------------ HELPER: Parse arrays ------------------
  const parseArray = (data, fieldName) => {
    if (!data) return [];
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed)) throw new Error();
        return parsed;
      } catch {
        throw new AppError(`Invalid JSON for ${fieldName}`, 400);
      }
    }
    if (!Array.isArray(data))
      throw new AppError(`${fieldName} must be an array`, 400);
    return data;
  };

  try {
    tags = parseArray(tags, "tags");
    variations = parseArray(variations, "variations");
    variation_options = parseArray(variation_options, "variation_options");
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 400);
  }

  // ------------------ CREATE TAGS ------------------
  const tagIds = [];
  for (const tag of tags) {
    const slug = tag.slug || createSlug(tag.name);
    let existingTag = await Tag.findOne({ slug });
    if (!existingTag) existingTag = await Tag.create({ name: tag.name, slug });
    tagIds.push(existingTag._id);
  }

  // ------------------ CREATE ATTRIBUTES & VARIATIONS ------------------
  const variationIds = [];
  const attributeMap = {}; // slug -> attributeId

  for (const variation of variations) {
    const attrName = variation.attribute.name;
    const attrSlug = variation.attribute.slug || createSlug(attrName);
    let attribute = await Attribute.findOne({ slug: attrSlug });

    if (!attribute) {
      attribute = await Attribute.create({
        name: attrName,
        slug: attrSlug,
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
    attributeMap[attrSlug] = attribute._id;
  }

  // ------------------ IMAGE & GALLERY ------------------
  let image = null;
  if (req.files?.image?.length) {
    const file = req.files.image[0];
    const imageDoc = new Image({ original: file.path, thumbnail: file.path });
    await imageDoc.save();
    image = imageDoc._id;
  }

  let galleryIds = [];
  if (req.files?.gallery?.length) {
    const imageDocs = await Promise.all(
      req.files.gallery.map(async (file) => {
        const img = new Image({ original: file.path, thumbnail: file.path });
        await img.save();
        return img;
      })
    );
    galleryIds = imageDocs.map((img) => img._id);
  }

  // ------------------ CREATE PRODUCT ------------------
  const baseSlug = createSlug(name);
  const uniqueSlug = await generateUniqueSlug(Product, baseSlug);

  const product = await Product.create({
    name,
    slug: uniqueSlug,
    category,
    subCategory,
    description,
    videoUrl,
    price: product_type === "simple" ? price : null,
    sale_price: product_type === "simple" ? sale_price : null,
    brand,
    model,
    tags: tagIds,
    product_type,
    max_price: product_type === "variable" ? max_price : null,
    min_price: product_type === "variable" ? min_price : null,
    variations: variationIds,
    variation_options: [],
    image,
    gallery: galleryIds,
    is_active: true,
    quantity: product_type === "simple" ? quantity || 0 : 0,
  });

  // ------------------ CREATE VARIATION OPTIONS ------------------
  const variationOptionIds = [];
  for (const option of variation_options) {
    const attributesMapped = option.attributes?.map((attr) => ({
      attribute: attributeMap[attr.name] || attributeMap[createSlug(attr.name)],
      value: attr.value,
    }));

    const optionSlug = option.slug || createSlug(option.title);
    const variationOptionDoc = await VariationOption.create({
      title: option.title,
      price: option.price,
      quantity: option.quantity,
      sku: option.sku,
      is_disable: option.is_disable || false,
      image: option.image || null,
      attributes: attributesMapped || [],
      product: product._id,
      slug: optionSlug,
    });

    variationOptionIds.push(variationOptionDoc._id);
  }

  product.variation_options = variationOptionIds;
  await product.save();

  return successResponse(res, { product }, "Product created successfully", 201);
});

// ------------------ UPDATE PRODUCT ------------------
exports.updateProduct = catchAsync(async (req, res, next) => {
  let productData = req.body;

  // Parse JSON if sent as string
  if (typeof req.body.product === "string") {
    try {
      productData = JSON.parse(req.body.product);
    } catch {
      return errorResponse(res, "Invalid JSON in product field", 400);
    }
  }

  const {
    category,
    subCategory,
    tags,
    variations,
    variation_options,
    product_type,
    quantity,
    price,
    sale_price,
  } = productData;

  // ------------------ CATEGORY VALIDATION ------------------
  if (category) {
    const categoryDoc = await Category.findById(category);
    if (!categoryDoc)
      return errorResponse(res, "No category found with that ID", 404);

    if (subCategory && !categoryDoc.children.id(subCategory))
      return errorResponse(
        res,
        "No sub-category found with that ID in this category",
        404
      );
  }

  // ------------------ HELPER: Parse arrays ------------------
  const parseArray = (data, fieldName) => {
    if (!data) return [];
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed)) throw new Error();
        return parsed;
      } catch {
        throw new AppError(`Invalid JSON for ${fieldName}`, 400);
      }
    }
    if (!Array.isArray(data))
      throw new AppError(`${fieldName} must be an array`, 400);
    return data;
  };

  const parsedTags = parseArray(tags, "tags");
  const parsedVariations = parseArray(variations, "variations");
  const parsedVariationOptions = parseArray(
    variation_options,
    "variation_options"
  );

  // ------------------ TAGS ------------------
  const tagIds = [];
  for (const tag of parsedTags) {
    const slug = tag.slug || createSlug(tag.name);
    let existingTag = await Tag.findOne({ slug });
    if (!existingTag) existingTag = await Tag.create({ name: tag.name, slug });
    tagIds.push(existingTag._id);
  }

  // ------------------ VARIATIONS & ATTRIBUTES ------------------
  const variationIds = [];
  const attributeMap = {}; // slug -> attributeId

  for (const variation of parsedVariations) {
    const attrName = variation.attribute.name;
    const attrSlug = variation.attribute.slug || createSlug(attrName);

    let attribute = await Attribute.findOne({ slug: attrSlug });
    if (!attribute) {
      attribute = await Attribute.create({
        name: attrName,
        slug: attrSlug,
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
    attributeMap[attrSlug] = attribute._id;
  }

  // ------------------ VARIATION OPTIONS ------------------
  const variationOptionIds = [];
  for (const option of parsedVariationOptions) {
    const attributesMapped = option.attributes?.map((attr) => ({
      attribute: attributeMap[attr.name] || attributeMap[createSlug(attr.name)],
      value: attr.value,
    }));

    const optionSlug = option.slug || createSlug(option.title);
    const variationOptionDoc = await VariationOption.create({
      title: option.title,
      price: option.price,
      quantity: option.quantity,
      sku: option.sku,
      is_disable: option.is_disable || false,
      image: option.image || null,
      attributes: attributesMapped || [],
      product: req.params.id,
      slug: optionSlug,
    });

    variationOptionIds.push(variationOptionDoc._id);
  }

  // ------------------ IMAGE & GALLERY ------------------
  let image = null;
  if (req.files?.image?.length > 0) {
    const file = req.files.image[0];
    const imageDoc = new Image({ original: file.path, thumbnail: file.path });
    await imageDoc.save();
    image = imageDoc._id;
  }

  let galleryIds = [];
  if (req.files?.gallery?.length > 0) {
    const imageDocs = await Promise.all(
      req.files.gallery.map(async (file) => {
        const img = new Image({ original: file.path, thumbnail: file.path });
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
      ...(product_type === "simple" && { price, sale_price, quantity }),
      ...(product_type === "variable" && {
        min_price: productData.min_price,
        max_price: productData.max_price,
      }),
    },
    { new: true, runValidators: true }
  );

  if (!updatedProduct)
    return errorResponse(res, "No product found with that ID", 404);

  return successResponse(
    res,
    { product: updatedProduct },
    "Product updated successfully"
  );
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

// ------------------ GET PRODUCTS BY CATEGORY ------------------
exports.getProductsByCategory = catchAsync(async (req, res, next) => {
  const { categorySlug, subCategorySlug } = req.params;

  //  Validate category
  const category = await Category.findOne({ slug: categorySlug });
  if (!category)
    return errorResponse(res, "No category found with that slug", 404);

  let filter = { category: category._id };

  //  If subCategory provided, validate
  if (subCategorySlug) {
    const subCategory = category.children.find(
      (child) => child.slug === subCategorySlug
    );
    if (!subCategory)
      return errorResponse(res, "No sub-category found with that slug", 404);

    filter.subCategory = subCategory._id;
  }

  //  Query products
  let query = Product.find(filter)
    .populate("tags")
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

  //  Apply API features (pagination, sorting, filtering)
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
