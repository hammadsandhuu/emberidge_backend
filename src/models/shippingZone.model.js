const mongoose = require("mongoose");

/**
 * Embedded schema: Weight-based shipping rate
 * --------------------------------------------
 * Defines tiered pricing for different weight ranges.
 * Used inside ShippingZone to support advanced logistics calculations.
 */
const weightRateSchema = new mongoose.Schema(
  {
    minWeight: {
      type: Number,
      required: true,
      min: [0, "Minimum weight must be >= 0"],
    },
    maxWeight: {
      type: Number,
      required: true,
      validate: {
        validator: function (v) {
          return v > this.minWeight;
        },
        message: "maxWeight must be greater than minWeight",
      },
    },
    rate: {
      type: Number,
      required: true,
      min: [0, "Rate must be positive"],
    },
  },
  { _id: false }
);

/**
 * Main Schema: Shipping Zone
 * --------------------------
 * Represents a region-based shipping zone with tiered weight rates,
 * regional multipliers, and automatic free shipping thresholds.
 */
const shippingZoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true }, // e.g. "Delhi Zone"
    regionCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    }, // e.g. "DL"
    pinCodePrefix: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{2,3}$/, "Invalid pin code prefix"],
    }, // e.g. "11"

    baseRate: { type: Number, default: 50, min: 0 },
    expressMultiplier: { type: Number, default: 1.5, min: 1 },
    regionMultiplier: { type: Number, default: 1.0, min: 0.1 },

    freeShippingThreshold: { type: Number, default: 1000, min: 0 },

    weightRates: { type: [weightRateSchema], default: [] },

    isActive: { type: Boolean, default: true, index: true },

    // 🔐 Audit trail for enterprise control
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

/**
 * 🧠 Pre-save validation:
 * Ensures weight tiers do not overlap or duplicate ranges.
 */
shippingZoneSchema.pre("save", function (next) {
  const rates = (this.weightRates || []).sort(
    (a, b) => a.minWeight - b.minWeight
  );

  for (let i = 0; i < rates.length - 1; i++) {
    const current = rates[i];
    const nextTier = rates[i + 1];

    // Check overlap (strict)
    if (current.maxWeight >= nextTier.minWeight) {
      return next(
        new Error(
          `Overlapping weight tiers detected between ${current.minWeight}-${current.maxWeight}kg and ${nextTier.minWeight}-${nextTier.maxWeight}kg`
        )
      );
    }
  }

  next();
});

/**
 * Virtual: Get effective weight rate for a given weight.
 * Used in cart total calculations.
 */
shippingZoneSchema.methods.getRateForWeight = function (weightKg) {
  if (!this.weightRates?.length) return this.baseRate;

  const tier = this.weightRates.find(
    (t) => weightKg >= t.minWeight && weightKg < t.maxWeight
  );
  return tier ? tier.rate : this.weightRates[this.weightRates.length - 1].rate;
};

/**
 * Virtual: Compute final shipping charge dynamically
 */
shippingZoneSchema.methods.calculateShippingCost = function ({
  totalWeight,
  method = "standard",
  cartTotal = 0,
}) {
  let cost = this.getRateForWeight(totalWeight) * this.regionMultiplier;

  if (method === "express") cost *= this.expressMultiplier;

  // Free shipping threshold
  if (cartTotal >= this.freeShippingThreshold) cost = 0;

  // Always add baseRate (handling/packaging fee)
  cost += this.baseRate;

  return Math.round(cost);
};

module.exports = mongoose.model("ShippingZone", shippingZoneSchema);
