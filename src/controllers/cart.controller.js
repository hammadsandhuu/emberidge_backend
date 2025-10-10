const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const Coupon = require("../models/coupon.model");
const catchAsync = require("../utils/catchAsync");
const successResponse = require("../utils/successResponse");
const errorResponse = require("../utils/errorResponse");
const calculateCartTotals = require("../utils/calculateCartTotals");

const updateCartTotals = async (cart, userId) => {
  await calculateCartTotals(cart, userId);
  await cart.save();
  return cart;
};

// Get Cart
exports.getCart = catchAsync(async (req, res) => {
  let cart = await Cart.findOne({ user: req.user._id })
    .populate(
      "items.product",
      "name slug price sale_price image in_stock quantity shippingFee"
    )
    .populate("coupon", "code discountType discountValue expiryDate");

  if (!cart)
    return successResponse(
      res,
      { items: [], total: 0, discount: 0, shippingFee: 0, finalTotal: 0 },
      "Cart is empty"
    );

  cart = await updateCartTotals(cart, req.user._id);

  const items = cart.items.map((i) => ({
    id: i.product._id,
    name: i.product.name,
    price: i.product.sale_price ?? i.product.price,
    quantity: i.quantity,
    shippingFee: i.product.shippingFee,
    image: i.product.image,
    slug: i.product.slug,
  }));

  return successResponse(
    res,
    {
      items,
      total: cart.total,
      discount: cart.discount,
      shippingFee: cart.shippingFee,
      finalTotal: cart.finalTotal,
      codFee: cart.codFee,
      coupon: cart.coupon,
      shippingMethod: cart.shippingMethod,
    },
    "Cart fetched successfully"
  );
});

// Add to cart
exports.addToCart = catchAsync(async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  if (!productId) return errorResponse(res, "Product ID is required", 400);

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
    const existingItem = cart.items.find(
      (i) => i.product.toString() === productId
    );
    existingItem
      ? (existingItem.quantity += quantity)
      : cart.items.push({ product: productId, quantity });
    await cart.save();
  }

  await updateCartTotals(cart, req.user._id);
  return successResponse(res, {}, "Product added to cart");
});

//  Update item quantity
exports.updateCartItem = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body;

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return errorResponse(res, "Cart not found", 404);

  const item = cart.items.find((i) => i.product.toString() === productId);
  if (!item) return errorResponse(res, "Product not in cart", 404);

  if (quantity <= 0) {
    cart.items = cart.items.filter((i) => i.product.toString() !== productId);
  } else {
    const product = await Product.findById(productId);
    if (!product || !product.in_stock || product.quantity < quantity)
      return errorResponse(res, "Insufficient stock", 400);
    item.quantity = quantity;
  }

  await updateCartTotals(cart, req.user._id);
  return successResponse(res, { cart }, "Cart updated successfully");
});

//  Remove item
exports.removeFromCart = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return errorResponse(res, "Cart not found", 404);

  cart.items = cart.items.filter((i) => i.product.toString() !== productId);
  await updateCartTotals(cart, req.user._id);

  return successResponse(res, { cart }, "Item removed from cart");
});

//  Clear cart
exports.clearCart = catchAsync(async (req, res) => {
  await Cart.findOneAndUpdate(
    { user: req.user._id },
    { items: [], coupon: null, discount: 0 }
  );
  return successResponse(res, {}, "Cart cleared successfully");
});

//  Apply coupon
exports.applyCoupon = catchAsync(async (req, res) => {
  const { code } = req.body;
  const coupon = await Coupon.findOne({
    code: code.toUpperCase(),
    isActive: true,
  });
  if (!coupon) return errorResponse(res, "Invalid coupon", 400);
  if (coupon.isExpired) return errorResponse(res, "Coupon expired", 400);

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return errorResponse(res, "Cart not found", 404);

  cart.coupon = coupon._id;
  await updateCartTotals(cart, req.user._id);
  return successResponse(res, { cart }, "Coupon applied successfully");
});

//  Remove coupon
exports.removeCoupon = catchAsync(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return errorResponse(res, "Cart not found", 404);

  cart.coupon = null;
  cart.discount = 0;
  await updateCartTotals(cart, req.user._id);
  return successResponse(res, { cart }, "Coupon removed successfully");
});

//  Set shipping method
exports.setShippingMethod = catchAsync(async (req, res) => {
  const { method } = req.body;
  if (!["standard", "express"].includes(method))
    return errorResponse(res, "Invalid shipping method", 400);

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return errorResponse(res, "Cart not found", 404);

  cart.shippingMethod = method;
  await updateCartTotals(cart, req.user._id);

  return successResponse(res, { cart }, `Shipping method updated to ${method}`);
});

// Set payment method (Card / COD)
exports.setPaymentMethod = catchAsync(async (req, res) => {
  const { method } = req.body;
  if (!["stripe", "cod"].includes(method))
    return errorResponse(res, "Invalid payment method", 400);

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return errorResponse(res, "Cart not found", 404);

  cart.paymentMethod = method;
  await calculateCartTotals(cart, req.user._id);
  await cart.save();

  return successResponse(
    res,
    {
      total: cart.total,
      discount: cart.discount,
      shippingFee: cart.shippingFee,
      codFee: cart.codFee,
      finalTotal: cart.finalTotal,
      paymentMethod: cart.paymentMethod,
    },
    `Payment method set to ${method}`
  );
});
