const Wishlist = require("../models/wishlist.model");
const Product = require("../models/product.model");
const Cart = require("../models/cart.model");
const catchAsync = require("../utils/catchAsync");
const successResponse = require("../utils/successResponse");
const errorResponse = require("../utils/errorResponse");
const APIFeatures = require("../utils/apiFeatures");
const formatAdditionalInfo = require("../utils/formatAdditionalInfo");

// Add to wishlist (upsert)
exports.addToWishlist = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { productId } = req.params;
  if (!productId) return errorResponse(res, "productId is required", 400);

  const product = await Product.findById(productId);
  if (!product) return errorResponse(res, "Product not found", 404);

  // upsert unique user-product entry
  const wishlist = await Wishlist.findOneAndUpdate(
    { user: userId, product: productId },
    { $setOnInsert: { user: userId, product: productId } },
    { new: true, upsert: true }
  );

  return successResponse(res, { wishlist }, "Product added to wishlist");
});

// Remove from wishlist
exports.removeFromWishlist = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { productId } = req.params;
  const removed = await Wishlist.findOneAndDelete({
    user: userId,
    product: productId,
  });
  if (!removed) return errorResponse(res, "Item not found in wishlist", 404);
  return successResponse(res, null, "Product removed from wishlist");
});

// Get wishlist (paginated)
exports.getWishlist = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  // Build features on Wishlist collection; populate product details
  const total = await Wishlist.countDocuments({ user: userId });

  const features = new APIFeatures(
    Wishlist.find({ user: userId }).populate({
      path: "product",
      populate: [
        { path: "tags", select: "name slug" },
        { path: "category", select: "name slug" },
        { path: "subCategory", select: "name slug" },
        {
          path: "variations",
          populate: { path: "attribute", select: "slug name type values" },
        },
        {
          path: "variation_options",
          populate: {
            path: "attributes.attribute",
            select: "slug name type values",
          },
        },
        { path: "image gallery", select: "original thumbnail" },
      ],
    }),
    req.query
  );

  features.sort().limitFields().paginate(total);

  const list = await features.query;
  const formatted = list.map((entry) => {
    const product = entry.product ? entry.product.toObject() : null;
    if (product) product.additional_info = formatAdditionalInfo(product);
    return {
      _id: entry._id,
      user: entry.user,
      product,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  });

  return successResponse(
    res,
    { wishlist: formatted, pagination: features.pagination },
    "Wishlist fetched successfully"
  );
});

// Move a wishlist item to cart
exports.moveToCart = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { productId } = req.params;

  const product = await Product.findById(productId);
  if (!product) return errorResponse(res, "Product not found", 404);
  if (!product.in_stock) return errorResponse(res, "Product out of stock", 400);

  // Remove wishlist entry (if exists)
  await Wishlist.findOneAndDelete({ user: userId, product: productId });

  // Add/increment in cart
  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = await Cart.create({
      user: userId,
      items: [{ product: productId, quantity: 1 }],
    });
  } else {
    const idx = cart.items.findIndex((i) => i.product.toString() === productId);
    if (idx > -1) {
      cart.items[idx].quantity += 1;
    } else {
      cart.items.push({ product: productId, quantity: 1 });
    }
    await cart.save();
  }

  await cart
    .populate(
      "items.product",
      "name slug price sale_price image in_stock quantity"
    )
    .execPopulate?.();

  return successResponse(res, { cart }, "Product moved to cart");
});

// Merge guest wishlist into user wishlist
exports.mergeWishlist = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { productIds } = req.body; // array of product IDs from guest storage

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return errorResponse(res, "No products to merge", 400);
  }

  // Validate all products exist
  const validProducts = await Product.find({ _id: { $in: productIds } }).select(
    "_id"
  );
  const validIds = validProducts.map((p) => p._id.toString());

  // Upsert all valid productIds into wishlist
  const bulkOps = validIds.map((pid) => ({
    updateOne: {
      filter: { user: userId, product: pid },
      update: { $setOnInsert: { user: userId, product: pid } },
      upsert: true,
    },
  }));

  if (bulkOps.length > 0) {
    await Wishlist.bulkWrite(bulkOps);
  }

  // Return updated wishlist
  const wishlist = await Wishlist.find({ user: userId }).populate("product");

  return successResponse(res, { wishlist }, "Wishlist merged successfully");
});
