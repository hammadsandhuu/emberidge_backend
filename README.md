# Emberidge Backend

E-commerce backend API built with **Node.js**, **Express**, and **MongoDB**.  
This backend is **secure, scalable, and production-ready**.  
It includes **JWT authentication, product management, file uploads, and security middleware**.

---

## ⚡ Quick Start

1️⃣ **Clone the repository:**
```bash
git clone https://github.com/yourusername/emberidge-backend.git
cd emberidge-backend


npm install
npm run dev    # For development
npm start      # For production

🛡️ Safety Notes
npm run db:clear and npm run db:reset will delete all data (with confirmation).
Always review .env settings before running in production.
Use npm run db:migrate for safe schema updates.


| Command              | Description                                                |
| -------------------- | ---------------------------------------------------------- |
| `npm run dev`        | Starts the server in development mode (with Nodemon)       |
| `npm start`          | Starts the server in production mode                       |
| `npm run db:migrate` | Syncs database schema (safe, no data loss)                 |
| `npm run db:seed`    | Inserts seed/test data                                     |
| `npm run db:clear`   | ⚠️ Clears all collections (with confirmation)              |
| `npm run db:reset`   | Clears + Migrates + Seeds the database (with confirmation) |
| `npm run lint`       | Runs ESLint to check code quality                          |
| `npm run format`     | Auto-formats code using Prettier                           |
| `npm test`           | Runs tests using Jest                                      |




🛠️ Features
✅ JWT Authentication with Roles & Permissions
✅ Product & Category Management
✅ Cloudinary + Multer for Image Uploads
✅ Security Middleware (Helmet, XSS Clean, Rate Limiting)
✅ Logging with Winston + Daily Rotate
✅ Testing Setup (Jest + Supertest)
✅ Easy Database Scripts (Clear, Seed, Reset)
✅ Prettier + ESLint for Code Quality




.env
MONGO_URI=mongodb://localhost:27017/emberidge
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=90d
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your_email
EMAIL_PASS=your_password
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret


🤝 Contributing

Fork the repository
Create a feature branch: git checkout -b feature/my-feature
Commit changes: git commit -m "Added a new feature"
Push branch: git push origin feature/my-feature
Open a Pull Request