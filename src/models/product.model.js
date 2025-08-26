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
    slug: { type: String, unique: true, index: true }, // auto slug
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

/* ===============================
   MODELS
================================*/
const Product = mongoose.model("Product", productSchema);
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

/* ===============================
   EXPORT
================================*/
module.exports = {
  Product,
  VariationOption,
  Variation,
  Attribute,
  Tag,
  Image,
};
