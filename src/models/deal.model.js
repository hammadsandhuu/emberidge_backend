const mongoose = require("mongoose");

const dealSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    // Products & Categories targeted by deal
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],

    // Discount
    discountType: {
      type: String,
      enum: ["percentage", "fixed", "flat"],
      required: true,
    },
    discountValue: { type: Number, required: true },

    // Time window
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    // Behavior
    isGlobal: { type: Boolean, default: false }, // true = applies site-wide
    isActive: { type: Boolean, default: false },
    priority: { type: Number, default: 1 }, // higher = overrides lower

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

dealSchema.index({ startDate: 1, endDate: 1 });
dealSchema.index({ isActive: 1 });

module.exports = mongoose.model("Deal", dealSchema);
