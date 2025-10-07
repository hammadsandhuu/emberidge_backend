// make sure stripe is initialized
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const mongoose = require("mongoose");
const Order = require("../models/order.model");
const User = require("../models/user.model");
const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const catchAsync = require("../utils/catchAsync");
const successResponse = require("../utils/successResponse");
const errorResponse = require("../utils/errorResponse");
const { redeemCoupon } = require("./coupon.controller");
const APIFeatures = require("../utils/apiFeatures");
const orderConfirmationEmail = require("../templates/emails/orderConfirmationEmail");
const sendEmail = require("../utils/email");

// Get all orders (paginated)
exports.getAllOrders = catchAsync(async (req, res, next) => {
  const total = await Order.countDocuments();

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
    "All orders fetched successfully"
  );
});

// Create Order
exports.createOrder = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { addressId, paymentMethod = "COD", metadata = {} } = req.body;

  const user = await User.findById(userId).populate("addresses");
  if (!user) return errorResponse(res, "User not found", 404);

  const shippingAddress = user.addresses.id(addressId);
  if (!shippingAddress) return errorResponse(res, "Address not found", 400);

  const shippingSnapshot = {
    fullName: shippingAddress.fullName,
    phoneNumber: shippingAddress.phoneNumber,
    country: shippingAddress.country,
    state: shippingAddress.state,
    city: shippingAddress.city,
    area: shippingAddress.area,
    streetAddress: shippingAddress.streetAddress,
    apartment: shippingAddress.apartment,
    postalCode: shippingAddress.postalCode,
    label: shippingAddress.label,
  };

  const cart = await Cart.findOne({ user: userId }).populate("items.product");
  if (!cart || cart.items.length === 0)
    return errorResponse(res, "Cart is empty", 400);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const orderItems = [];
    let subtotal = 0;
    let shippingFee = 0;

    for (const item of cart.items) {
      const p = await Product.findById(item.product._id).session(session);
      if (!p) throw new Error(`Product ${item.product._id} not found`);
      if (!p.in_stock || p.quantity < item.quantity)
        throw new Error(`Insufficient stock for product ${p.name}`);

      const price = p.sale_price && p.on_sale ? p.sale_price : p.price;
      const productShippingFee = p.shippingFee || 0;

      orderItems.push({
        product: p._id,
        name: p.name,
        price,
        quantity: item.quantity,
        image: p.image || null,
        shippingFee: productShippingFee,
      });

      subtotal += price * item.quantity;
      shippingFee += productShippingFee * item.quantity;

      if (p.product_type === "simple") {
        p.quantity -= item.quantity;
        if (p.quantity <= 0) p.in_stock = false;
        await p.save({ session });
      }
    }

    const discount = cart.discount || 0;
    const coupon = cart.coupon || null;
    const totalAmount = subtotal - discount + shippingFee;

    const orderData = {
      user: userId,
      items: orderItems,
      shippingAddress: shippingSnapshot,
      paymentMethod,
      subtotal,
      shippingFee,
      discount,
      coupon,
      totalAmount,
      metadata,
    };

    if (paymentMethod === "stripe") {
      orderData.paymentStatus = "pending";
      orderData.orderStatus = "processing";
    } else if (paymentMethod === "COD") {
      orderData.paymentStatus = "unpaid";
      orderData.orderStatus = "pending";
    }

    let clientSecret = null;

    if (paymentMethod === "stripe") {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmount * 100),
        currency: "sar",
        payment_method_types: ["card"],
        shipping: {
          name: shippingSnapshot.fullName,
          phone: shippingSnapshot.phoneNumber,
          address: {
            line1: shippingSnapshot.streetAddress,
            line2: shippingSnapshot.apartment || "",
            city: shippingSnapshot.city,
            state: shippingSnapshot.state || "",
            country: shippingSnapshot.country,
            postal_code: shippingSnapshot.postalCode,
          },
        },
        metadata: {
          userId: userId.toString(),
          orderType: "product-order",
          ...metadata,
        },
      });

      orderData.paymentIntentId = paymentIntent.id;
      clientSecret = paymentIntent.client_secret;
    }

    const [order] = await Order.create([orderData], { session });

    if (coupon) await redeemCoupon(coupon, userId);

    cart.items = [];
    cart.coupon = null;
    cart.discount = 0;
    cart.total = 0;
    cart.finalTotal = 0;
    await cart.save({ session });

    await session.commitTransaction();
    session.endSession();

    try {
      await sendEmail({
        email: user.email,
        subject: `Order Confirmation - ${order.orderNumber || order._id}`,
        html: orderConfirmationEmail({
          fullName: shippingSnapshot.fullName,
          orderNumber: order.orderNumber || order._id,
          trackingNumber: order.trackingNumber || "Not Assigned Yet",
          totalAmount: order.totalAmount.toFixed(2),
          paymentMethod: order.paymentMethod,
          orderStatus: order.orderStatus,
          streetAddress: shippingSnapshot.streetAddress,
          city: shippingSnapshot.city,
          country: shippingSnapshot.country,
        }),
      });
    } catch (emailErr) {
      console.error("Order confirmation email failed:", emailErr);
    }

    return successResponse(
      res,
      {
        order,
        clientSecret: paymentMethod === "stripe" ? clientSecret : null,
      },
      paymentMethod === "COD"
        ? "COD order created successfully"
        : "Stripe order created successfully",
      201
    );
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("createOrder error:", err);
    return errorResponse(res, err.message || "Order creation failed", 400);
  }
});

