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
      categories,
      parent,
      child,
      sub_category,
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

    /* ---------- MULTIPLE CATEGORIES ---------- */
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
    }

    /* ---------- PARENT + CHILD ---------- */
    if (parent) {
      const parentCategory = await Category.findOne({ slug: parent }).populate(
        "children"
      );
      if (!parentCategory)
        throw new Error(`Parent category "${parent}" not found`);

      if (child) {
        const childCategory = parentCategory.children.find(
          (c) => c.slug === child
        );
        if (!childCategory)
          throw new Error(`Child category "${child}" not found`);

        andConditions.push({ subCategory: childCategory._id });
      } else {
        const allChildIds = parentCategory.children.map((c) => c._id);
        andConditions.push({
          $or: [
            { category: parentCategory._id },
            { subCategory: { $in: allChildIds } },
          ],
        });
      }
    }

    /* ---------- SUB CATEGORY (direct) ---------- */
    if (sub_category) {
      andConditions.push({ subCategory: sub_category });
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

    /* ---------- APPLY BASE FILTER ---------- */
    if (andConditions.length > 0) filter.$and = andConditions;
    this.query = this.query.find(filter);

    /* ---------- TEXT SEARCH ---------- */
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
