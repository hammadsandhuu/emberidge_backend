const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const path = require("path");
const app = express();

const AppError = require("./utils/appError");
const errorHandler = require("./middleware/error");

const authRoutes = require("./routes/auth.routes");
const userRoute = require("./routes/user.routes");
const categoryRoutes = require("./routes/category.routes");
const productRoutes = require("./routes/product.routes");
const dealRoutes = require("./routes/deal.routes");
const cartRoutes = require("./routes/cart.routes");
const wishlistRoutes = require("./routes/wishlist.routes");
const orderRoutes = require("./routes/order.routes");
const couponRoutes = require("./routes/coupon.routes");
const shippingZoneRoutes = require("./routes/shippingZone.routes");
const siteSettingRoutes = require("./routes/siteSetting.routes");
const stripeWebhook = require("./routes/stripeWebhook.route");

app.use("/api/stripe", stripeWebhook);
// CORS
app.use(cors());
app.options("*", cors());

// Security
app.use(helmet());

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Rate limiting
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests from this IP, please try again in an hour!",
});
app.use("/api", limiter);
// Body parser
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

// Sanitization
app.use(mongoSanitize());
app.use(xss());

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      "duration",
      "ratingsQuantity",
      "ratingsAverage",
      "maxGroupSize",
      "difficulty",
      "price",
    ],
  })
);

// Compression
app.use(compression());
app.get("/", (req, res) => {
  res.send("Hello world");
});

// Routes
app.use("/auth", authRoutes);
app.use("/api/v1/users", userRoute);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/deals", dealRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/wishlist", wishlistRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/coupon", couponRoutes);
app.use("/api/v1/shipping-zones", shippingZoneRoutes);
app.use("/api/v1/admin/settings", siteSettingRoutes);

// Static files
app.use(express.static(path.join(__dirname, "public")));
app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});
app.use(errorHandler);

module.exports = app;
