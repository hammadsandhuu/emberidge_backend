const mongoose = require("mongoose");
const Order = require("../models/order.model");
const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const catchAsync = require("../utils/catchAsync");
const successResponse = require("../utils/successResponse");
const errorResponse = require("../utils/errorResponse");
const { redeemCoupon } = require("./coupon.controller");

// Create order from user's cart
exports.createOrder = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { shippingAddress, paymentMethod = "COD", metadata = {} } = req.body;

  const cart = await Cart.findOne({ user: userId }).populate("items.product");
  if (!cart || cart.items.length === 0)
    return errorResponse(res, "Cart is empty", 400);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const orderItems = [];
    let subtotal = 0;

    // validate stock & snapshot products
    for (const item of cart.items) {
      const p = await Product.findById(item.product._id).session(session);
      if (!p) throw new Error(`Product ${item.product._id} not found`);
      if (!p.in_stock || p.quantity < item.quantity) {
        throw new Error(`Insufficient stock for product ${p.name}`);
      }

      const price = p.sale_price && p.on_sale ? p.sale_price : p.price;
      orderItems.push({
        product: p._id,
        name: p.name,
        price,
        quantity: item.quantity,
        image: p.image || null,
      });

      subtotal += price * item.quantity;

      if (p.product_type === "simple") {
        p.quantity -= item.quantity;
        if (p.quantity <= 0) p.in_stock = false;
        await p.save({ session });
      }
    }

    const shippingFee = subtotal > 100 ? 0 : 10;

    // ✅ Apply coupon if present in cart
    const discount = cart.discount || 0;
    const coupon = cart.coupon || null;
    const totalAmount = subtotal - discount + shippingFee;

    const order = await Order.create(
      [
        {
          user: userId,
          items: orderItems,
          shippingAddress,
          paymentMethod,
          paymentStatus: "pending",
          orderStatus: "processing",
          subtotal,
          shippingFee,
          discount,
          coupon,
          totalAmount,
          metadata,
        },
      ],
      { session }
    );

    // ✅ Redeem coupon usage
    if (coupon) {
      await redeemCoupon(coupon, userId);
    }

    // clear cart
    cart.items = [];
    cart.coupon = null;
    cart.discount = 0;
    cart.total = 0;
    cart.finalTotal = 0;
    await cart.save({ session });

    await session.commitTransaction();
    session.endSession();

    return successResponse(
      res,
      { order: order[0] },
      "Order created successfully",
      201
    );
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    return errorResponse(res, err.message || "Order creation failed", 400);
  }
});

// Get user's orders (paginated)
exports.getOrders = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const APIFeatures = require("../utils/apiFeatures");

  const total = await Order.countDocuments({ user: userId });
  const features = new APIFeatures(
    Order.find({ user: userId }).populate("items.product", "name slug image"),
    req.query
  );
  features.sort().limitFields().paginate(total);
  const orders = await features.query;
  return successResponse(
    res,
    { orders, pagination: features.pagination },
    "Orders fetched"
  );
});

// Get single order (ensure owner or admin)
exports.getOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate(
    "items.product",
    "name slug image"
  );
  if (!order) return errorResponse(res, "Order not found", 404);
  // If you have admin check, enforce here. For now ensure owner:
  if (
    order.user.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    return errorResponse(res, "Not authorized to view this order", 403);
  }
  return successResponse(res, { order }, "Order fetched");
});

// Admin: update order status
exports.updateOrderStatus = catchAsync(async (req, res, next) => {
  if (req.user.role !== "admin") return errorResponse(res, "Admin only", 403);
  const { status } = req.body;
  const allowed = ["processing", "shipped", "delivered", "cancelled"];
  if (!allowed.includes(status))
    return errorResponse(res, "Invalid status", 400);
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { orderStatus: status },
    { new: true }
  );
  if (!order) return errorResponse(res, "Order not found", 404);
  return successResponse(res, { order }, "Order status updated");
});

// Cancel order (user or admin)
exports.cancelOrder = catchAsync(async (req, res, next) => {
  console.log(req.params.id,"here is my id");
  const order = await Order.findById(req.params.id);

  if (!order) return errorResponse(res, "Order not found", 404);
  if (
    order.user.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    return errorResponse(res, "Not authorized", 403);
  }
  // Only allow cancel if not delivered
  if (order.orderStatus === "delivered")
    return errorResponse(res, "Cannot cancel delivered order", 400);
  order.orderStatus = "cancelled";
  await order.save();
  // Optionally restore stock (implement per business rules)
  return successResponse(res, { order }, "Order cancelled");
});


// Admin: delete order
exports.deleteOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findByIdAndDelete(req.params.orderId);
  if (!order) return errorResponse(res, "Order not found", 404);
  return successResponse(res, null, "Order deleted successfully");
});

exports.getAllOrders = catchAsync(async (req, res, next) => {
  const total = await Order.countDocuments();
  const APIFeatures = require("../utils/apiFeatures");

  const features = new APIFeatures(
    Order.find()
      .populate("user", "name email")
      .populate("items.product", "name slug image"),
    req.query
  );
  features.sort().limitFields().paginate(total);
  const orders = await features.query;

  return successResponse(
    res,
    { orders, pagination: features.pagination },
    "All orders fetched"
  );
});