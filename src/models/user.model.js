const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const addressSchema = require("./address.model");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide your user name"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please provide your email"],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, "Please provide a valid email"],
    },
    dateOfBirth: Date,
    phoneNumber: {
      type: String,
      validate: {
        validator: (v) => /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/.test(v),
        message: "Please enter a valid phone number",
      },
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
    },
    avatar: {
      type: String,
      default: "",
    },

    // 📦 Address Book (multiple addresses)
    addresses: [addressSchema],

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      minlength: 8,
      select: false,
    },
    passwordConfirm: {
      type: String,
      required: function () {
        return this.isNew;
      },
      validate: {
        validator: function (el) {
          return this.isNew ? el === this.password : true;
        },
        message: "Passwords are not the same!",
      },
    },

    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    active: {
      type: Boolean,
      default: true,
      select: false,
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// 📌 Virtual: Default Complete Address
userSchema.virtual("completeAddress").get(function () {
  if (!this.addresses || this.addresses.length === 0) return "";

  const address = this.addresses.find((a) => a.isDefault) || this.addresses[0];

  return `${
    address.fullName
  }, ${address.streetAddress}, ${address.area || ""}, ${address.city}, ${address.state || ""}, ${address.country} - ${address.postalCode}, Phone: ${address.phoneNumber}`;
});

// 📌 Pre-save hook: Ensure only 1 default address
userSchema.pre("save", function (next) {
  if (this.addresses && this.addresses.length > 1) {
    let defaultCount = this.addresses.filter((a) => a.isDefault).length;
    if (defaultCount === 0) {
      this.addresses[0].isDefault = true; // pehla default banado
    } else if (defaultCount > 1) {
      // agar multiple default mile to sirf pehla rakho
      this.addresses.forEach((a, i) => {
        a.isDefault = i === 0;
      });
    }
  }
  next();
});

// 🔒 Encrypt password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;
  next();
});

userSchema.pre("save", function (next) {
  if (!this.isModified("password") || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Methods
userSchema.methods.correctPassword = async function (candidate, actual) {
  return await bcrypt.compare(candidate, actual);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

module.exports = mongoose.model("User", userSchema);
