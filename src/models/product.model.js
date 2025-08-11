const mongoose = require("mongoose");
const slugify = require("slugify");

// ================== IMAGE ==================
const imageSchema = new mongoose.Schema(
  {
    thumbnail: { type: String, required: true },
    original: { type: String, required: true },
  },
  { _id: false }
);

// ================== TAG ==================
const tagSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      unique: true,
      index: true,
    },
  },
  { timestamps: true }
);

// ================== ATTRIBUTE ==================
const attributeValueSchema = new mongoose.Schema(
  {
    value: { type: String, required: true, trim: true },
    image: String,
  },
  { _id: false }
);

const attributeSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    values: [attributeValueSchema],
  },
  { timestamps: true }
);

// ================== VARIATION ==================
const variationSchema = new mongoose.Schema(
  {
    value: { type: String, required: true },
    attribute: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attribute",
      required: true,
    },
  },
  { timestamps: true }
);

// ================== VARIATION OPTION ==================
const optionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false }
);

const variationOptionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0 },
    sku: {
      type: String,
      required: true,
      unique: true,
      match: /^[A-Za-z0-9_-]+$/,
    },

    is_disable: { type: Boolean, default: false },
    image: String,
    options: [optionSchema],
  },
  { timestamps: true }
);

// ================== PRODUCT ==================
const productSchema = new mongoose.Schema(
  {
    // Category & SubCategory linking
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    description: String,
    videoUrl: {
      type: String,
      match: /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/,
    },
    image: imageSchema,
    gallery: [{ type: mongoose.Schema.Types.ObjectId, ref: "Image" }],
    quantity: { type: Number, min: 0 },
    price: { type: Number, min: 0 },
    sale_price: { type: Number, min: 0 },
    brand: String,
    operating: String,
    screen: String,
    model: String,
    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tag" }],
    product_type: {
      type: String,
      enum: ["simple", "variable"],
      default: "simple",
      index: true,
    },
    max_price: Number,
    min_price: Number,
    variations: [{ type: mongoose.Schema.Types.ObjectId, ref: "Variation" }],
    variation_options: [
      { type: mongoose.Schema.Types.ObjectId, ref: "VariationOption" },
    ],
    is_active: { type: Boolean, default: true, index: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// ================== SLUG HOOK ==================
productSchema.pre("save", async function (next) {
  if (this.isModified("name")) {
    let baseSlug = slugify(this.name, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;
    while (await mongoose.models.Product.exists({ slug })) {
      slug = `${baseSlug}-${counter++}`;
    }
    this.slug = slug;
  }
  next();
});

// ================== VIRTUAL ID ==================
productSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

productSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
  },
});

// ================== INDEXES ==================
productSchema.index({ price: 1 });
productSchema.index({ "tags.slug": 1 });

module.exports = {
  Product: mongoose.model("Product", productSchema),
  Tag: mongoose.model("Tag", tagSchema),
  Attribute: mongoose.model("Attribute", attributeSchema),
  Variation: mongoose.model("Variation", variationSchema),
  VariationOption: mongoose.model("VariationOption", variationOptionSchema),
};
