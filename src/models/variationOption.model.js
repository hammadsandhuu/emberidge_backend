const mongoose = require("mongoose");
const Product = require("./product.model");

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

variationOptionSchema.post("save", async function () {
  if (this.product) {
    const options = await this.constructor.find({ product: this.product });
    const prices = options
      .map((o) => o.price)
      .filter((p) => typeof p === "number");
    const stock = options.some((o) => o.quantity > 0);

    await Product.findByIdAndUpdate(this.product, {
      min_price: prices.length ? Math.min(...prices) : null,
      max_price: prices.length ? Math.max(...prices) : null,
      in_stock: stock,
      is_active: stock,
    });
  }
});

module.exports = mongoose.model("VariationOption", variationOptionSchema);
