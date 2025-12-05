const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    description: { type: String, trim: true },
    discountType: {
      type: String,
      enum: ["percentage", "fixed", "free_shipping"],
      required: true,
    },
    discountValue: { type: Number, default: 0 },
    minCartValue: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: null },
    usageLimit: { type: Number, default: null },
    usedCount: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 1 },
    userUsage: { type: Map, of: Number, default: {} },
    startDate: { type: Date, default: Date.now },
    expiryDate: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

couponSchema.virtual("isExpired").get(function () {
  return this.expiryDate && this.expiryDate < new Date();
});

module.exports = mongoose.model("Coupon", couponSchema);
