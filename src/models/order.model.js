const mongoose = require("mongoose");
const addressSchema = require("./address.model");

const ORDER_PREFIX = process.env.ORDER_PREFIX || "ORD";
const TRACKING_PREFIX = process.env.TRACKING_PREFIX || "EMB";

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: String,
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    image: { type: mongoose.Schema.Types.ObjectId, ref: "Image" },
    shippingFee: { type: Number, default: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: [orderItemSchema],
    shippingAddress: addressSchema,
    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },
    trackingNumber: {
      type: String,
      unique: true,
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ["cod", "stripe", "applepay"],
      default: "stripe",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "unpaid"],
      default: "pending",
    },
    paymentIntentId: { type: String, default: null },
    orderStatus: {
      type: String,
      enum: ["processing", "pending", "shipped", "delivered", "cancelled"],
      default: "processing",
    },
    subtotal: { type: Number, required: true, default: 0 },
    shippingFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },
    totalAmount: { type: Number, required: true, default: 0 },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

/* 
-----------------------------------------
  🔹 AUTO GENERATE orderNumber & trackingNumber
-----------------------------------------
*/
orderSchema.pre("validate", async function (next) {
  // Generate tracking number if not exists
  if (!this.trackingNumber) {
    const uniqueId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const timestamp = Date.now().toString().slice(-5);
    this.trackingNumber = `${TRACKING_PREFIX}-${timestamp}-${uniqueId}`;
  }

  // Generate sequential order number if not exists
  if (!this.orderNumber) {
    const year = new Date().getFullYear();
    const lastOrder = await mongoose
      .model("Order")
      .findOne()
      .sort({ createdAt: -1 });

    let nextSeq = 1;
    if (lastOrder && lastOrder.orderNumber) {
      const regex = new RegExp(`^${ORDER_PREFIX}-${year}-(\\d+)$`);
      const match = lastOrder.orderNumber.match(regex);
      if (match) nextSeq = parseInt(match[1], 10) + 1;
    }

    this.orderNumber = `${ORDER_PREFIX}-${year}-${String(nextSeq).padStart(
      6,
      "0"
    )}`;
  }

  next();
});

module.exports = mongoose.model("Order", orderSchema);
