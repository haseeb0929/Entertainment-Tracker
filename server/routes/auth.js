import express from "express";
const router = express.Router();
import { body, validationResult } from "express-validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import requireAuth from "../middleware/auth.js";
import sendResetEmail, { sendCodeEmail } from "../utils/email.js";
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

// ---------- Registration (step 1: request code) ----------
router.post(
  "/register/request",
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
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      // if user exists and is verified, don't allow reuse
      if (existingUser && existingUser.verified !== false) {
        return res.status(409).json({ msg: "Email already in use" });
      }

      // create a short-lived verification code (6 digits)
      const code = (Math.floor(100000 + Math.random() * 900000)).toString();
      const codeHash = hashToken(code);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      let userDoc;
      if (existingUser) {
        // resend flow for unverified account; update password to the latest input
        existingUser.passwordHash = await bcrypt.hash(password, 12);
        // prune expired tokens and add new code
        existingUser.refreshTokens = (existingUser.refreshTokens || []).filter(t => t.expiresAt > new Date());
        existingUser.refreshTokens.push({ tokenHash: codeHash, expiresAt });
        await existingUser.save();
        userDoc = existingUser;
      } else {
        // create provisional unverified user
        userDoc = new User({
          name,
          email: email.toLowerCase(),
          passwordHash: await bcrypt.hash(password, 12),
          verified: false,
          roles: ["user"],
          refreshTokens: [{ tokenHash: codeHash, expiresAt }],
        });
        await userDoc.save();
      }

      try {
        await sendCodeEmail(email, name, "Verify your email", code, "Use this code to complete your registration.");
      } catch (e) { console.error("Verification email error", e); }
      return res.status(200).json({ msg: "Verification code sent", userId: userDoc._id });
    } catch (err) {
      console.error("Register request error:", err);
      return res.status(500).json({ msg: "Server error" });
    }
  }
);

// ---------- Registration (step 2: verify code) ----------
router.post(
  "/register/verify",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("code").isLength({ min: 6, max: 6 }).withMessage("Code must be 6 digits"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
    const { email, code } = req.body;
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) return res.status(400).json({ msg: "Invalid email or code" });
      const codeHash = hashToken(code);
      const tokenDoc = user.refreshTokens.find(t => t.tokenHash === codeHash && t.expiresAt > new Date());
      if (!tokenDoc) return res.status(400).json({ msg: "Invalid or expired code" });
  // remove the code token
      user.refreshTokens = user.refreshTokens.filter(t => t.tokenHash !== codeHash);
  user.verified = true;
  await user.save();
      // create profile if not exists
      const existingProfile = await Profile.findOne({ userId: user._id });
      if (!existingProfile) {
        await new Profile({ userId: user._id }).save();
      }
      return res.status(201).json({ msg: "Registration verified", userId: user._id });
    } catch (err) {
      console.error("Register verify error", err);
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

      // block login if email not verified
      if (user.verified === false) {
        res.status(403);
        return res.json({ msg: "Please verify your email before logging in" });
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

// ---------- Forgot password (send numeric code) ----------
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
      if (user.verified === false) {
        return res.json({ msg: "Please verify your email first." });
      }

    // generate 6-digit code
    const code = (Math.floor(100000 + Math.random() * 900000)).toString();
    const codeHash = hashToken(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    user.refreshTokens.push({ tokenHash: codeHash, expiresAt });

    await user.save();
    try {
      await sendCodeEmail(user.email, user.name, "Password reset code", code, "Enter this code in the app to reset your password.");
    } catch (emailErr) {
      console.error("Email sending error", emailErr);
    }
    return res.json({ msg: "If that email exists, a reset code has been sent." });
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
    body("code").isLength({ min: 6, max: 6 }).withMessage("Code must be 6 digits"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 chars"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422);
      return res.json({ errors: errors.array() });
    }
    const { email, code, password } = req.body;
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        res.status(400);
        return res.json({ msg: "Invalid code or email" });
      }
      const codeHash = hashToken(code);
      const tokenDoc = user.refreshTokens.find((t) => t.tokenHash === codeHash && t.expiresAt > new Date());
      if (!tokenDoc) return res.status(400).json({ msg: "Invalid or expired code" });

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