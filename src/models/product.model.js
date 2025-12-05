const mongoose = require("mongoose");
const { createSlug, generateUniqueSlug } = require("../utils/slug");

const productSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    description: { type: String, trim: true, maxlength: 5000 },
    product_details: { type: String, trim: true, maxlength: 10000 },
    brand: String,
    model: String,
    image: { type: mongoose.Schema.Types.ObjectId, ref: "Image" },
    gallery: [{ type: mongoose.Schema.Types.ObjectId, ref: "Image" }],
    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tag" }],
    product_type: {
      type: String,
      enum: ["simple", "variable"],
      default: "simple",
      required: true,
      index: true,
    },
    quantity: { type: Number, min: 0, default: 0 },
    price: { type: Number, min: 0 },
    sale_price: {
      type: Number,
      min: 0,
      validate: {
        validator: function (v) {
          return v == null || this.price == null || v <= this.price;
        },
        message: "Sale price must be <= regular price",
      },
    },
    on_sale: { type: Boolean, default: false },
    salesCount: { type: Number, default: 0, min: 0, index: true },
    sale_start: Date,
    sale_end: Date,
    min_price: Number,
    max_price: Number,
    variations: [{ type: mongoose.Schema.Types.ObjectId, ref: "Variation" }],
    variation_options: [
      { type: mongoose.Schema.Types.ObjectId, ref: "VariationOption" },
    ],
    shippingFee: { type: Number, min: 0, default: 0 },
    // models/product.model.js (snippet — add these fields inside schema)
    weight: { type: Number, min: 0, default: 0.5 }, // weight in KG, default 0.5kg
    shippingClass: {
      type: String,
      enum: ["standard", "fragile", "oversized"],
      default: "standard",
    },
    // keep existing shippingFee field as base handling/packaging fee
    shippingFee: { type: Number, min: 0, default: 0 },

    in_stock: { type: Boolean, default: true, index: true },
    is_active: { type: Boolean, default: true, index: true },
    additional_info: { type: Map, of: String, default: {} },
    deletedAt: { type: Date, default: null, index: true },
    ratingsAverage: {
      type: Number,
      default: 0,
      min: [0, "Rating must be at least 0"],
      max: [5, "Rating cannot be more than 5"],
      set: (val) => Math.round(val * 10) / 10,
    },
    ratingsQuantity: { type: Number, default: 0 },
    reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: "Review" }],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Indexes
productSchema.index({
  name: "text",
  description: "text",
  brand: "text",
  model: "text",
});
productSchema.index({ ratingsAverage: -1 });
productSchema.index({ ratingsQuantity: -1 });
productSchema.virtual("reviewsCount").get(function () {
  return Array.isArray(this.reviews) ? this.reviews.length : 0;
});
productSchema.virtual("ratingSummary").get(function () {
  return {
    average: this.ratingsAverage || 0,
    total: this.ratingsQuantity || 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  };
});

// Hooks
productSchema.pre("save", async function (next) {
  if (this.isModified("name") || !this.slug) {
    const baseSlug = createSlug(this.name);
    this.slug = await generateUniqueSlug(this.constructor, baseSlug, this._id);
  }
  if (this.product_type === "simple") {
    this.in_stock = this.quantity > 0;
  }
  next();
});

module.exports = mongoose.model("Product", productSchema);
