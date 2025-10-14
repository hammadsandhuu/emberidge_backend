const mongoose = require("mongoose");
const Deal = require("../models/deal.model");
const Product = require("../models/product.model");
const Category = require("../models/category.model");
const catchAsync = require("../utils/catchAsync");
const successResponse = require("../utils/successResponse");
const errorResponse = require("../utils/errorResponse");
const APIFeatures = require("../utils/apiFeatures");

// ---------------- CREATE DEAL ----------------
exports.createDeal = catchAsync(async (req, res) => {
  let dealData = req.body;

  if (typeof req.body.deal === "string") {
    try {
      dealData = JSON.parse(req.body.deal);
    } catch {
      return errorResponse(res, "Invalid JSON in deal field", 400);
    }
  }

  const {
    title,
    description,
    discountType,
    discountValue,
    startDate,
    endDate,
    products = [],
    categories = [],
    subCategories = [],
    isGlobal = false,
    isActive = false,
    priority = 1,
    btnText,
  } = dealData;

  if (!title || !discountType || !discountValue || !startDate || !endDate) {
    return errorResponse(res, "Missing required fields", 400);
  }

  // ✅ Validate Products
  let validProducts = [];
  if (products.length > 0) {
    const productDocs = await Product.find({
      _id: { $in: products.map((id) => new mongoose.Types.ObjectId(id)) },
    }).select("_id name");
    if (productDocs.length !== products.length) {
      const missing = products.filter(
        (id) => !productDocs.some((p) => p._id.toString() === id)
      );
      return errorResponse(
        res,
        `Invalid product IDs: ${missing.join(", ")}`,
        400
      );
    }
    validProducts = productDocs.map((p) => p._id);
  }

  // ✅ Validate Categories
  let validCategories = [];
  if (categories.length > 0) {
    const categoryDocs = await Category.find({
      _id: { $in: categories.map((id) => new mongoose.Types.ObjectId(id)) },
    }).select("_id name");
    if (categoryDocs.length !== categories.length) {
      const missing = categories.filter(
        (id) => !categoryDocs.some((c) => c._id.toString() === id)
      );
      return errorResponse(
        res,
        `Invalid category IDs: ${missing.join(", ")}`,
        400
      );
    }
    validCategories = categoryDocs.map((c) => c._id);
  }

  // ✅ Validate SubCategories
  let validSubCategories = [];
  if (subCategories.length > 0) {
    const subDocs = await Category.find({
      _id: { $in: subCategories.map((id) => new mongoose.Types.ObjectId(id)) },
    }).select("_id name");
    if (subDocs.length !== subCategories.length) {
      const missing = subCategories.filter(
        (id) => !subDocs.some((c) => c._id.toString() === id)
      );
      return errorResponse(
        res,
        `Invalid subCategory IDs: ${missing.join(", ")}`,
        400
      );
    }
    validSubCategories = subDocs.map((c) => c._id);
  }

  // ✅ Handle Images
  let image = { desktop: null, mobile: null };
  if (req.files?.desktop?.[0]) {
    image.desktop = {
      url: req.files.desktop[0].path,
      public_id: req.files.desktop[0].filename,
    };
  }
  if (req.files?.mobile?.[0]) {
    image.mobile = {
      url: req.files.mobile[0].path,
      public_id: req.files.mobile[0].filename,
    };
  }

  const deal = await Deal.create({
    title,
    description,
    discountType,
    discountValue,
    startDate,
    endDate,
    products: validProducts,
    categories: validCategories,
    subCategories: validSubCategories,
    isGlobal,
    isActive,
    priority,
    image,
    btnText,
    createdBy: req.user?._id,
  });

  return successResponse(res, { deal }, "Deal created successfully", 201);
});

// ---------------- GET ALL DEALS ----------------
exports.getAllDeals = catchAsync(async (req, res) => {
  const totalDeals = await Deal.countDocuments();
  const features = new APIFeatures(Deal.find(), req.query);
  await features.buildFilters();
  features.sort().limitFields().paginate(totalDeals);

  const deals = await features.query
    .populate("categories", "name slug")
    .populate("subCategories", "name slug")
    .populate({
      path: "products",
      select: "name slug price sale_price image category subCategory",
      populate: [
        { path: "image", select: "original thumbnail" },
        { path: "category", select: "name slug" },
        { path: "subCategory", select: "name slug" },
      ],
    })
    .lean();

  const formattedDeals = [];
  for (const deal of deals) {
    const catProducts = await Product.find({
      $or: [
        { category: { $in: deal.categories.map((c) => c._id) } },
        { subCategory: { $in: deal.subCategories.map((s) => s._id) } },
        { _id: { $in: deal.products.map((p) => p._id) } },
      ],
    })
      .populate("image", "original thumbnail")
      .populate("category", "name slug")
      .populate("subCategory", "name slug")
      .lean();

    const discountedProducts = catProducts.map((p) => {
      let discountedPrice = p.sale_price || p.price;
      if (deal.discountType === "percentage") {
        discountedPrice = p.price - (p.price * deal.discountValue) / 100;
      } else if (["fixed", "flat"].includes(deal.discountType)) {
        discountedPrice = Math.max(0, p.price - deal.discountValue);
      }
      return { ...p, discountedPrice };
    });

    formattedDeals.push({ ...deal, products: discountedProducts });
  }

  return successResponse(
    res,
    { deals: formattedDeals, pagination: features.pagination },
    "Deals fetched successfully"
  );
});

// ---------------- GET SINGLE DEAL ----------------
exports.getDeal = catchAsync(async (req, res) => {
  const { id } = req.params;
  const deal = await Deal.findById(id)
    .populate("categories", "name slug")
    .populate("subCategories", "name slug")
    .populate("products", "name slug price sale_price category subCategory");

  if (!deal) return errorResponse(res, "Deal not found", 404);
  return successResponse(res, { deal }, "Deal fetched successfully");
});
