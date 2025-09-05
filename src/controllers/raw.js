// exports.getProductsByCategory = catchAsync(async (req, res, next) => {
//   const { parent: categorySlug, child: subCategorySlug } = req.query;
//   if (!categorySlug) {
//     return errorResponse(res, "Parent category slug is required", 400);
//   }

//   // Find parent category
//   const category = await Category.findOne({ slug: categorySlug });
//   if (!category) {
//     return errorResponse(res, "No category found with that slug", 404);
//   }

//   // Basic filter setup
//   let filter = { category: category._id };

//   // Sub-category filter
//   if (subCategorySlug) {
//     const subCategory = category.children.find(
//       (child) => child.slug === subCategorySlug
//     );
//     if (!subCategory) {
//       return errorResponse(res, "No sub-category found with that slug", 404);
//     }
//     filter.subCategory = subCategory._id;
//   }

//   // ------------------ ADD FILTERS ------------------
//   const { minPrice, maxPrice, inStock, onSale, attributes, tags, search } =
//     req.query;

//   // Price Range Filter
//   if (minPrice || maxPrice) {
//     filter.price = {};
//     if (minPrice) filter.price.$gte = Number(minPrice);
//     if (maxPrice) filter.price.$lte = Number(maxPrice);
//   }

//   // Stock Filter
//   if (inStock === "true") filter.in_stock = true;

//   // On Sale Filter
//   if (onSale === "true") filter.on_sale = true;

//   // Tags Filter (comma separated slugs)
//   if (tags) {
//     const tagSlugs = tags.split(",");
//     const tagDocs = await Tag.find({ slug: { $in: tagSlugs } }).select("_id");
//     filter.tags = { $in: tagDocs.map((tag) => tag._id) };
//   }

//   // Attribute Filters (Example: ?attributes=color:red,size:XL)
//   if (attributes) {
//     const attrArray = attributes.split(",");
//     const attrConditions = [];

//     for (const attr of attrArray) {
//       const [attrName, value] = attr.split(":");
//       const attribute = await Attribute.findOne({ slug: attrName });
//       if (attribute) {
//         attrConditions.push({
//           "variation_options.attributes": {
//             $elemMatch: { attribute: attribute._id, value },
//           },
//         });
//       }
//     }

//     if (attrConditions.length > 0) {
//       filter.$and = attrConditions;
//     }
//   }

//   // Search Filter (on product name or description)
//   if (search) {
//     filter.$or = [
//       { name: { $regex: search, $options: "i" } },
//       { description: { $regex: search, $options: "i" } },
//     ];
//   }

//   // ------------------ QUERY ------------------
//   let query = Product.find(filter)
//     .populate("tags", "name slug")
//     .populate("category", "name slug")
//     .populate("subCategory", "name slug")
//     .populate({
//       path: "variations",
//       populate: {
//         path: "attribute",
//         model: "Attribute",
//         select: "slug name type values",
//       },
//     })
//     .populate({
//       path: "variation_options",
//       populate: {
//         path: "attributes.attribute",
//         model: "Attribute",
//         select: "slug name type values",
//       },
//     })
//     .populate("image", "original thumbnail")
//     .populate("gallery", "original thumbnail")
//     .populate({
//       path: "reviews",
//       populate: {
//         path: "user",
//         select: "name",
//       },
//       match: { is_approved: true },
//     });

//   const features = new APIFeatures(query, req.query)
//     .sort()
//     .limitFields()
//     .paginate();

//   let products = await features.query;

//   products = products.map((product) => {
//     const obj = product.toObject();
//     obj.additional_info = formatAdditionalInfo(obj);
//     return obj;
//   });

//   return successResponse(
//     res,
//     { products, results: products.length },
//     "Products fetched successfully"
//   );
// });






// exports.getAllProducts = catchAsync(async (req, res, next) => {
//   const filter = {};
//   const andConditions = [];

//   /* ------------------ FILTERING ------------------ */
//   if (req.query.category) {
//     const category = await Category.findOne({
//       slug: req.query.category,
//     }).select("_id");
//     if (!category)
//       return errorResponse(res, "No category found with that slug", 404);
//     andConditions.push({ category: category._id });
//   }

//   if (req.query.subCategory)
//     andConditions.push({ subCategory: req.query.subCategory });

