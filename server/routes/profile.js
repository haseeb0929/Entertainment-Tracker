import express from "express";
import Profile from "../models/Profile.js";

const router = express.Router();

// Get profile (all data)
router.get("/:userId", async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.params.userId });
    if (!profile) {
      res.status(404);
      return res.json({ message: "Profile not found" });
    }
    res.status(200);
    res.json(profile);
  } catch (err) {
    res.status(500);
    res.json({ error: "Failed to fetch profile" });
  }
});


// Update profile
router.put("/:userId", async (req, res) => {
  try {
    const updated = await Profile.findOneAndUpdate(
      { userId: req.params.userId },
      req.body,
      { new: true, upsert: true }
    );
    res.status(200);
    res.json(updated);
  } catch (err) {
    res.status(500);
    res.json({ error: "Failed to update profile" });
  }
});

export default router;
