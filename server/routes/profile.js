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

router.post("/saveItem", async (req, res) => {
  try {
    const { id, item } = req.body;

    if (!id || !item || !item.url || !item.name || !item.description) {
      res.status(400);
      return res.json({ msg: "Missing required fields" });
    }

    // Find the profile belonging to this user
    const profile = await Profile.findOne({ userId: id });
    if (!profile) {
      res.status(404)
      return res.json({ msg: "Profile not found" });
    }

    // Add the new item to the user's list
    profile.lists.push({
      url: item.url,
      name: item.name,
      description: item.description
    });

    await profile.save();

    res.status(200);
    return res.json({
      msg: "Item saved successfully",
    });
  } catch (err) {
    console.error("Error saving item:", err);
    res.status(500).json({ msg: "Server error" });
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