//   if (req.query.minPrice || req.query.maxPrice) {
//     const priceFilter = {};
//     if (req.query.minPrice) priceFilter.$gte = Number(req.query.minPrice);
//     if (req.query.maxPrice) priceFilter.$lte = Number(req.query.maxPrice);
//     andConditions.push({ price: priceFilter });
//   }

//   if (req.query.minRating) {
//     andConditions.push({
//       ratingsAverage: { $gte: Number(req.query.minRating) },
//     });
//   }

//   if (req.query.tag) {
//     const tag = await Tag.findOne({ slug: req.query.tag }).select("_id");
//     if (!tag) return errorResponse(res, "No tag found with that slug", 404);
//     andConditions.push({ tags: tag._id });
//   }

//   if (req.query.search) {
//     const searchRegex = { $regex: req.query.search, $options: "i" };
//     andConditions.push({
//       $or: [{ name: searchRegex }, { description: searchRegex }],
//     });
//   }

//   if (andConditions.length > 0) filter.$and = andConditions;

//   /* ------------------ QUERY WITH POPULATE ------------------ */
//   let query = Product.find(filter)
//     .populate("tags", "name slug")
//     .populate("category", "name slug")
//     .populate("subCategory", "name slug")
//     .populate({
//       path: "variations",
//       populate: {
//         path: "attribute",
//         model: "Attribute",
//         select: "slug name type values",
//       },
//     })
//     .populate({
//       path: "variation_options",
//       populate: {
//         path: "attributes.attribute",
//         model: "Attribute",
//         select: "slug name type values",
//       },
//     })
//     .populate("image", "original thumbnail")
//     .populate("gallery", "original thumbnail");

//   const features = new APIFeatures(query, req.query)
//     .sort()
//     .limitFields()
//     .paginate();

//   let products = await features.query;

//   /* ------------------ FORMAT ADDITIONAL INFO ------------------ */
//   products = products.map((product) => {
//     const obj = product.toObject();
//     obj.additional_info = formatAdditionalInfo(obj);
//     return obj;
//   });

//   return successResponse(
//     res,
//     { products, results: products.length },
//     "Products fetched successfully"
//   );
// });




/* ===============================
   HELPERS
================================*/
async function updateVariableProductStats(productId) {
  const variationOptions = await VariationOption.find({ product: productId });
  if (!variationOptions.length) {
    await Product.findByIdAndUpdate(productId, {
      min_price: null,
      max_price: null,
      in_stock: false,
      is_active: false,
    });
    return;
  }

  const prices = variationOptions
    .map((opt) => opt.price)
    .filter((p) => typeof p === "number");
  const stockAvailable = variationOptions.some((opt) => opt.quantity > 0);

  await Product.findByIdAndUpdate(productId, {
    min_price: prices.length ? Math.min(...prices) : null,
    max_price: prices.length ? Math.max(...prices) : null,
    in_stock: stockAvailable,
    is_active: stockAvailable,
  });
}

// Helper to update product ratings
async function updateProductRatings(productId) {
  const reviews = await Review.find({ product: productId, is_approved: true });

  if (reviews.length === 0) {
    await Product.findByIdAndUpdate(productId, {
      ratingsAverage: 0,
      ratingsQuantity: 0,
    });
    return;
  }

  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = totalRating / reviews.length;

  await Product.findByIdAndUpdate(productId, {
    ratingsAverage: averageRating,
    ratingsQuantity: reviews.length,
  });
}

/* ===============================
   HOOKS
================================*/
productSchema.pre("save", async function (next) {
  if (this.isModified("name") || !this.slug) {
    const baseSlug = createSlug(this.name);
    this.slug = await generateUniqueSlug(this.constructor, baseSlug, this._id);
  }

  if (this.product_type === "simple") this.in_stock = this.quantity > 0;
  else if (this.product_type === "variable")
    await updateVariableProductStats(this._id);

  next();
});

variationOptionSchema.post("save", async function () {
  if (this.product) await updateVariableProductStats(this.product);
});

variationOptionSchema.post("findOneAndDelete", async function (doc) {
  if (doc?.product) await updateVariableProductStats(doc.product);
});

// Update product ratings when a review is deleted
reviewSchema.post("findOneAndDelete", async function (doc) {
  if (doc?.product) {
    await Product.findByIdAndUpdate(doc.product, {
      $pull: { reviews: doc._id },
    });
    await updateProductRatings(doc.product);
  }
});