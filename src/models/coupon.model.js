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
      enum: ["percentage", "fixed"],
      required: true,
    },
    discountValue: { type: Number, required: true, min: 0 },

    minCartValue: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: null }, // only for percentage type
    usageLimit: { type: Number, default: null }, // global limit
    usedCount: { type: Number, default: 0 },

    perUserLimit: { type: Number, default: 1 },
    userUsage: { type: Map, of: Number, default: {} }, // { userId: count }

    startDate: { type: Date, default: Date.now },
    expiryDate: { type: Date, default: null },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Virtual: isExpired
couponSchema.virtual("isExpired").get(function () {
  if (!this.expiryDate) return false;
  return this.expiryDate < new Date();
});

module.exports = mongoose.model("Coupon", couponSchema);
