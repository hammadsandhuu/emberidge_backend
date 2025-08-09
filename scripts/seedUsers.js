const mongoose = require("mongoose");
const User = require("../src/models/user.model");
require("dotenv").config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    await User.deleteMany();

    const adminUser = new User({
      name: "Hammad",
      email: "hammad@gmail.com",
      password: "admin123", // must be >= 8 chars
      passwordConfirm: "admin123", // must match exactly
      role: "admin",
    });

    await adminUser.save(); // triggers pre('save') and hashes password
    console.log("Admin user created!");
    process.exit();
  } catch (err) {
    console.error("Error creating admin:", err);
    process.exit(1);
  }
})();
