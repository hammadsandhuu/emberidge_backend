const Product = require("../models/product.model");
const Tag = require("../models/tag.model");
const Image = require("../models/image.model");
const Attribute = require("../models/attribute.model");
const Variation = require("../models/variation.model");
const VariationOption = require("../models/variationOption.model");
const Category = require("../models/category.model");

const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const APIFeatures = require("../utils/apiFeatures");
const safeDestroy = require("../utils/safeDestroy");
const successResponse = require("../utils/successResponse");
const errorResponse = require("../utils/errorResponse");
const { generateUniqueSlug, createSlug } = require("../utils/slug");
const formatAdditionalInfo = require("../utils/formatAdditionalInfo");

// ------------------ GET ALL PRODUCTS (WITH FILTERS) ------------------
exports.getAllProducts = catchAsync(async (req, res, next) => {
  const countQuery = new APIFeatures(Product.find(), req.query);
  await countQuery.buildFilters();
  const filteredCount = await countQuery.query.countDocuments();
  const features = new APIFeatures(Product.find(), req.query);
  await features.buildFilters();
  features.sort().limitFields().paginate(filteredCount);

  const products = await features.query
    .populate("tags", "name slug")
    .populate("category", "name slug")
    .populate("subCategory", "name slug")
    .populate({
      path: "variations",
      populate: { path: "attribute", select: "slug name type values" },
    })
    .populate({
      path: "variation_options",
      populate: {
        path: "attributes.attribute",
        select: "slug name type values",
      },
    })
    .populate("image gallery", "original thumbnail");

  const formattedProducts = products.map((p) => ({
    ...p.toObject(),
    additional_info: formatAdditionalInfo(p.toObject()),
  }));

  return successResponse(
    res,
    {
      products: formattedProducts,
      pagination: features.pagination,
    },
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

  // Format reviews: helpful / not_helpful counts
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

// ------------------ GET PRODUCTS BY PARENT CATEGORY (WITH FILTERS) ------------------
exports.getProductsByCategory = catchAsync(async (req, res, next) => {
  const { parent: parentSlug } = req.query;

  // Step 1: Create base query
  let query = Product.find();

  // Step 2: Apply all filters using APIFeatures
  const features = new APIFeatures(query, req.query);
  await features.buildFilters();

  // Step 3: Get the filter object that was built
  const filter = features.query.getFilter();

  // Step 4: Count total products AFTER applying all filters
  const totalProducts = await Product.countDocuments(filter);

  // Step 5: Apply sorting, field limiting, and pagination
  features.sort().limitFields().paginate(totalProducts);

  const products = await features.query
    .populate("tags", "name slug")
    .populate("category", "name slug")
    .populate("subCategory", "name slug")
    .populate({
      path: "variations",
      populate: { path: "attribute", select: "slug name type values" },
    })
    .populate({
      path: "variation_options",
      populate: {
        path: "attributes.attribute",
        select: "slug name type values",
      },
    })
    .populate("image gallery", "original thumbnail");

  const formattedProducts = products.map((p) => ({
    ...p.toObject(),
    additional_info: formatAdditionalInfo(p.toObject()),
  }));

  return successResponse(
    res,
    {
      products: formattedProducts,
      pagination: features.pagination,
    },
    "Products fetched successfully by parent category"
  );
});

// ------------------ GET PRODUCTS BY CATEGORY + SUB CATEGORIES (WITH FILTERS) ------------------
exports.getProductsByCategorySubCategories = catchAsync(
  async (req, res, next) => {
    const { parent: parentSlug, child: childSlug } = req.query;

    // Step 1: Base filter
    const filter = {};
    const andConditions = [];

    // Step 2: Parent category check
    if (parentSlug) {
      const parentCategory = await Category.findOne({ slug: parentSlug });
      if (!parentCategory) {
        return errorResponse(res, "Parent category not found", 404);
      }
      andConditions.push({ category: parentCategory._id });

      // Step 3: Child category check (only if child is provided)
      if (childSlug) {
        const childCategory = parentCategory.children.find(
          (child) => child.slug === childSlug
        );
        if (!childCategory) {
          return errorResponse(res, "Child category not found", 404);
        }
        andConditions.push({ subCategory: childCategory._id });
      }
    }

    // Apply category filters
    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    // Step 4: Create count query with all filters
    const countQuery = new APIFeatures(Product.find(filter), req.query);
    await countQuery.buildFilters();

    // Get the count of filtered products
    const filteredCount = await countQuery.query.countDocuments();

    // Step 5: Query with all filters + pagination
    const features = new APIFeatures(Product.find(filter), req.query);
    await features.buildFilters();
    features.sort().limitFields().paginate(filteredCount); // Use filtered count

    const products = await features.query
      .populate("tags", "name slug")
      .populate("category", "name slug")
      .populate("subCategory", "name slug")
      .populate({
        path: "variations",
        populate: { path: "attribute", select: "slug name type values" },
      })
      .populate({
        path: "variation_options",
        populate: {
          path: "attributes.attribute",
          select: "slug name type values",
        },
      })
      .populate("image gallery", "original thumbnail");

    const formattedProducts = products.map((p) => ({
      ...p.toObject(),
      additional_info: formatAdditionalInfo(p.toObject()),
    }));

    return successResponse(
      res,
      {
        products: formattedProducts,
        pagination: features.pagination, // Make sure to include pagination in response
      },
      "Products fetched successfully by parent & child category"
    );
  }
);

// ------------------ GET sales PRODUCTS (WITH FILTERS) ------------------
exports.getSaleProducts = catchAsync(async (req, res, next) => {
  // Base filter: only products that are deals (on sale)
  const filter = { on_sale: true }; // OR use `is_deal: true` if you have that field

  // Count total deal products
  const totalProducts = await Product.countDocuments(filter);

  // Apply API features (filters, sort, pagination)
  const features = new APIFeatures(Product.find(filter), req.query);
  await features.buildFilters();
  features.sort().limitFields().paginate(totalProducts);

  // Fetch products with population
  const products = await features.query
    .populate("tags", "name slug")
    .populate("category", "name slug")
    .populate("subCategory", "name slug")
    .populate({
      path: "variations",
      populate: { path: "attribute", select: "slug name type values" },
    })
    .populate({
      path: "variation_options",
      populate: {
        path: "attributes.attribute",
        select: "slug name type values",
      },
    })
    .populate("image gallery", "original thumbnail");

  // Format products
  const formattedProducts = products.map((p) => ({
    ...p.toObject(),
    additional_info: formatAdditionalInfo(p.toObject()),
  }));

  // Success response
  return successResponse(
    res,
    {
      products: formattedProducts,
      pagination: features.pagination,
    },
    "Deal products fetched successfully"
  );
});

// ------------------ GET NEW SELLER PRODUCTS (WITH FILTERS) ------------------
exports.getNewSellerProducts = catchAsync(async (req, res, next) => {
  // Base filter: (optional) if sellerId is passed in query
  const filter = {};
  if (req.query.sellerId) {
    filter.seller = req.query.sellerId; // assuming Product has a 'seller' field
  }

  // Count total products for seller (or all)
  const totalProducts = await Product.countDocuments(filter);

  // Apply API features (filters, pagination, etc.)
  const features = new APIFeatures(Product.find(filter), req.query);
  await features.buildFilters();

  // Force sorting by newest first
  features.query = features.query.sort({ createdAt: -1 });
  features.limitFields().paginate(totalProducts);

  // Fetch products
  const products = await features.query
    .populate("tags", "name slug")
    .populate("category", "name slug")
    .populate("subCategory", "name slug")
    .populate({
      path: "variations",
      populate: { path: "attribute", select: "slug name type values" },
    })
    .populate({
      path: "variation_options",
      populate: {
        path: "attributes.attribute",
        select: "slug name type values",
      },
    })
    .populate("image gallery", "original thumbnail");

  // Format products
  const formattedProducts = products.map((p) => ({
    ...p.toObject(),
    additional_info: formatAdditionalInfo(p.toObject()),
  }));

  // Success response
  return successResponse(
    res,
    {
      products: formattedProducts,
      pagination: features.pagination,
    },
    "New seller products fetched successfully"
  );
});

// ------------------ GET BEST SELLER PRODUCTS (WITH FILTERS) ------------------
exports.getBestSellerProducts = catchAsync(async (req, res, next) => {
  // Base filter: Only products with ratings (ratingsQuantity > 0)
  const filter = {
    is_active: true,
    in_stock: true,
    ratingsQuantity: { $gt: 0 }, // Only products with at least 1 rating
  };

  if (req.query.sellerId) {
    filter.seller = req.query.sellerId;
  }

  // Count total products for seller (or all)
  const totalProducts = await Product.countDocuments(filter);

  // Apply API features (filters, pagination, etc.)
  const features = new APIFeatures(Product.find(filter), req.query);
  await features.buildFilters();

  // Sort by best selling (ratings average and quantity)
  features.query = features.query.sort({
    ratingsAverage: -1,
    ratingsQuantity: -1,
    createdAt: -1,
  });

  features.limitFields().paginate(totalProducts);

  // Fetch products
  const products = await features.query
    .populate("tags", "name slug")
    .populate("category", "name slug")
    .populate("subCategory", "name slug")
    .populate({
      path: "variations",
      populate: { path: "attribute", select: "slug name type values" },
    })
    .populate({
      path: "variation_options",
      populate: {
        path: "attributes.attribute",
        select: "slug name type values",
      },
    })
    .populate("image gallery", "original thumbnail");

  // Format products
  const formattedProducts = products.map((p) => ({
    ...p.toObject(),
    additional_info: formatAdditionalInfo(p.toObject()),
  }));

  // Success response
  return successResponse(
    res,
    {
      products: formattedProducts,
      pagination: features.pagination,
    },
    "Best seller products fetched successfully"
  );
});

// ------------------ GET RELATED PRODUCTS ------------------
exports.getRelatedProducts = catchAsync(async (req, res, next) => {
  const { slug } = req.params;

  // 1. Find current product by slug
  const currentProduct = await Product.findOne({ slug }).select("category subCategory");
  if (!currentProduct) return errorResponse(res, "Product not found", 404);

  // 2. Base filter (exclude current product)
  const filter = {
    _id: { $ne: currentProduct._id },
    is_active: true,
  };

  // 3. Check if category/subCategory passed in query, else fallback to current product
  if (req.query.parent || req.query.child) {
    // yahan APIFeatures parent/child filter handle karega automatically
  } else {
    if (currentProduct.subCategory) {
      filter.subCategory = currentProduct.subCategory;
    } else {
      filter.category = currentProduct.category;
    }
  }

  // 4. Count total related products
  const countQuery = new APIFeatures(Product.find(filter), req.query);
  await countQuery.buildFilters();
  const totalProducts = await countQuery.query.countDocuments();

  // 5. Apply filters + pagination + sorting
  const features = new APIFeatures(Product.find(filter), req.query);
  await features.buildFilters();
  features.sort().limitFields().paginate(totalProducts);

  // 6. Query related products
  const relatedProducts = await features.query
    .populate("tags", "name slug")
    .populate("category", "name slug")
    .populate("subCategory", "name slug")
    .populate({
      path: "variations",
      populate: { path: "attribute", select: "slug name type values" },
    })
    .populate({
      path: "variation_options",
      populate: {
        path: "attributes.attribute",
        select: "slug name type values",
      },
    })
    .populate("image gallery", "original thumbnail");

  // 7. Format products
  const formattedProducts = relatedProducts.map((p) => ({
    ...p.toObject(),
    additional_info: formatAdditionalInfo(p.toObject()),
  }));

  // 8. Response
  return successResponse(
    res,
    {
      products: formattedProducts,
      pagination: features.pagination,
    },
    "Related products fetched successfully"
  );
});

// ------------------ GET TOP 10 SALES PRODUCTS ------------------
exports.getTopSalesProducts = catchAsync(async (req, res, next) => {
  // Base filter: only active & in-stock products
  const baseFilter = { is_active: true, in_stock: true };

  // Allow optional category or seller filters
  if (req.query.categoryId) {
    baseFilter.category = req.query.categoryId;
  }
  if (req.query.sellerId) {
    baseFilter.seller = req.query.sellerId;
  }

  // 🔹 Step 1: Fetch top-selling products (salesCount > 0)
  const salesFilter = { ...baseFilter, salesCount: { $gt: 0 } };

  let products = await Product.find(salesFilter)
    .sort({ salesCount: -1, ratingsAverage: -1 })
    .limit(10)
    .populate("tags", "name slug")
    .populate("category", "name slug")
    .populate("subCategory", "name slug")
    .populate({
      path: "variations",
      populate: { path: "attribute", select: "slug name type values" },
    })
    .populate({
      path: "variation_options",
      populate: {
        path: "attributes.attribute",
        select: "slug name type values",
      },
    })
    .populate("image gallery", "original thumbnail");

  // 🔹 Step 2: If no sales data found, fallback to top-rated products
  if (!products || products.length === 0) {
    products = await Product.find(baseFilter)
      .sort({ ratingsAverage: -1, ratingsQuantity: -1 })
      .limit(10)
      .populate("tags", "name slug")
      .populate("category", "name slug")
      .populate("subCategory", "name slug")
      .populate({
        path: "variations",
        populate: { path: "attribute", select: "slug name type values" },
      })
      .populate({
        path: "variation_options",
        populate: {
          path: "attributes.attribute",
          select: "slug name type values",
        },
      })
      .populate("image gallery", "original thumbnail");

    if (!products || products.length === 0) {
      return errorResponse(res, "No products available", 404);
    }

    const formattedTopRated = products.map((p) => ({
      ...p.toObject(),
      additional_info: formatAdditionalInfo(p.toObject()),
    }));

    return successResponse(
      res,
      { products: formattedTopRated },
      "No sales yet — showing top-rated products"
    );
  }

  // 🔹 Step 3: Return top-selling products
  const formattedTopSales = products.map((p) => ({
    ...p.toObject(),
    additional_info: formatAdditionalInfo(p.toObject()),
  }));

  return successResponse(
    res,
    { products: formattedTopSales },
    "Top 10 best-selling products fetched successfully"
  );
});

