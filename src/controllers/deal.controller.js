const Deal = require("../models/deal.model");
const Product = require("../models/product.model");
const catchAsync = require("../utils/catchAsync");
const successResponse = require("../utils/successResponse");
const errorResponse = require("../utils/errorResponse");
const APIFeatures = require("../utils/apiFeatures");

// ---------------- CREATE DEAL ----------------
exports.createDeal = catchAsync(async (req, res, next) => {
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
    discountType,
    discountValue,
    startDate,
    endDate,
    products,
    categories,
    isGlobal,
    priority,
  } = dealData;

  if (!title || !discountType || !discountValue || !startDate || !endDate) {
    return errorResponse(res, "Missing required fields", 400);
  }

  const deal = await Deal.create({
    title,
    discountType,
    discountValue,
    startDate,
    endDate,
    products,
    categories,
    isGlobal,
    priority,
    createdBy: req.user?._id,
  });

  return successResponse(res, { deal }, "Deal created successfully", 201);
});

// ---------------- UPDATE DEAL ----------------
exports.updateDeal = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const deal = await Deal.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!deal) return errorResponse(res, "Deal not found", 404);

  return successResponse(res, { deal }, "Deal updated successfully");
});

// ---------------- DELETE DEAL ----------------
exports.deleteDeal = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const deal = await Deal.findByIdAndDelete(id);
  if (!deal) return errorResponse(res, "Deal not found", 404);

  return successResponse(res, null, "Deal deleted successfully");
});

// ---------------- GET ALL DEALS (WITH FILTERS + PAGINATION) ----------------
exports.getAllDeals = catchAsync(async (req, res, next) => {
  // Count total deals
  const totalDeals = await Deal.countDocuments();

  // Apply query features (filter, sort, limitFields, pagination)
  const features = new APIFeatures(Deal.find(), req.query);
  await features.buildFilters();
  features.sort().limitFields().paginate(totalDeals);

  // Fetch deals with population
  const deals = await features.query
    .populate({
      path: "products",
      select: "name slug price sale_price image",
      populate: [
        { path: "image", select: "original thumbnail" },
        { path: "category", select: "name slug" },
        { path: "subCategory", select: "name slug" },
      ],
    })
    .populate("categories", "name slug");

  // Format response (example: add discounted price per product)
  const formattedDeals = deals.map((deal) => {
    const d = deal.toObject();

    // Add computed discount values to products
    d.products = d.products.map((p) => {
      let discountedPrice = p.sale_price || p.price;

      if (deal.discountType === "percentage") {
        discountedPrice = p.price - (p.price * deal.discountValue) / 100;
      } else if (deal.discountType === "fixed") {
        discountedPrice = Math.max(0, p.price - deal.discountValue);
      }

      return {
        ...p,
        discountedPrice,
      };
    });

    return d;
  });

  return successResponse(
    res,
    {
      deals: formattedDeals,
      pagination: features.pagination,
    },
    "Deals fetched successfully"
  );
});


// ---------------- GET SINGLE DEAL ----------------
exports.getDeal = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const deal = await Deal.findById(id)
    .populate("products", "name slug price sale_price")
    .populate("categories", "name slug");

  if (!deal) return errorResponse(res, "Deal not found", 404);

  return successResponse(res, { deal }, "Deal fetched successfully");
});
