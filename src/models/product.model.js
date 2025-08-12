const mongoose = require("mongoose");
const slugify = require("slugify");

// ================== IMAGE ==================
const imageSchema = new mongoose.Schema(
  {
    thumbnail: { type: String },
    original: { type: String },
  },
  { timestamps: true }
);

// ================== TAG ==================
const tagSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    slug: {
      type: String,
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
    value: { type: String, trim: true },
    image: String,
  },
  { _id: false }
);

const attributeSchema = new mongoose.Schema(
  {
    slug: { type: String, trim: true, lowercase: true },
    name: { type: String, trim: true },
    type: { type: String, trim: true },
    values: [attributeValueSchema],
  },
  { timestamps: true }
);

// ================== VARIATION ==================
const variationSchema = new mongoose.Schema(
  {
    value: { type: String },
    attribute: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attribute",
    },
  },
  { timestamps: true }
);

// ================== VARIATION OPTION ==================
const optionSchema = new mongoose.Schema(
  {
    name: { type: String },
    value: { type: String },
  },
  { timestamps: true }
);

const variationOptionSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    price: { type: Number, min: 0 },
    quantity: { type: Number, min: 0 },
    sku: {
      type: String,
      unique: true,
      match: /^[A-Za-z0-9_-]+$/,
    },
    is_disable: { type: Boolean, default: false },
    image: String,
    options: [optionSchema],
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      index: true,
    },
  },
  { timestamps: true }
);

// ================== PRODUCT ==================
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
      ref: "SubCategory",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },

    slug: { type: String, unique: true, index: true },

    description: String,

    videoUrl: {
      type: String,
      validate: {
        validator: function (v) {
          return (
            !v ||
            /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/.test(v)
          );
        },
        message: (props) => `${props.value} is not a valid YouTube URL!`,
      },
    },

    image: { type: mongoose.Schema.Types.ObjectId, ref: "Image" },

    gallery: [{ type: mongoose.Schema.Types.ObjectId, ref: "Image" }],

    quantity: {
      type: Number,
      min: 0,
      validate: {
        validator: function (v) {
          return this.product_type === "simple" || v === undefined;
        },
        message: "Quantity should only be defined for simple products",
      },
    },

    price: {
      type: Number,
      min: 0,
      validate: {
        validator: function (v) {
          return this.product_type === "simple" || v === undefined;
        },
        message: "Price should only be defined for simple products",
      },
    },

    sale_price: {
      type: Number,
      min: 0,
      validate: [
        {
          validator: function (v) {
            return (
              v === undefined || this.price === undefined || v <= this.price
            );
          },
          message: "Sale price must be less than or equal to regular price",
        },
        {
          validator: function (v) {
            return this.product_type === "simple" || v === undefined;
          },
          message: "Sale price should only be defined for simple products",
        },
      ],
    },

    brand: String,
    operating: String,
    screen: String,
    model: String,

    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tag" }],

    product_type: {
      type: String,
      enum: ["simple", "variable"],
      default: "simple",
      required: true,
      index: true,
    },

    max_price: {
      type: Number,
      validate: {
        validator: function (v) {
          return this.product_type === "variable" || v === undefined;
        },
        message: "Max price should only be defined for variable products",
      },
    },

    min_price: {
      type: Number,
      validate: {
        validator: function (v) {
          return this.product_type === "variable" || v === undefined;
        },
        message: "Min price should only be defined for variable products",
      },
    },

    variations: [{ type: mongoose.Schema.Types.ObjectId, ref: "Variation" }],

    variation_options: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "VariationOption",
      },
    ],

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

// ================== Virtuals ==================
productSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

productSchema.virtual("on_sale").get(function () {
  return this.sale_price && this.sale_price < this.price;
});

productSchema.virtual("in_stock").get(function () {
  if (this.product_type === "variable") {
    return (
      this.variation_options &&
      this.variation_options.some((opt) => opt.quantity > 0)
    );
  }
  return this.quantity > 0;
});

// ================== Indexes ==================
productSchema.index({ price: 1, sale_price: 1 });
productSchema.index({
  name: "text",
  description: "text",
  brand: "text",
  model: "text",
});

// ================== Hooks ==================
productSchema.pre("save", async function (next) {
  if (this.isModified("name")) {
    let baseSlug = slugify(this.name, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;
    while (
      await mongoose.models.Product.exists({ slug, _id: { $ne: this._id } })
    ) {
      slug = `${baseSlug}-${counter++}`;
    }
    this.slug = slug;
  }

  // Optional: price range update for variable products should be handled outside or via service
  next();
});

// ================== Export Models ==================
module.exports = {
  Product: mongoose.model("Product", productSchema),
  Tag: mongoose.model("Tag", tagSchema),
  Attribute: mongoose.model("Attribute", attributeSchema),
  Variation: mongoose.model("Variation", variationSchema),
  VariationOption: mongoose.model("VariationOption", variationOptionSchema),
  Image: mongoose.model("Image", imageSchema),
};
