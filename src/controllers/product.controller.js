const {
  Product,
  Review,
  Tag,
  Image,
  Attribute,
  Variation,
  VariationOption,
  updateProductRatings,
} = require("../models/product.model");
const Category = require("../models/category.model");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const APIFeatures = require("../utils/apiFeatures");
const safeDestroy = require("../utils/safeDestroy");

const successResponse = require("../utils/successResponse");
const errorResponse = require("../utils/errorResponse");
const { generateUniqueSlug, createSlug } = require("../utils/slug");
const formatAdditionalInfo = require("../utils/formatAdditionalInfo");

// ------------------ GET ALL PRODUCTS ------------------
exports.getAllProducts = catchAsync(async (req, res, next) => {
  const filter = {};
  const andConditions = [];

  /* ------------------ FILTERING ------------------ */
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

  /* ------------------ QUERY WITH POPULATE ------------------ */
  let query = Product.find(filter)
    .populate("tags", "name slug")
    .populate({
      path: "variations",
      populate: {
        path: "attribute",
        model: "Attribute",
        select: "slug name type values",
      },
    })
    .populate({
      path: "variation_options",
      populate: {
        path: "attributes.attribute",
        model: "Attribute",
        select: "slug name type values",
      },
    })
    .populate("image", "original thumbnail")
    .populate("gallery", "original thumbnail");

  const features = new APIFeatures(query, req.query)
    .sort()
    .limitFields()
    .paginate();

  let products = await features.query;

  /* ------------------ FORMAT ADDITIONAL INFO ------------------ */
  products = products.map((product) => {
    const obj = product.toObject();
    obj.additional_info = formatAdditionalInfo(obj);
    return obj;
  });

  return successResponse(
    res,
    { products, results: products.length },
    "Products fetched successfully"
  );
});

// ------------------ GET SINGLE PRODUCT ------------------
exports.getProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findOne({ slug: req.params.slug })
    .populate("tags", "name slug")
    .populate({
      path: "variations",
      populate: {
        path: "attribute",
        model: "Attribute",
        select: "slug name type values",
      },
    })
    .populate({
      path: "variation_options",
      populate: {
        path: "attributes.attribute",
        model: "Attribute",
        select: "slug name type values",
      },
    })
    .populate("image", "original thumbnail")
    .populate("gallery", "original thumbnail")
    .populate({
      path: "reviews",
      match: { is_approved: true },
      populate: {
        path: "user",
        select: "name email",
      },
    });

  if (!product)
    return errorResponse(res, "No product found with that slug", 404);

  const productData = product.toObject();

  // Format reviews: calculate helpful/not_helpful counts and remove users array
  productData.reviews = productData.reviews.map((review) => ({
    ...review,
    helpful: review.helpfulUsers ? review.helpfulUsers.length : 0,
    not_helpful: review.notHelpfulUsers ? review.notHelpfulUsers.length : 0,
    helpfulUsers: undefined,
    notHelpfulUsers: undefined,
  }));

  // Format additional_info
  productData.additional_info = formatAdditionalInfo(productData);

  return successResponse(
    res,
    { product: productData },
    "Product fetched successfully"
  );
});

