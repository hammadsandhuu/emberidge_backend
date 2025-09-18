const mongoose = require("mongoose");

const dealSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],

    discountType: {
      type: String,
      enum: ["percentage", "fixed", "flat"],
      required: true,
    },
    discountValue: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isGlobal: { type: Boolean, default: false },
    isActive: { type: Boolean, default: false },
    priority: { type: Number, default: 1 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

dealSchema.index({ startDate: 1, endDate: 1 });
dealSchema.index({ isActive: 1 });

module.exports = mongoose.model("Deal", dealSchema);
