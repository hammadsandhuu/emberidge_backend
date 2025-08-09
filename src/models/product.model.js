const mongoose = require("mongoose");
const slugify = require("slugify");

// Sub-schemas
const variationOptionSchema = new mongoose.Schema({
  title: String,
  price: Number,
  quantity: Number,
  sku: String,
  is_disable: Number,
  image: String,
  options: [
    {
      name: String,
      value: String,
    },
  ],
});

const variationSchema = new mongoose.Schema({
  attribute_id: Number,
  value: String,
  attribute: {
    id: Number,
    slug: String,
    name: String,
    type: String,
    values: [
      {
        id: Number,
        attribute_id: Number,
        value: String,
        image: String,
      },
    ],
  },
});

const tagSchema = new mongoose.Schema({
  id: Number,
  name: String,
  slug: String,
});

const imageSchema = new mongoose.Schema({
  id: Number,
  thumbnail: String,
  original: String,
});

// Main Product Schema
const productSchema = new mongoose.Schema(
  {
    id: String,
    name: {
      type: String,
      required: [true, "A product must have a name"],
      trim: true,
    },
    slug: String,
    description: String,
    image: imageSchema,
    gallery: [imageSchema],
    quantity: Number,
    price: {
      type: Number,
      required: [true, "A product must have a price"],
    },
    sale_price: Number,
    unit: String,
    tag: [tagSchema],
    product_type: String,
    max_price: Number,
    min_price: Number,
    variations: [variationSchema],
    variation_options: [variationOptionSchema],
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "A product must belong to a category"],
    },
    subCategory: {
      type: String,
      enum: ["stroller", "clothes", "towels", "baby-crib-bedding", "pacifiers"],
      required: [true, "A product must have a sub-category"],
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, "Rating must be above 1.0"],
      max: [5, "Rating must be below 5.0"],
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
productSchema.index({ slug: 1 });
productSchema.index({ category: 1 });
productSchema.index({ subCategory: 1 });
productSchema.index({ price: 1, ratingsAverage: -1 });

// Document middleware
productSchema.pre("save", function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

// Query middleware
productSchema.pre(/^find/, function (next) {
  this.populate({
    path: "category",
    select: "name slug image",
  });
  next();
});

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
