const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, default: "Home" },
    fullName: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    country: { type: String, required: true },
    state: { type: String },
    city: { type: String, required: true },
    area: { type: String },
    streetAddress: { type: String, required: true },
    apartment: { type: String },
    postalCode: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

module.exports = addressSchema;
