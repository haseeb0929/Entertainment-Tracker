import express from "express";
const router = express.Router();
import { body, validationResult } from "express-validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import requireAuth from "../middleware/auth.js";
import sendResetEmail from "../utils/email.js";
import Profile from "../models/Profile.js";

// helpers
const signAccessToken = (user) => {
  const payload = { sub: user._id.toString(), roles: user.roles };
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m" });
};

const createRefreshTokenString = () => {
  return crypto.randomBytes(64).toString("hex");
};

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const cookieOptions = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
  secure: process.env.NODE_ENV === "production",
  // path: '/',
  // maxAge is set when cookie is set
};

// ---------- Register ----------
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 chars long"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    try {
      // Check if user exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(409).json({ msg: "Email already in use" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);
      const user = new User({
        name,
        email: email.toLowerCase(),
        passwordHash,
        roles: ["user"],
        refreshTokens: [],
      });
      await user.save();

      // Create Profile (personal info, lists, stats)
      const profile = new Profile({
        userId: user._id,
        bio: "",
        location: "",
        website: "",
        avatarUrl: "",
        lists: [],
        activity: [],
        // schema default will auto-create empty stats with zeros
        stats: {}, 
        joinDate: new Date(),
      });
      await profile.save();

      return res.status(201).json({
        msg: "Account created successfully",
        userId: user._id,
      });
    } catch (err) {
      console.error("Register error:", err);
      return res.status(500).json({ msg: "Server error" });
    }
  }
);

// ---------- Login ----------
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422);
      return res.json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        res.status(401);
        return res.json({ msg: "Invalid credentials" });
      }

      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) {
        res.status(401);
        return res.json({ msg: "Invalid credentials" });
      }

      // sign access token
      const accessToken = signAccessToken(user);

      // create refresh token string & store hash in DB
      const refreshTokenString = createRefreshTokenString();
      const refreshTokenHash = hashToken(refreshTokenString);
      const expiresInDays = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || "7", 10);
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

      // add to user's refreshTokens array
      user.refreshTokens.push({
        tokenHash: refreshTokenHash,
        expiresAt,
      });

      // optional: keep array length limited (e.g., last 5 devices)
      if (user.refreshTokens.length > 10) {
        user.refreshTokens = user.refreshTokens.slice(-10);
      }

      await user.save();

      // set refresh token cookie
      res.cookie("refreshToken", refreshTokenString, {
        ...cookieOptions,
        maxAge: expiresInDays * 24 * 60 * 60 * 1000,
      });

      return res.json({ accessToken, userr: { id: user._id, name: user.name, email: user.email } });
    } catch (err) {
      console.error("Login error", err);
      res.status(500);
      return res.json({ msg: "Server error" });
    }
  }
);

// ---------- Refresh ----------
router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      res.status(401);
      return res.json({ msg: "No refresh token" });
    }

    const refreshTokenHash = hashToken(refreshToken);

    // find user with that refresh token
    const user = await User.findOne({ "refreshTokens.tokenHash": refreshTokenHash });
    if (!user) {
      // invalid token - possible reuse
      res.clearCookie("refreshToken", cookieOptions);
      res.status(403);
      return res.json({ msg: "Invalid refresh token" });
    }

    // find the token object
    const tokenDoc = user.refreshTokens.find((t) => t.tokenHash === refreshTokenHash);
    if (!tokenDoc) {
      res.clearCookie("refreshToken", cookieOptions);
      res.status(403);
      return res.json({ msg: "Invalid refresh token" });
    }

    // check expiry
    if (tokenDoc.expiresAt < new Date()) {
      // remove expired token
      user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== refreshTokenHash);
      await user.save();
      res.clearCookie("refreshToken", cookieOptions);
      res.status(403);
      return res.json({ msg: "Refresh token expired" });
    }

    // rotate tokens: issue new refresh token and replace the doc
    const newRefreshTokenString = createRefreshTokenString();
    const newHash = hashToken(newRefreshTokenString);
    const expiresInDays = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || "7", 10);
    const newExpiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    // mark replacedByHash for audit (optional)
    tokenDoc.replacedByHash = newHash;
    // add new token doc
    user.refreshTokens.push({
      tokenHash: newHash,
      expiresAt: newExpiresAt,
    });

    // remove old token (the one being rotated)
    user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== refreshTokenHash && t.tokenHash !== tokenDoc.tokenHash);
    // then push new one (we already pushed newHash above), but ensure unique. Simpler: filter then push:
    user.refreshTokens.push({
      tokenHash: newHash,
      expiresAt: newExpiresAt,
    });

    // limit the array
    if (user.refreshTokens.length > 10) {
      user.refreshTokens = user.refreshTokens.slice(-10);
    }

    await user.save();

    // issue new access token
    const accessToken = signAccessToken(user);

    // set new refresh cookie (httpOnly)
    res.cookie("refreshToken", newRefreshTokenString, {
      ...cookieOptions,
      maxAge: expiresInDays * 24 * 60 * 60 * 1000,
    });

    return res.json({ accessToken, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error("Refresh error", err);
    res.status(500);
    return res.json({ msg: "Server error" });
  }
});

