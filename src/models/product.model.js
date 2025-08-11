const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema(
  {
    id: Number,
    thumbnail: String,
    original: String,
  },
  { _id: false }
);

const tagSchema = new mongoose.Schema(
  {
    id: Number,
    name: String,
    slug: String,
  },
  { _id: false }
);

const attributeValueSchema = new mongoose.Schema(
  {
    id: Number,
    attribute_id: Number,
    value: String,
    image: String,
  },
  { _id: false }
);

const attributeSchema = new mongoose.Schema(
  {
    id: Number,
    slug: String,
    name: String,
    type: String,
    values: [attributeValueSchema],
  },
  { _id: false }
);

const variationSchema = new mongoose.Schema(
  {
    id: Number,
    attribute_id: Number,
    value: String,
    attribute: attributeSchema,
  },
  { _id: false }
);

const variationOptionSchema = new mongoose.Schema(
  {
    id: Number,
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
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    id: String, // e.g., pb01
    name: String,
    slug: String,
    description: String,
    videoUrl: String,
    image: imageSchema,
    gallery: [imageSchema],
    quantity: Number,
    price: Number,
    sale_price: Number,
    brand: String,
    operating: String,
    screen: String,
    model: String,
    tag: [tagSchema],
    product_type: String,
    max_price: Number,
    min_price: Number,
    variations: [variationSchema],
    variation_options: [variationOptionSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
