// models/order.model.js
const mongoose = require("mongoose");
const addressSchema = require("./address.model");

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
    paymentMethod: {
      type: String,
      enum: ["COD", "stripe", "applepay"],
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
      enum: ["processing", "shipped", "delivered", "cancelled"],
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

module.exports = mongoose.model("Order", orderSchema);
