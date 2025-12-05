const mongoose = require("mongoose");
const { createSlug, generateUniqueSlug } = require("../utils/slug");

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

attributeSchema.pre("save", async function (next) {
  if (this.isModified("name") || !this.slug) {
    const baseSlug = createSlug(this.name);
    this.slug = await generateUniqueSlug(this.constructor, baseSlug, this._id);
  }
  next();
});

module.exports = mongoose.model("Attribute", attributeSchema);
