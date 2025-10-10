const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    quantity: { type: Number, required: true, min: 1, default: 1 },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: [cartItemSchema],

    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },
    discount: { type: Number, default: 0 },
    shippingFee: { type: Number, default: 0 },
    shippingMethod: {
      type: String,
      enum: ["standard", "express"],
      default: "standard",
    },
    codFee: { type: Number, default: 0 },
    paymentMethod: {
      type: String,
      enum: ["stripe", "cod"],
      default: "stripe",
    },

    total: { type: Number, default: 0 },
    finalTotal: { type: Number, default: 0 },
  },
  { timestamps: true }
);

cartSchema.index({ user: 1 });

module.exports = mongoose.model("Cart", cartSchema);
