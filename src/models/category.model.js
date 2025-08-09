const mongoose = require("mongoose");
const slugify = require("slugify");

const createSlug = (text) => {
  if (!text) return "";

  // 1. Replace & and other symbols with a space
  let processed = text.replace(/&/g, " ");

  // 2. Add space between camelCase words
  processed = processed.replace(/([a-z])([A-Z])/g, "$1 $2");

  // 3. Remove unwanted special characters, then slugify
  return slugify(processed, {
    lower: true,
    remove: /[*+~.()'"!:@%$#^?{}<>]/g, // remove special chars
  });
};


const childCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "A child category must have a name"],
  },
  slug: String,
  image: {
    id: String,
    thumbnail: String,
  },
  productCount: {
    type: Number,
    default: 0,
  },
});

// Auto-create slug for child categories
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
    slug: String,
    type: {
      type: String,
      enum: ["mega", "normal"],
      default: "normal",
    },
    productCount: {
      type: Number,
      default: 0,
    },
    image: {
      id: String,
      thumbnail: String,
    },
    children: [childCategorySchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now(),
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Create slug from name for parent categories
categorySchema.pre("save", function (next) {
  this.slug = createSlug(this.name);
  next();
});

// Indexes for better performance
categorySchema.index({ slug: 1 });
categorySchema.index({ name: "text" });
categorySchema.index({ productCount: -1 });

const Category = mongoose.model("Category", categorySchema);
module.exports = Category;
