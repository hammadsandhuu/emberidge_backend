// utils/apiFeatures.js
const Category = require("../models/category.model");
const Tag = require("../models/tag.model");
const Attribute = require("../models/attribute.model");

class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
    this.pagination = {};
  }

  async buildFilters() {
    const {
      category,
      subCategory,
      tags,
      tag,
      attributes,
      minPrice,
      maxPrice,
      inStock,
      onSale,
      search,
      q,
    } = this.queryString;

    const filter = {};
    const andConditions = [];

    /* ---------- CATEGORY ---------- */
    if (category) {
      const categoryDoc = await Category.findOne({ slug: category }).select(
        "_id"
      );
      if (!categoryDoc) throw new Error(`Category "${category}" not found`);
      andConditions.push({ category: categoryDoc._id });
    }
    if (subCategory) andConditions.push({ subCategory });

    /* ---------- TAGS (Batch Query) ---------- */
    let allTagSlugs = [];
    if (tags) allTagSlugs.push(...tags.split(","));
    if (tag) allTagSlugs.push(tag);

    if (allTagSlugs.length > 0) {
      const tagDocs = await Tag.find({ slug: { $in: allTagSlugs } }).select(
        "_id"
      );
      if (tagDocs.length > 0) {
        andConditions.push({ tags: { $in: tagDocs.map((t) => t._id) } });
      }
    }

    /* ---------- PRICE RANGE ---------- */
    if (minPrice || maxPrice) {
      const priceFilter = {};
      if (minPrice) priceFilter.$gte = Number(minPrice);
      if (maxPrice) priceFilter.$lte = Number(maxPrice);
      andConditions.push({ price: priceFilter });
    }

    /* ---------- STOCK & SALE ---------- */
    if (inStock === "true") andConditions.push({ in_stock: true });
    if (onSale === "true") andConditions.push({ on_sale: true });

    /* ---------- ATTRIBUTES (Batch Query) ---------- */
    if (attributes) {
      const attrArray = attributes.split(",");
      const attrSlugs = attrArray.map((a) => a.split(":")[0]);

      const attrDocs = await Attribute.find({
        slug: { $in: attrSlugs },
      }).select("_id slug");

      const attrConditions = attrArray
        .map((attr) => {
          const [attrName, value] = attr.split(":");
          const attribute = attrDocs.find((a) => a.slug === attrName);
          if (!attribute) return null;

          return {
            "variation_options.attributes": {
              $elemMatch: { attribute: attribute._id, value },
            },
          };
        })
        .filter(Boolean);

      if (attrConditions.length > 0) andConditions.push(...attrConditions);
    }

    /* ---------- APPLY BASE FILTER ---------- */
    if (andConditions.length > 0) filter.$and = andConditions;
    this.query = this.query.find(filter);

    /* ---------- TEXT SEARCH (Fast) ---------- */
    const searchTerm = search || q;
    if (searchTerm) {
      this.query = this.query.find({
        $text: { $search: searchTerm },
      });
    }

    return this;
  }

  sort() {
    const { sort_by } = this.queryString;
    const sortOptions = {
      "new-arrival": { createdAt: -1 },
      "best-selling": { ratingsQuantity: -1 },
      lowest: { price: 1 },
      highest: { price: -1 },
    };
    this.query = this.query.sort(sortOptions[sort_by] || { createdAt: -1 });
    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(",").join(" ");
      this.query = this.query.select(fields);
    }
    return this;
  }

  paginate(totalCount = 0) {
    const page = parseInt(this.queryString.page, 10) || 1;
    const limit = parseInt(this.queryString.limit, 10) || 12;
    const skip = (page - 1) * limit;

    this.pagination = {
      total: totalCount,
      page,
      pages: Math.ceil(totalCount / limit),
      limit,
    };

    this.query = this.query.skip(skip).limit(limit);
    return this;
  }
}

module.exports = APIFeatures;
