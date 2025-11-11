import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import itemsRoutes from "./routes/Items.js";
import profileRoutes from "./routes/Profile.js";


dotenv.config();
const app = express();

// Middlewares
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));

// Rate limit for auth
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/auth", limiter);

// Routes
app.use("/auth", authRoutes);
app.use("/getItemsOf", itemsRoutes);
app.use("/api/profile", profileRoutes);

// Static uploads (for avatars)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.join(__dirname, "uploads");
const avatarsDir = path.join(uploadsRoot, "avatars");
try {
  fs.mkdirSync(avatarsDir, { recursive: true });
} catch (e) { /* ignore */ }
// Ensure uploads can be embedded cross-origin (client runs on a different port)
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(uploadsRoot)
);


// Health check
app.get("/", (req, res) => res.send({ ok: true }));

// DB connect
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Mongo connect error:", err);
    process.exit(1);
  });
