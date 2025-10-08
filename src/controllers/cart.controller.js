const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const catchAsync = require("../utils/catchAsync");
const successResponse = require("../utils/successResponse");
const errorResponse = require("../utils/errorResponse");
const calculateCartTotals = require("../utils/calculateCartTotals");

// Get user cart
exports.getCart = catchAsync(async (req, res, next) => {
  let cart = await Cart.findOne({ user: req.user._id }).populate(
    "items.product",
    "name slug price sale_price image in_stock quantity"
  );

  if (!cart) {
    return successResponse(
      res,
      { items: [], total: 0, finalTotal: 0 },
      "Cart is empty"
    );
  }

  cart = await calculateCartTotals(cart, req.user._id);
  await cart.save();

  const items = cart.items.map((i) => ({
    id: i.product._id,
    name: i.product.name,
    price: i.product.price,
    stock: i.product.quantity,
    quantity: i.quantity,
    in_stock: i.product.in_stock,
    slug: i.product.slug,
    image: i.product.image,
  }));

  return successResponse(
    res,
    {
      items,
      total: cart.total,
      finalTotal: cart.finalTotal,
    },
    "Cart fetched successfully"
  );
});

// Add to cart (or create cart)
exports.addToCart = catchAsync(async (req, res, next) => {
  const { productId, quantity = 1 } = req.body;
  if (!productId) return errorResponse(res, "productId is required", 400);
  const product = await Product.findById(productId);
  if (!product) return errorResponse(res, "Product not found", 404);
  if (!product.in_stock) return errorResponse(res, "Product out of stock", 400);
  if (product.quantity < quantity)
    return errorResponse(res, "Insufficient stock", 400);

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    cart = await Cart.create({
      user: req.user._id,
      items: [{ product: productId, quantity }],
    });
  } else {
    const idx = cart.items.findIndex((i) => i.product.toString() === productId);
    if (idx > -1) {
      cart.items[idx].quantity += quantity;
    } else {
      cart.items.push({ product: productId, quantity });
    }
    await cart.save();
  }

  await cart.populate(
    "items.product",
    "name slug price sale_price image in_stock quantity"
  );

  return successResponse(res, { cart }, "Product added to cart");
});

// Update quantity or remove when quantity=0
exports.updateCartItem = catchAsync(async (req, res, next) => {
  const { productId } = req.params;
  const { quantity } = req.body;

  if (quantity == null) return errorResponse(res, "quantity is required", 400);

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return errorResponse(res, "Cart not found", 404);

  const idx = cart.items.findIndex((i) => i.product.toString() === productId);
  if (idx === -1) return errorResponse(res, "Product not in cart", 404);

  if (quantity <= 0) {
    cart.items.splice(idx, 1);
  } else {
    const product = await Product.findById(productId);
    if (!product) return errorResponse(res, "Product not found", 404);
    if (!product.in_stock || product.quantity < quantity)
      return errorResponse(res, "Insufficient stock", 400);
    cart.items[idx].quantity = quantity;
  }

  await cart.save();
  return successResponse(res, { cart }, "Cart updated successfully");
});

// Remove a single product
exports.removeFromCart = catchAsync(async (req, res, next) => {
  const { productId } = req.params;
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return errorResponse(res, "Cart not found", 404);

  cart.items = cart.items.filter((i) => i.product.toString() !== productId);
  await cart.save();

  return successResponse(res, { cart }, "Item removed from cart");
});

// Clear cart
exports.clearCart = catchAsync(async (req, res, next) => {
  await Cart.findOneAndUpdate(
    { user: req.user._id },
    { items: [] },
    { new: true }
  );
  return successResponse(res, {}, "Cart cleared successfully");
});