// ---------- Logout ----------
router.post("/logout", async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      const refreshTokenHash = hashToken(refreshToken);
      // remove from DB
      await User.updateMany({}, { $pull: { refreshTokens: { tokenHash: refreshTokenHash } } });
    }

    res.clearCookie("refreshToken", cookieOptions);
    return res.json({ msg: "Logged out" });
  } catch (err) {
    console.error("Logout error", err);
    res.status(500);
    return res.json({ msg: "Server error" });
  }
});

// ---------- Protected route: get current user ----------
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash -refreshTokens");
    if (!user) {
      res.status(404);
      return res.json({ msg: "User not found" });
    }
    return res.json({ user });
  } catch (err) {
    console.error("Me error", err);
    res.status(500);
    return res.json({ msg: "Server error" });
  }
});

// ---------- Change password ----------
router.post(
  "/change-password",
  requireAuth,
  [
    body("currentPassword").notEmpty().withMessage("Current password required"),
    body("newPassword").isLength({ min: 8 }).withMessage("New password must be at least 8 chars"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422);
      return res.json({ errors: errors.array() });
    }

    try {
      const user = await User.findById(req.user.id);
      const match = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
      if (!match) {
        res.status(401);
        return res.json({ msg: "Current password incorrect" });
      }

      const newHash = await bcrypt.hash(req.body.newPassword, 12);
      user.passwordHash = newHash;

      // on password change, revoke all refresh tokens
      user.refreshTokens = [];

      await user.save();
      res.clearCookie("refreshToken", cookieOptions);

      return res.json({ msg: "Password changed. Please login again." });
    } catch (err) {
      console.error("Change password error", err);
      res.status(500);
      return res.json({ msg: "Server error" });
    }
  }
);

// ---------- Forgot password (sends reset link) ----------
router.post("/forgot-password", [body("email").isEmail().withMessage("Valid email required")], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422);
    return res.json({ errors: errors.array() });
  }

  try {
    const user = await User.findOne({ email: req.body.email.toLowerCase() });
    if (!user) {
      return res.json({ msg: "If that email exists, a reset link has been sent." });
    }

    // generate a one-time reset token (short lived)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetHash = hashToken(resetToken);
    // store as a special refreshToken-like doc with short expiry and a flag in replacedByHash?
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.refreshTokens.push({
      tokenHash: resetHash,
      expiresAt,
    });

    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

    // send email (function uses nodemailer)
    try {
      await sendResetEmail(user.email, user.name, resetUrl);
    } catch (emailErr) {
      console.error("Email sending error", emailErr);
    }

    return res.json({ msg: "If that email exists, a reset link has been sent." });
  } catch (err) {
    console.error("Forgot password error", err);
    res.status(500);
    return res.json({ msg: "Server error" });
  }
});

// ---------- Reset password (uses the token sent by email) ----------
router.post(
  "/reset-password",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("token").notEmpty().withMessage("Token required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 chars"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422);
      return res.json({ errors: errors.array() });
    }

    const { email, token, password } = req.body;
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        res.status(400);
        return res.json({ msg: "Invalid token or email" });
      }

      const tokenHash = hashToken(token);
      const tokenDoc = user.refreshTokens.find((t) => t.tokenHash === tokenHash);
      if (!tokenDoc || tokenDoc.expiresAt < new Date()) {
        res.status(400);
        return res.json({ msg: "Invalid or expired token" });
      }

      // update password, remove all refresh tokens
      user.passwordHash = await bcrypt.hash(password, 12);
      user.refreshTokens = []; // revoke tokens including reset token
      await user.save();

      // clear cookie
      res.clearCookie("refreshToken", cookieOptions);

      return res.json({ msg: "Password reset successful. Please login." });
    } catch (err) {
      console.error("Reset password error", err);
      res.status(500);
      return res.json({ msg: "Server error" });
    }
  }
);

export default router;