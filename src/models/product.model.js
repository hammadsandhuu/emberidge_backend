const mongoose = require("mongoose");
const { createSlug, generateUniqueSlug } = require("../utils/slug");

/* ===============================
   SCHEMAS
================================*/
const imageSchema = new mongoose.Schema(
  { thumbnail: String, original: String, alt: String },
  { timestamps: true }
);

const tagSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, index: true },
  },
  { timestamps: true }
);

const attributeSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    slug: { type: String, unique: true, lowercase: true, index: true },
    type: {
      type: String,
      enum: ["text", "number", "color", "boolean", "select", "multiselect"],
      default: "text",
    },
    values: [{ value: String, image: String }],
    use_in_filter: { type: Boolean, default: true },
    is_required: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const variationSchema = new mongoose.Schema(
  {
    value: { type: String, trim: true },
    attribute: { type: mongoose.Schema.Types.ObjectId, ref: "Attribute" },
  },
  { timestamps: true }
);

const variationOptionSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    slug: { type: String, unique: true, index: true },
    price: { type: Number, min: 0 },
    quantity: { type: Number, min: 0, default: 0 },
    sku: {
      type: String,
      unique: true,
      sparse: true,
      match: /^[A-Za-z0-9_-]+$/,
    },
    is_disable: { type: Boolean, default: false },
    image: String,
    attributes: [
      {
        attribute: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Attribute",
          index: true,
        },
        value: { type: String, trim: true },
      },
    ],
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      index: true,
    },
  },
  { timestamps: true }
);

/* ===============================
   REVIEW SCHEMA
================================*/
const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "Rating must be an integer between 1 and 5",
      },
    },
    title: { type: String, trim: true, maxlength: 100 },
    comment: { type: String, trim: true, maxlength: 1000 },
    is_approved: { type: Boolean, default: false, index: true },
    helpful: { type: Number, default: 0, min: 0 },
    not_helpful: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Compound index to ensure one review per user per product
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Virtual for review status
reviewSchema.virtual("status").get(function () {
  return this.is_approved ? "approved" : "pending";
});

// Method to mark review as helpful
reviewSchema.methods.markHelpful = function () {
  this.helpful += 1;
  return this.save();
};

// Method to mark review as not helpful
reviewSchema.methods.markNotHelpful = function () {
  this.not_helpful += 1;
  return this.save();
};

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
    description: String,
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
    min_price: Number,
    max_price: Number,
    variations: [{ type: mongoose.Schema.Types.ObjectId, ref: "Variation" }],
    variation_options: [
      { type: mongoose.Schema.Types.ObjectId, ref: "VariationOption" },
    ],
    in_stock: { type: Boolean, default: true, index: true },
    is_active: { type: Boolean, default: true, index: true },
    deletedAt: { type: Date, default: null, index: true },

    // Rating and Review fields
    ratingsAverage: {
      type: Number,
      default: 0,
      min: [0, "Rating must be at least 0"],
      max: [5, "Rating cannot be more than 5"],
      set: (val) => Math.round(val * 10) / 10,
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    reviews: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review",
      },
    ],
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

// Virtual for reviews count
productSchema.virtual("reviewsCount").get(function () {
  return this.reviews.length;
});

// Virtual for rating distribution (simplified version)
productSchema.virtual("ratingSummary").get(function () {
  return {
    average: this.ratingsAverage,
    total: this.ratingsQuantity,
    distribution: {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    },
  };
});

// Index for better performance on rating queries
productSchema.index({ ratingsAverage: -1 });
productSchema.index({ ratingsQuantity: -1 });

/* ===============================
   MODELS
================================*/
const Product = mongoose.model("Product", productSchema);
const Review = mongoose.model("Review", reviewSchema);
const VariationOption = mongoose.model(
  "VariationOption",
  variationOptionSchema
);
const Variation = mongoose.model("Variation", variationSchema);
const Attribute = mongoose.model("Attribute", attributeSchema);
const Tag = mongoose.model("Tag", tagSchema);
const Image = mongoose.model("Image", imageSchema);

/* ===============================
   HELPERS
================================*/
async function updateVariableProductStats(productId) {
  const variationOptions = await VariationOption.find({ product: productId });
  if (!variationOptions.length) {
    await Product.findByIdAndUpdate(productId, {
      min_price: null,
      max_price: null,
      in_stock: false,
      is_active: false,
    });
    return;
  }

  const prices = variationOptions
    .map((opt) => opt.price)
    .filter((p) => typeof p === "number");
  const stockAvailable = variationOptions.some((opt) => opt.quantity > 0);

  await Product.findByIdAndUpdate(productId, {
    min_price: prices.length ? Math.min(...prices) : null,
    max_price: prices.length ? Math.max(...prices) : null,
    in_stock: stockAvailable,
    is_active: stockAvailable,
  });
}

// Helper to update product ratings
async function updateProductRatings(productId) {
  const reviews = await Review.find({ product: productId, is_approved: true });

  if (reviews.length === 0) {
    await Product.findByIdAndUpdate(productId, {
      ratingsAverage: 0,
      ratingsQuantity: 0,
    });
    return;
  }

  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = totalRating / reviews.length;

  await Product.findByIdAndUpdate(productId, {
    ratingsAverage: averageRating,
    ratingsQuantity: reviews.length,
  });
}

/* ===============================
   HOOKS
================================*/
productSchema.pre("save", async function (next) {
  if (this.isModified("name") || !this.slug) {
    const baseSlug = createSlug(this.name);
    this.slug = await generateUniqueSlug(this.constructor, baseSlug, this._id);
  }

  if (this.product_type === "simple") this.in_stock = this.quantity > 0;
  else if (this.product_type === "variable")
    await updateVariableProductStats(this._id);

  next();
});

variationOptionSchema.post("save", async function () {
  if (this.product) await updateVariableProductStats(this.product);
});

variationOptionSchema.post("findOneAndDelete", async function (doc) {
  if (doc?.product) await updateVariableProductStats(doc.product);
});

// Update product ratings when a review is deleted
reviewSchema.post("findOneAndDelete", async function (doc) {
  if (doc?.product) {
    await Product.findByIdAndUpdate(doc.product, {
      $pull: { reviews: doc._id },
    });
    await updateProductRatings(doc.product);
  }
});

/* ===============================
   EXPORT
================================*/
module.exports = {
  Product,
  Review,
  VariationOption,
  Variation,
  Attribute,
  Tag,
  Image,
  updateProductRatings,
};
