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
      category, // legacy single category support
      categories, // multi-category support (comma separated)
      sub_category, // legacy single subcategory
      sub_categories, // multi-subcategory support (comma separated)
      tags,
      tag,
      attributes,
      min_price,
      max_price,
      in_stock,
      on_sale,
      search,
      q,
    } = this.queryString;

    const filter = {};
    const andConditions = [];

    /* ---------- CATEGORIES ---------- */
    if (categories) {
      const categorySlugs = categories.split(",");
      const categoryDocs = await Category.find({
        slug: { $in: categorySlugs },
      }).select("_id");
      if (categoryDocs.length > 0) {
        andConditions.push({
          category: { $in: categoryDocs.map((c) => c._id) },
        });
      }
    } else if (category) {
      const categoryDoc = await Category.findOne({ slug: category }).select(
        "_id"
      );
      if (!categoryDoc) throw new Error(`Category "${category}" not found`);
      andConditions.push({ category: categoryDoc._id });
    }

    /* ---------- SUB-CATEGORIES ---------- */
    if (sub_categories) {
      const subCategorySlugs = sub_categories.split(",");
      const subCategoryDocs = await Category.find({
        slug: { $in: subCategorySlugs },
      }).select("_id");
      if (subCategoryDocs.length > 0) {
        andConditions.push({
          subCategory: { $in: subCategoryDocs.map((c) => c._id) },
        });
      }
    } else if (sub_category) {
      const subCategoryDoc = await Category.findOne({
        slug: sub_category,
      }).select("_id");
      if (subCategoryDoc) {
        andConditions.push({ subCategory: subCategoryDoc._id });
      }
    }

    /* ---------- TAGS ---------- */
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
    if (min_price || max_price) {
      const priceFilter = {};
      if (min_price) priceFilter.$gte = Number(min_price);
      if (max_price) priceFilter.$lte = Number(max_price);
      andConditions.push({ price: priceFilter });
    }

    /* ---------- STOCK & SALE ---------- */
    if (in_stock === "true") andConditions.push({ in_stock: true });
    if (on_sale === "true") andConditions.push({ on_sale: true });

    /* ---------- ATTRIBUTES ---------- */
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

    /* ---------- APPLY FILTERS ---------- */
    if (andConditions.length > 0) filter.$and = andConditions;
    this.query = this.query.find(filter);

    /* ---------- TEXT SEARCH ---------- */
    const searchTerm = search || q;
    if (searchTerm) {
      this.query = this.query.find({ $text: { $search: searchTerm } });
    }

    return this;
  }

  sort() {
    const { sort_by } = this.queryString;

    const sortOptions = {
      new_arrival: { createdAt: -1 },
      best_selling: { ratingsQuantity: -1 },
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
