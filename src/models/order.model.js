const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: { type: String },
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
    shippingAddress: {
      fullName: String,
      address: String,
      city: String,
      postalCode: String,
      country: String,
      phoneNumber: String,
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "Stripe", "Paypal"],
      default: "COD",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    orderStatus: {
      type: String,
      enum: ["processing", "shipped", "delivered", "cancelled"],
      default: "processing",
    },
    subtotal: { type: Number, required: true, default: 0 },
    shippingFee: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true, default: 0 },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
