const mongoose = require("mongoose");

const RefreshTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  replacedByHash: { type: String } // for rotation tracking
}, { _id: false });

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  roles: { type: [String], default: ["user"] },
  refreshTokens: { type: [RefreshTokenSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);
