const mongoose = require("mongoose");
const { createSlug, generateUniqueSlug } = require("../utils/slug");

const tagSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, index: true },
  },
  { timestamps: true }
);

tagSchema.pre("save", async function (next) {
  if (this.isModified("name") || !this.slug) {
    const baseSlug = createSlug(this.name);
    this.slug = await generateUniqueSlug(this.constructor, baseSlug, this._id);
  }
  next();
});

module.exports = mongoose.model("Tag", tagSchema);
