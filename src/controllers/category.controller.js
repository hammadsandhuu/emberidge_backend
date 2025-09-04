// controllers/category.controller.js
const Category = require("../models/category.model"); // ✅ Direct import
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const APIFeatures = require("../utils/apiFeatures");
const { cloudinary } = require("../../config/cloudinary");
const successResponse = require("../utils/successResponse");

// ========================
// GET ALL CATEGORIES
// ========================
exports.getAllCategories = catchAsync(async (req, res, next) => {
  const filter = {};
  if (req.query.type) filter.type = req.query.type;

  // Count total categories (for pagination)
  const totalCategories = await Category.countDocuments(filter);

  const features = new APIFeatures(
    Category.find(filter).populate("createdBy", "name email"),
    req.query
  );

  await features.buildFilters();
  features.sort().limitFields().paginate(totalCategories);

  const categories = await features.query;

  return successResponse(
    res,
    {
      categories,
      pagination: features.pagination,
    },
    "Categories fetched successfully"
  );
});

// ========================
// GET SINGLE CATEGORY
// ========================
exports.getCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findOne({ slug: req.params.slug }).populate(
    "createdBy",
    "name email"
  );

  if (!category) {
    return next(new AppError("No category found with that slug", 404));
  }

  return successResponse(res, { category }, "Category fetched successfully");
});

// ========================
// CREATE CATEGORY
// ========================
exports.createCategory = catchAsync(async (req, res, next) => {
  if (req.file) {
    req.body.image = {
      id: req.file.filename,
      thumbnail: req.file.path,
    };
  }

  req.body.createdBy = req.user.id;

  const newCategory = await Category.create(req.body);

  return successResponse(
    res,
    { category: newCategory },
    "Category created successfully",
    201
  );
});

// ========================
// UPDATE CATEGORY
// ========================
exports.updateCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return next(new AppError("No category found with that ID", 404));
  }

  if (req.file) {
    if (category.image && category.image.id) {
      await cloudinary.uploader.destroy(category.image.id);
    }
    req.body.image = {
      id: req.file.filename,
      thumbnail: req.file.path,
    };
  }

  const updatedCategory = await Category.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  return successResponse(
    res,
    { category: updatedCategory },
    "Category updated successfully"
  );
});

// ========================
// DELETE CATEGORY
// ========================
exports.deleteCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return next(new AppError("No category found with that ID", 404));
  }

  if (category.image && category.image.id) {
    await cloudinary.uploader.destroy(category.image.id);
  }

  await Category.findByIdAndDelete(req.params.id);

  return successResponse(res, null, "Category deleted successfully", 204);
});

// ========================
// ADD CHILD CATEGORY
// ========================
exports.addChildCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return next(new AppError("No category found with that ID", 404));
  }

  if (
    req.user.role !== "admin" &&
    category.createdBy.toString() !== req.user.id
  ) {
    return next(
      new AppError("You do not have permission to modify this category", 403)
    );
  }

  if (req.file) {
    req.body.image = {
      id: req.file.filename,
      thumbnail: req.file.path,
    };
  }

  category.children.push(req.body);
  await category.save();

  return successResponse(
    res,
    { category },
    "Child category added successfully"
  );
});

// ========================
// UPDATE CHILD CATEGORY
// ========================
exports.updateChildCategory = catchAsync(async (req, res, next) => {
  const { id, childId } = req.params;

  const category = await Category.findById(id);
  if (!category) {
    return next(new AppError("No category found with that ID", 404));
  }

  if (
    req.user.role !== "admin" &&
    category.createdBy.toString() !== req.user.id
  ) {
    return next(
      new AppError("You do not have permission to modify this category", 403)
    );
  }

  const childCategory = category.children.id(childId);
  if (!childCategory) {
    return next(new AppError("No child category found with that ID", 404));
  }

  if (req.file) {
    if (childCategory.image && childCategory.image.id) {
      await cloudinary.uploader.destroy(childCategory.image.id);
    }
    req.body.image = {
      id: req.file.filename,
      thumbnail: req.file.path,
    };
  }

  childCategory.set(req.body);
  await category.save();

  return successResponse(
    res,
    { category },
    "Child category updated successfully"
  );
});

// ========================
// DELETE CHILD CATEGORY
// ========================
exports.deleteChildCategory = catchAsync(async (req, res, next) => {
  const { id, childId } = req.params;

  const category = await Category.findById(id);
  if (!category) {
    return next(new AppError("No category found with that ID", 404));
  }

  if (
    req.user.role !== "admin" &&
    category.createdBy.toString() !== req.user.id
  ) {
    return next(
      new AppError("You do not have permission to modify this category", 403)
    );
  }

  const childCategory = category.children.id(childId);
  if (!childCategory) {
    return next(new AppError("No child category found with that ID", 404));
  }

  if (childCategory.image && childCategory.image.id) {
    await cloudinary.uploader.destroy(childCategory.image.id);
  }

  category.children.pull(childId);
  await category.save();

  return successResponse(
    res,
    { category },
    "Child category deleted successfully",
    200
  );
});
