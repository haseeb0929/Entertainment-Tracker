import express from "express";
const router = express.Router();
import { body, validationResult, query } from "express-validator";
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

// username helpers
const normalizeUsername = (u) => (u || "").trim().toLowerCase();
const isValidUsername = (u) => /^[a-z0-9_\.]{3,20}$/.test(u || "");

// ---------- Username availability check ----------
router.get(
  "/username/check",
  [query("username").isString().withMessage("username required")],
  async (req, res) => {
    try {
      const raw = req.query.username || "";
      const username = normalizeUsername(raw);
      if (!isValidUsername(username)) {
        return res.status(200).json({ available: false, reason: "invalid", normalized: username, suggestions: [] });
      }
      const existing = await User.findOne({ username });
      const tempTaken = await TempRegistration.findOne({ username, expiresAt: { $gt: new Date() } });
      if (!existing && !tempTaken) {
        return res.status(200).json({ available: true, normalized: username, suggestions: [] });
      }
      // simple suggestions
      const suggestions = [];
      const base = username.replace(/[^a-z0-9_\.]/g, "");
      for (let i = 1; i <= 50 && suggestions.length < 5; i++) {
        const s1 = `${base}${i}`;
        // avoid duplicates and check db lightly (race safe on actual save)
        // eslint-disable-next-line no-await-in-loop
        const taken = await User.exists({ username: s1 }) || await TempRegistration.exists({ username: s1, expiresAt: { $gt: new Date() } });
        if (!taken) suggestions.push(s1);
      }
      return res.status(200).json({ available: false, reason: "taken", normalized: username, suggestions });
    } catch (err) {
      console.error("Username check error", err);
      return res.status(500).json({ available: false, reason: "error" });
    }
  }
);

// ---------- Registration (step 1: request code) ----------
router.post(
  "/register/request",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 chars long"),
    body("username").trim().notEmpty().withMessage("Username is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    const { name, email, password } = req.body;
    const rawUsername = req.body.username;
    const username = normalizeUsername(rawUsername);
    if (!isValidUsername(username)) {
      return res.status(400).json({ msg: "Username must be 3-20 chars: letters, numbers, underscore, dot" });
    }
    try {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      const existingByUsername = await User.findOne({ username });
      const tempByUsername = await TempRegistration.findOne({ username, expiresAt: { $gt: new Date() } });
      if (existingByUsername && (!existingUser || existingByUsername._id.toString() !== existingUser._id.toString())) {
        return res.status(409).json({ msg: "Username already taken" });
      }
      if (tempByUsername && (!existingUser || tempByUsername.email.toLowerCase() !== (existingUser.email || '').toLowerCase())) {
        return res.status(409).json({ msg: "Username already taken" });
      }
      // if user exists and is verified, don't allow reuse
      if (existingUser && existingUser.verified !== false) {
        return res.status(409).json({ msg: "Email already in use" });
      }

      // create a short-lived verification code (6 digits)
      const code = (Math.floor(100000 + Math.random() * 900000)).toString();
      const codeHash = hashToken(code);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // If an existing verified user with this email exists, block
      if (existingUser && existingUser.verified !== false) {
        return res.status(409).json({ msg: "Email already in use" });
      }

      if (existingUser && existingUser.verified === false) {
        // Legacy/unverified user exists in DB: update password and attach code to their refreshTokens (legacy flow)
        existingUser.passwordHash = await bcrypt.hash(password, 12);
        existingUser.refreshTokens = (existingUser.refreshTokens || []).filter(t => t.expiresAt > new Date());
        existingUser.refreshTokens.push({ tokenHash: codeHash, expiresAt });
        existingUser.username = username; // set/overwrite username for unverified user
        await existingUser.save();
        try {
          await sendCodeEmail(email, name, "Verify your email", code, "Use this code to complete your registration.");
        } catch (e) { console.error("Verification email error", e); }
        return res.status(200).json({ msg: "Verification code sent" });
      }

      // No existing user -> create or update a temporary registration record (don't create real User yet)
      const pwdHash = await bcrypt.hash(password, 12);
      const existingTemp = await TempRegistration.findOne({ email: email.toLowerCase() });
      if (existingTemp) {
        existingTemp.name = name;
        existingTemp.username = username;
        existingTemp.passwordHash = pwdHash;
        existingTemp.codeHash = codeHash;
        existingTemp.expiresAt = expiresAt;
        await existingTemp.save();
      } else {
        await new TempRegistration({
          email: email.toLowerCase(),
          name,
          username,
          passwordHash: pwdHash,
          codeHash,
          expiresAt,
        }).save();
      }

      try {
        await sendCodeEmail(email, name, "Verify your email", code, "Use this code to complete your registration.");
      } catch (e) { console.error("Verification email error", e); }
      return res.status(200).json({ msg: "Verification code sent" });
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
        const codeHash = hashToken(code);

        // First: check temporary registration store
        const temp = await TempRegistration.findOne({ email: email.toLowerCase(), codeHash, expiresAt: { $gt: new Date() } });
        if (temp) {
          // ensure username still available
          const taken = await User.findOne({ username: temp.username });
          if (taken) {
            return res.status(409).json({ msg: "Username already taken" });
          }
          // create real user now
          const newUser = new User({
            name: temp.name,
            email: temp.email,
            passwordHash: temp.passwordHash,
            username: temp.username,
            verified: true,
            roles: ["user"],
            refreshTokens: [],
          });
          await newUser.save();
          // create profile
          await new Profile({ userId: newUser._id }).save();
          // remove temp reg
          await TempRegistration.deleteOne({ _id: temp._id });
          return res.status(201).json({ msg: "Registration verified", userId: newUser._id });
        }

        // Fallback: legacy flow where code was stored on the User document
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(400).json({ msg: "Invalid email or code" });
        const tokenDoc = (user.refreshTokens || []).find(t => t.tokenHash === codeHash && t.expiresAt > new Date());
        if (!tokenDoc) return res.status(400).json({ msg: "Invalid or expired code" });
        // remove the code token
        user.refreshTokens = (user.refreshTokens || []).filter(t => t.tokenHash !== codeHash);
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