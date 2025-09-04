const mongoose = require("mongoose");
const Product = require("./product.model");

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
    helpfulUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    notHelpfulUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

reviewSchema.index({ product: 1, user: 1 }, { unique: true });

reviewSchema.post("findOneAndDelete", async function (doc) {
  if (doc?.product) {
    await Product.findByIdAndUpdate(doc.product, {
      $pull: { reviews: doc._id },
    });
  }
});

module.exports = mongoose.model("Review", reviewSchema);