// ------------------ CREATE PRODUCT ------------------
exports.createProduct = catchAsync(async (req, res, next) => {
  let productData = req.body;

  // Parse product JSON if sent as string
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
    product_details,
    additional_info,
    videoUrl,
    price,
    sale_price,
    on_sale, // Sale status
    sale_start, // Sale start date
    sale_end, // Sale end date
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

  // Validate category
  if (!category) return errorResponse(res, "Category ID is required", 400);
  const categoryDoc = await Category.findById(category);
  if (!categoryDoc) return errorResponse(res, "Category not found", 404);
  if (subCategory && !categoryDoc.children.id(subCategory))
    return errorResponse(res, "Sub-category not found in this category", 404);

  // Helper to parse arrays
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

  // ----------- ADDITIONAL INFO -----------
  if (additional_info && typeof additional_info === "string") {
    try {
      additional_info = JSON.parse(additional_info);
    } catch {
      return errorResponse(res, "Invalid JSON in additional_info field", 400);
    }
  }
  if (!additional_info || typeof additional_info !== "object") {
    additional_info = {};
  }

  // ----------- TAGS -----------
  const tagIds = [];
  for (const tag of tags) {
    const slug = tag.slug || createSlug(tag.name);
    let existingTag = await Tag.findOne({ slug });
    if (!existingTag) existingTag = await Tag.create({ name: tag.name, slug });
    tagIds.push(existingTag._id);
  }

  // ----------- VARIATIONS -----------
  const variationIds = [];
  const attributeMap = {};

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

  // ----------- IMAGE & GALLERY -----------
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

  // ----------- SALE FIELDS VALIDATION -----------

  // Check if sale price is less than regular price
  if (on_sale && sale_price >= price) {
    return errorResponse(
      res,
      "Sale price must be less than regular price",
      400
    );
  }

  // Ensure sale dates are valid
  if (on_sale && (!sale_start || !sale_end)) {
    return errorResponse(
      res,
      "Both sale_start and sale_end are required when on_sale is true",
      400
    );
  }

  // ----------- CREATE PRODUCT -----------
  const baseSlug = createSlug(name);
  const uniqueSlug = await generateUniqueSlug(Product, baseSlug);

  const product = await Product.create({
    name,
    slug: uniqueSlug,
    category,
    subCategory,
    description,
    product_details,
    additional_info, // <-- properly included
    videoUrl,
    price: product_type === "simple" ? price : null,
    sale_price: product_type === "simple" && on_sale ? sale_price : null, // Sale price included only if on_sale is true
    on_sale: on_sale || false, // Sale status
    sale_start: on_sale ? new Date(sale_start) : null, // Sale start date
    sale_end: on_sale ? new Date(sale_end) : null, // Sale end date
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

  // ----------- VARIATION OPTIONS -----------
  const variationOptionIds = [];
  for (const option of variation_options) {
    const attributesMapped = option.attributes?.map((attr) => ({
      attribute: attributeMap[attr.name] || attributeMap[createSlug(attr.name)],
      value: attr.value,
    }));

    const optionSlugBase = option.slug || createSlug(option.title);
    const optionSlug = await generateUniqueSlug(
      VariationOption,
      optionSlugBase
    );

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
  const { id } = req.params;
  let updateData = req.body;

  if (typeof req.body.product === "string") {
    try {
      updateData = JSON.parse(req.body.product);
    } catch {
      return errorResponse(res, "Invalid JSON in product field", 400);
    }
  }

  const product = await Product.findById(id);
  if (!product) return errorResponse(res, "Product not found", 404);

  const {
    name,
    category,
    subCategory,
    description,
    product_details,
    additional_info,
    price,
    sale_price,
    brand,
    model,
    tags,
    variations,
    variation_options,
    product_type,
    quantity,
  } = updateData;

  /* ------------------ VALIDATE CATEGORY ------------------ */
  if (category) {
    const categoryDoc = await Category.findById(category);
    if (!categoryDoc) return errorResponse(res, "Category not found", 404);

    if (subCategory && !categoryDoc.children.id(subCategory)) {
      return errorResponse(res, "Sub-category not found in this category", 404);
    }
  }

  /* ------------------ PARSE ARRAYS ------------------ */
  const parseArray = (data, fieldName) => {
    if (!data) return undefined;
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

  let parsedTags, parsedVariations, parsedVariationOptions;
  try {
    parsedTags = parseArray(tags, "tags");
    parsedVariations = parseArray(variations, "variations");
    parsedVariationOptions = parseArray(variation_options, "variation_options");
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 400);
  }

  /* ------------------ HANDLE TAGS ------------------ */
  let tagIds;
  if (parsedTags) {
    tagIds = [];
    for (const tag of parsedTags) {
      // Find by name
      let existingTag = await Tag.findOne({ name: tag.name });
      if (!existingTag) {
        existingTag = await Tag.create({ name: tag.name }); // auto-slug
      } else if (tag.name !== existingTag.name) {
        // if tag name changed, update name and slug
        existingTag.name = tag.name;
        await existingTag.save();
      }
      tagIds.push(existingTag._id);
    }
  }

  /* ------------------ HANDLE SLUG UPDATE ------------------ */
  if (name && name !== product.name) {
    const baseSlug = createSlug(name);
    const uniqueSlug = await generateUniqueSlug(Product, baseSlug, product._id);
    product.slug = uniqueSlug;
    product.name = name;
  }

  /* ------------------ SIMPLE FIELD UPDATES ------------------ */
  if (description !== undefined) product.description = description;
  if (product_details !== undefined) product.product_details = product_details;
  if (additional_info !== undefined) product.additional_info = additional_info;
  if (category) product.category = category;
  if (subCategory !== undefined) product.subCategory = subCategory;
  if (price !== undefined) product.price = price;
  if (sale_price !== undefined) product.sale_price = sale_price;
  if (brand !== undefined) product.brand = brand;
  if (model !== undefined) product.model = model;
  if (product_type !== undefined) product.product_type = product_type;
  if (quantity !== undefined) product.quantity = quantity;
  if (tagIds) product.tags = tagIds;

  /* ------------------ HANDLE VARIATIONS (if sent) ------------------ */
  if (parsedVariations) {
    product.variations = [];
    for (const variation of parsedVariations) {
      const newVariation = await Variation.create(variation);
      product.variations.push(newVariation._id);
    }
  }

  if (parsedVariationOptions) {
    product.variation_options = [];
    for (const option of parsedVariationOptions) {
      const newOption = await VariationOption.create({
        ...option,
        product: product._id,
      });
      product.variation_options.push(newOption._id);
    }
  }

  await product.save();

  return successResponse(res, { product }, "Product updated successfully", 200);
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

  return successResponse(res, "Product deleted successfully", 204);
});

// ------------------ GET PRODUCTS BY CATEGORY ------------------
exports.getProductsByCategory = catchAsync(async (req, res, next) => {
  const { categorySlug, subCategorySlug } = req.params;

  const category = await Category.findOne({ slug: categorySlug });
  if (!category)
    return errorResponse(res, "No category found with that slug", 404);

  let filter = { category: category._id };

  if (subCategorySlug) {
    const subCategory = category.children.find(
      (child) => child.slug === subCategorySlug
    );
    if (!subCategory)
      return errorResponse(res, "No sub-category found with that slug", 404);

    filter.subCategory = subCategory._id;
  }

  /* ------------------ QUERY WITH POPULATE ------------------ */
  let query = Product.find(filter)
    .populate("tags", "name slug")
    .populate("category", "name slug")
    .populate("subCategory", "name slug")
    .populate({
      path: "variations",
      populate: {
        path: "attribute",
        model: "Attribute",
        select: "slug name type values",
      },
    })
    .populate({
      path: "variation_options",
      populate: {
        path: "attributes.attribute",
        model: "Attribute",
        select: "slug name type values",
      },
    })
    .populate("image", "original thumbnail")
    .populate("gallery", "original thumbnail")
    .populate({
      path: "reviews",
      populate: {
        path: "user",
        select: "name",
      },
      match: { is_approved: true },
    });

  const features = new APIFeatures(query, req.query)
    .sort()
    .limitFields()
    .paginate();

  let products = await features.query;

  /* ------------------ FORMAT ADDITIONAL INFO ------------------ */
  products = products.map((product) => {
    const obj = product.toObject();
    obj.additional_info = formatAdditionalInfo(obj);
    return obj;
  });

  return successResponse(
    res,
    { products, results: products.length },
    "Products fetched successfully"
  );
});







// ------------------ REVIEW CONTROLLERS ------------------

// ------------------ CREATE REVIEW ------------------
exports.createReview = catchAsync(async (req, res, next) => {
  const { rating, title, comment } = req.body;
  const productId = req.params.id;
  const userId = req.user._id;

  const product = await Product.findById(productId);
  if (!product) return errorResponse(res, "Product not found", 404);

  const existingReview = await Review.findOne({
    product: productId,
    user: userId,
  });
  if (existingReview) {
    return errorResponse(res, "You have already reviewed this product", 400);
  }

  const review = await Review.create({
    product: productId,
    user: userId,
    rating,
    title,
    comment,
    is_approved: true,
  });

  product.reviews.push(review._id);
  await product.save();

  await updateProductRatings(productId);

  const populatedReview = await Review.findById(review._id).populate({
    path: "user",
    select: "name email",
  });

  return successResponse(
    res,
    { review: populatedReview },
    "Review created successfully",
    201
  );
});

// ------------------ GET PRODUCT REVIEWS ------------------
exports.getProductReviews = catchAsync(async (req, res, next) => {
  const productId = req.params.id;

  const reviews = await Review.find({ product: productId, is_approved: true })
    .populate({
      path: "user",
      select: "name email",
    })
    .sort({ createdAt: -1 });

  const product = await Product.findById(productId);
  if (!product) return errorResponse(res, "Product not found", 404);

  return successResponse(
    res,
    {
      reviews,
      total: reviews.length,
      averageRating: product.ratingsAverage,
      totalRatings: product.ratingsQuantity,
    },
    "Reviews fetched successfully"
  );
});

// ------------------ UPDATE REVIEW ------------------
exports.updateReview = catchAsync(async (req, res, next) => {
  const { rating, title, comment } = req.body;
  const reviewId = req.params.reviewId;

  const review = await Review.findById(reviewId);
  if (!review) return errorResponse(res, "Review not found", 404);

  if (
    review.user.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    return errorResponse(res, "You can only update your own reviews", 403);
  }

  const oldRating = review.rating;

  const updatedReview = await Review.findByIdAndUpdate(
    reviewId,
    { rating, title, comment },
    { new: true, runValidators: true }
  ).populate({
    path: "user",
    select: "name email",
  });

  if (rating !== oldRating) {
    await updateProductRatings(review.product);
  }

  return successResponse(
    res,
    { review: updatedReview },
    "Review updated successfully"
  );
});

// ------------------ DELETE REVIEW ------------------
exports.deleteReview = catchAsync(async (req, res, next) => {
  const reviewId = req.params.reviewId;

  const review = await Review.findById(reviewId);
  if (!review) return errorResponse(res, "Review not found", 404);

  if (
    review.user.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    return errorResponse(res, "You can only delete your own reviews", 403);
  }

  await Product.findByIdAndUpdate(review.product, {
    $pull: { reviews: reviewId },
  });

  await Review.findByIdAndDelete(reviewId);

  await updateProductRatings(review.product);

  return successResponse(res, null, "Review deleted successfully", 204);
});

// ------------------ MODERATE REVIEW (ADMIN) ------------------
exports.moderateReview = catchAsync(async (req, res, next) => {
  const { is_approved } = req.body;
  const reviewId = req.params.reviewId;

  const review = await Review.findByIdAndUpdate(
    reviewId,
    { is_approved },
    { new: true, runValidators: true }
  ).populate({
    path: "user",
    select: "name email",
  });

  if (!review) return errorResponse(res, "Review not found", 404);

  await updateProductRatings(review.product);

  return successResponse(
    res,
    { review },
    `Review ${is_approved ? "approved" : "rejected"} successfully`
  );
});

// ------------------ GET ALL REVIEWS (ADMIN) ------------------
exports.getAllReviews = catchAsync(async (req, res, next) => {
  const filter = {};

  if (req.query.status) {
    filter.is_approved = req.query.status === "approved";
  }

  if (req.query.product) {
    filter.product = req.query.product;
  }

  if (req.query.user) {
    filter.user = req.query.user;
  }

  const reviews = await Review.find(filter)
    .populate({
      path: "user",
      select: "name email",
    })
    .populate({
      path: "product",
      select: "name slug",
    })
    .sort({ createdAt: -1 });

  return successResponse(
    res,
    { reviews, total: reviews.length },
    "Reviews fetched successfully"
  );
});

// ------------------ MARK REVIEW HELPFUL ------------------
exports.markReviewHelpful = catchAsync(async (req, res, next) => {
  const reviewId = req.params.reviewId;
  const userId = req.user._id;

  const review = await Review.findById(reviewId);
  if (!review) return errorResponse(res, "Review not found", 404);

  // Remove user from notHelpfulUsers if they had voted not helpful
  review.notHelpfulUsers = review.notHelpfulUsers.filter(
    (id) => id.toString() !== userId.toString()
  );

  if (review.helpfulUsers.some((id) => id.toString() === userId.toString())) {
    // If already marked helpful, toggle off
    review.helpfulUsers = review.helpfulUsers.filter(
      (id) => id.toString() !== userId.toString()
    );
  } else {
    // Otherwise, add user to helpfulUsers
    review.helpfulUsers.push(userId);
  }

  await review.save();

  return successResponse(
    res,
    {
      helpfulCount: review.helpfulUsers.length,
      notHelpfulCount: review.notHelpfulUsers.length,
    },
    "Helpful vote updated"
  );
});

// ------------------ MARK REVIEW NOT HELPFUL ------------------
exports.markReviewNotHelpful = catchAsync(async (req, res, next) => {
  const reviewId = req.params.reviewId;
  const userId = req.user._id;

  const review = await Review.findById(reviewId);
  if (!review) return errorResponse(res, "Review not found", 404);

  // Remove user from helpfulUsers if they had voted helpful
  review.helpfulUsers = review.helpfulUsers.filter(
    (id) => id.toString() !== userId.toString()
  );

  if (
    review.notHelpfulUsers.some((id) => id.toString() === userId.toString())
  ) {
    // If already marked not helpful, toggle off
    review.notHelpfulUsers = review.notHelpfulUsers.filter(
      (id) => id.toString() !== userId.toString()
    );
  } else {
    // Otherwise, add user to notHelpfulUsers
    review.notHelpfulUsers.push(userId);
  }

  await review.save();

  return successResponse(
    res,
    {
      helpfulCount: review.helpfulUsers.length,
      notHelpfulCount: review.notHelpfulUsers.length,
    },
    "Not helpful vote updated"
  );
});

