const mongoose = require("mongoose");

const dealSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    image: {
      desktop: {
        url: { type: String, trim: true },
        public_id: { type: String, trim: true },
      },
      mobile: {
        url: { type: String, trim: true },
        public_id: { type: String, trim: true },
      },
    },
    btnText: { type: String, trim: true },

    // Related data
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    subCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],

    // Discount details
    discountType: {
      type: String,
      enum: ["percentage", "fixed", "flat"],
      required: true,
    },
    discountValue: { type: Number, required: true, min: 0 },

    // Time window
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    // Flags
    isGlobal: { type: Boolean, default: false },
    isActive: { type: Boolean, default: false },
    priority: { type: Number, default: 1 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Indexes
dealSchema.index({ startDate: 1, endDate: 1 });
dealSchema.index({ isActive: 1 });
dealSchema.index({ priority: -1 });

module.exports = mongoose.model("Deal", dealSchema);
