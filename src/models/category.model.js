const mongoose = require("mongoose");
const { createSlug } = require("../utils/slug");

const childCategorySchema = new mongoose.Schema({
  name: { type: String, required: [true, "A child category must have a name"] },
  slug: { type: String, index: true },
});

childCategorySchema.pre("save", function (next) {
  this.slug = createSlug(this.name);
  next();
});

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "A category must have a name"],
      trim: true,
      unique: true,
    },
    slug: { type: String, unique: true, index: true },
    type: { type: String, enum: ["mega", "normal"], default: "normal" },
    children: [childCategorySchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

categorySchema.pre("save", async function (next) {
  this.slug = createSlug(this.name);
  next();
});

// Indexes for better performance
categorySchema.index({ slug: 1 });
categorySchema.index({ name: "text" });

const Category = mongoose.model("Category", categorySchema);
module.exports = Category;