//  Get user's all orders (paginated)
exports.getOrders = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

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
    "Orders fetched successfully"
  );
});

//  Get single order (ensure owner or admin)
exports.getOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate(
    "items.product",
    "name slug image"
  );

  if (!order) return errorResponse(res, "Order not found", 404);

  // Authorization check
  if (
    order.user.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    return errorResponse(res, "Not authorized to view this order", 403);
  }

  return successResponse(res, { order }, "Order fetched successfully");
});

//  Admin: update order status
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
  ).populate("user", "name email");

  if (!order) return errorResponse(res, "Order not found", 404);

  return successResponse(res, { order }, "Order status updated successfully");
});

//  Cancel order (user or admin)
exports.cancelOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate("items.product");

  if (!order) return errorResponse(res, "Order not found", 404);

  // Authorization
  if (
    order.user.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    return errorResponse(res, "Not authorized to cancel this order", 403);
  }

  // Cannot cancel delivered
  if (order.orderStatus === "delivered")
    return errorResponse(res, "Cannot cancel a delivered order", 400);

  order.orderStatus = "cancelled";
  await order.save();

  // ✅ Optional: Restore stock after cancellation
  for (const item of order.items) {
    const product = await Product.findById(item.product._id);
    if (product && product.product_type === "simple") {
      product.quantity += item.quantity;
      product.in_stock = true;
      await product.save();
    }
  }

  return successResponse(res, { order }, "Order cancelled successfully");
});

// Admin: delete order
exports.deleteOrder = catchAsync(async (req, res, next) => {
  if (req.user.role !== "admin") return errorResponse(res, "Admin only", 403);

  const order = await Order.findByIdAndDelete(req.params.orderId);
  if (!order) return errorResponse(res, "Order not found", 404);

  return successResponse(res, null, "Order deleted successfully");
});

// Track order by tracking number (public)
exports.trackOrder = catchAsync(async (req, res, next) => {
  const { trackingNumber } = req.params;

  const order = await Order.findOne({ trackingNumber })
    .populate("user", "name email")
    .populate("items.product", "name slug image");

  if (!order) return errorResponse(res, "Invalid tracking number", 404);

  const trackingInfo = {
    trackingNumber: order.trackingNumber,
    orderNumber: order.orderNumber,
    status: order.orderStatus,
    paymentStatus: order.paymentStatus,
    totalAmount: order.totalAmount,
    shippingAddress: order.shippingAddress,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };

  return successResponse(res, { trackingInfo }, "Order tracking info fetched");
});

exports.markOrderStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { paymentStatus, orderStatus } = req.body;

  const order = await Order.findById(id);
  if (!order) return errorResponse(res, "Order not found", 404);

  if (paymentStatus) order.paymentStatus = paymentStatus;
  if (orderStatus) order.orderStatus = orderStatus;
  await order.save();

  return successResponse(res, order, "Order updated successfully");
});