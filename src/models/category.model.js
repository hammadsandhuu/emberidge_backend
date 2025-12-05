const mongoose = require("mongoose");
const { createSlug } = require("../utils/slug");

// Image sub-schema
const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  altText: { type: String, default: "" },
  width: { type: Number },
  height: { type: Number },
  type: {
    type: String,
    enum: ["thumbnail", "banner", "mobile", "gallery"],
    default: "thumbnail",
  },
});

// Main Category Schema
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

    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    ancestors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],

    description: { type: String },
    metaTitle: { type: String },
    metaDescription: { type: String },
    active: { type: Boolean, default: true },
    images: [imageSchema],
    popularityScore: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    timestamps: true,
  }
);

// PRE-SAVE MIDDLEWARE
categorySchema.pre("save", async function (next) {
  if (this.isModified("name")) {
    let slug = createSlug(this.name);
    let slugExists = await this.constructor.findOne({ slug });
    let count = 1;
    while (slugExists) {
      slug = `${createSlug(this.name)}-${count++}`;
      slugExists = await this.constructor.findOne({ slug });
    }
    this.slug = slug;
  }
  next();
});

// Auto-set ancestors if parent exists
categorySchema.pre("save", async function (next) {
  if (this.parent) {
    const parentCategory = await this.constructor.findById(this.parent);
    if (parentCategory) {
      this.ancestors = [...(parentCategory.ancestors || []), parentCategory._id];
    }
  }
  next();
});


// INDEXES
categorySchema.index({ slug: 1 });
categorySchema.index({ name: "text" });
categorySchema.index({ parent: 1 });
categorySchema.index({ ancestors: 1 });


// VIRTUAL RELATIONS
categorySchema.virtual("children", {
  ref: "Category",
  localField: "_id",
  foreignField: "parent",
});


// EXPORT
const Category = mongoose.model("Category", categorySchema);
module.exports = Category;
