import express from "express";
import Profile from "../models/Profile.js";
import User from "../models/User.js";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multer storage for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "..", "uploads", "avatars")),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeUser = (req.params.userId || "user").toString();
    cb(null, `${safeUser}-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  fileFilter: (req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".gif", ".webp"]; 
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) return cb(new Error("Only image files are allowed"));
    cb(null, true);
  },
});

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
    const { userId, item } = req.body;

    if (!userId || !item || !item.url || !item.name) {
      res.status(400);
      return res.json({ msg: "Missing required fields" });
    }

    // Find the profile belonging to this user
    const profile = await Profile.findOne({ userId });
    if (!profile) {
      res.status(404);
      return res.json({ msg: "Profile not found" });
    }

    // Normalize type and externalId
    const itemType = (item.type || "unknown").toString().toLowerCase();
    const itemExternalId = item.externalId || null;

    // Prevent duplicates: match by url OR (name + type) OR externalId if provided
    const alreadyExists = profile.lists.some((li) => {
      if (itemExternalId && li.externalId && li.externalId === itemExternalId) return true;
      if (li.url && li.url === item.url) return true;
      const liType = (li.type || "unknown").toLowerCase();
      return li.name === item.name && liType === itemType;
    });

    if (alreadyExists) {
      return res.status(200).json({ msg: "Item already in your list", duplicate: true });
    }

    // Add the new item to the user's list
    profile.lists.push({
      url: item.url,
      name: item.name,
      description: item.description || "No description available",
      status: item.status || "currently_watching",
      thumbnail: item.thumbnail || "",
      type: itemType,
      externalId: itemExternalId,
    });

    // Log activity: item added
    try {
      profile.activity = Array.isArray(profile.activity) ? profile.activity : [];
      profile.activity.push({
        action: "added",
        type: itemType,
        name: item.name,
        externalId: itemExternalId,
        date: new Date(),
      });
    } catch (_) { }

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

// Update item status (Currently Watching, Completed, Dropped, On Hold)
router.patch("/updateItemStatus", async (req, res) => {
  try {
    const { userId, identifier = {}, newStatus } = req.body;

    const allowed = [
      "currently_watching", "completed", "dropped", "on_hold",
      // accept legacy for compatibility but we will not set them
      "watched", "unwatched", "hold"
    ];
    if (!userId || !newStatus || !allowed.includes(newStatus)) {
      return res.status(400).json({ msg: "Invalid payload" });
    }

    const profile = await Profile.findOne({ userId });
    if (!profile) return res.status(404).json({ msg: "Profile not found" });

    const { externalId, url, name, type } = identifier;
    const targetIdx = profile.lists.findIndex((li) => {
      if (externalId && li.externalId === externalId) return true;
      if (url && li.url === url) return true;
      if (name && type && li.name === name && (li.type || "unknown") === (type || "unknown")) return true;
      return false;
    });

    if (targetIdx === -1) {
      return res.status(404).json({ msg: "Item not found in list" });
    }

    const li = profile.lists[targetIdx];
    profile.lists[targetIdx].status = newStatus;

    // Log activity: completed milestone (watching habits)
    try {
      if (newStatus === "completed") {
        profile.activity = Array.isArray(profile.activity) ? profile.activity : [];
        profile.activity.push({
          action: "completed",
          type: (li.type || "unknown"),
          name: li.name,
          externalId: li.externalId,
          date: new Date(),
        });
      }
    } catch (_) { }
    await profile.save();
    return res.status(200).json({ msg: "Status updated", item: profile.lists[targetIdx] });
  } catch (err) {
    console.error("Error updating item status:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

// Update item meta: rating (0-5), review (string), rewatchCount (>=0)
router.patch("/updateItemMeta", async (req, res) => {
  try {
    const { userId, identifier = {}, patch = {} } = req.body;
    if (!userId) return res.status(400).json({ msg: "userId required" });

    const { rating, review, rewatchCount } = patch;
    if (rating !== undefined && (typeof rating !== 'number' || rating < 0 || rating > 5)) {
      return res.status(400).json({ msg: "rating must be a number between 0 and 5" });
    }
    if (rewatchCount !== undefined && (!Number.isInteger(rewatchCount) || rewatchCount < 0)) {
      return res.status(400).json({ msg: "rewatchCount must be a non-negative integer" });
    }

    const profile = await Profile.findOne({ userId });
    if (!profile) return res.status(404).json({ msg: "Profile not found" });

    const { externalId, url, name, type } = identifier;
    const idx = profile.lists.findIndex((li) => {
      if (externalId && li.externalId === externalId) return true;
      if (url && li.url === url) return true;
      if (name && type && li.name === name && (li.type || "unknown") === (type || "unknown")) return true;
      return false;
    });
    if (idx === -1) return res.status(404).json({ msg: "Item not found in list" });

    const li = profile.lists[idx];
    const prevRewatch = li.rewatchCount || 0;
    if (rating !== undefined) li.rating = rating;
    if (review !== undefined) li.review = review;
    if (rewatchCount !== undefined) li.rewatchCount = rewatchCount;

    // Log activity: rewatch increments
    try {
      if (rewatchCount !== undefined) {
        const diff = (rewatchCount || 0) - (prevRewatch || 0);
        if (diff > 0) {
          profile.activity = Array.isArray(profile.activity) ? profile.activity : [];
          profile.activity.push({
            action: "rewatch",
            type: (li.type || "unknown"),
            name: li.name,
            externalId: li.externalId,
            count: diff,
            date: new Date(),
          });
        }
      }
    } catch (_) { }

    await profile.save();
    return res.status(200).json({ msg: "Meta updated", item: profile.lists[idx] });
  } catch (err) {
    console.error("Error updating item meta:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

// Delete item from user's list
router.delete("/deleteItem", async (req, res) => {
  try {
    const { userId, identifier = {} } = req.body || {};
    if (!userId) return res.status(400).json({ msg: "userId required" });

    const profile = await Profile.findOne({ userId });
    if (!profile) return res.status(404).json({ msg: "Profile not found" });

    const { externalId, url, name, type } = identifier;
    const idx = profile.lists.findIndex((li) => {
      if (externalId && li.externalId === externalId) return true;
      if (url && li.url === url) return true;
      if (name && type && li.name === name && (li.type || "unknown") === (type || "unknown")) return true;
      return false;
    });

    if (idx === -1) return res.status(404).json({ msg: "Item not found in list" });

    const [removed] = profile.lists.splice(idx, 1);
    // Log activity: removed
    try {
      profile.activity = Array.isArray(profile.activity) ? profile.activity : [];
      profile.activity.push({
        action: "removed",
        type: (removed?.type || "unknown"),
        name: removed?.name,
        externalId: removed?.externalId,
        date: new Date(),
      });
    } catch (_) { }
    await profile.save();
    return res.status(200).json({ msg: "Item removed", removed });
  } catch (err) {
    console.error("Error deleting item:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

// Update profile
router.put("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, bio, website, location, avatarUrl } = req.body || {};

    // Update profile allowed fields
    const profileUpdate = {};
    if (typeof bio === 'string') profileUpdate.bio = bio;
    if (typeof website === 'string') profileUpdate.website = website;
    if (typeof location === 'string') profileUpdate.location = location;
    if (typeof avatarUrl === 'string') profileUpdate.avatarUrl = avatarUrl;

    let updatedProfile = await Profile.findOneAndUpdate(
      { userId },
      profileUpdate,
      { new: true, upsert: true }
    );

    // Update user's display name if provided
    if (typeof name === 'string' && name.trim()) {
      await User.findByIdAndUpdate(userId, { name: name.trim() });
    }

    // Load the latest user name to return together with profile
    const user = await User.findById(userId).select('name');
    const response = updatedProfile ? updatedProfile.toObject() : {};
    response.name = user?.name || response.name;

    res.status(200).json(response);
  } catch (err) {
    console.error('Failed to update profile:', err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
// Upload avatar
router.post("/:userId/avatar", upload.single("avatar"), async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ msg: "userId required" });
    if (!req.file) return res.status(400).json({ msg: "No file uploaded" });

    const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
    const relative = `/uploads/avatars/${req.file.filename}`;
    const avatarUrl = `${serverUrl}${relative}`;

    const updated = await Profile.findOneAndUpdate(
      { userId },
      { avatarUrl },
      { new: true }
    );
    if (!updated) return res.status(404).json({ msg: "Profile not found" });
    return res.status(200).json({ msg: "Avatar updated", avatarUrl });
  } catch (err) {
    console.error("Error uploading avatar:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});
// New: stats endpoint for watching habits
router.get("/:userId/stats", async (req, res) => {
  try {
    const { userId } = req.params;
    const windowParam = (req.query.window || "weekly").toString();
    const daysMap = { weekly: 7, monthly: 30, yearly: 365 };
    const days = daysMap[windowParam] || 7;

    const profile = await Profile.findOne({ userId });
    if (!profile) return res.status(404).json({ msg: "Profile not found" });
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const activity = Array.isArray(profile.activity) ? profile.activity : [];
    const within = activity.filter(a => {
      const d = new Date(a.date || a.time || Date.now());
      return d >= since && d <= now;
    });

    const types = ["movies", "series", "music", "books", "games", "unknown"]; 
    const initCounts = () => types.reduce((acc, t) => (acc[t] = 0, acc), {});
    const completed = initCounts();
    const rewatch = initCounts();
    const added = initCounts();

    within.forEach(a => {
      const t = (a.type || "unknown").toLowerCase();
      if (a.action === "completed") completed[t] = (completed[t] || 0) + 1;
      if (a.action === "rewatch") rewatch[t] = (rewatch[t] || 0) + (a.count || 1);
      if (a.action === "added") added[t] = (added[t] || 0) + 1;
    });

    const sum = obj => Object.keys(obj).reduce((n, k) => n + (obj[k] || 0), 0);
    const response = {
      window: windowParam,
      rangeStart: since.toISOString(),
      rangeEnd: now.toISOString(),
      counts: {
        completed: { ...completed, total: sum(completed) },
        rewatch: { ...rewatch, total: sum(rewatch) },
        added: { ...added, total: sum(added) },
      },
    };
    return res.status(200).json(response);
  } catch (err) {
    console.error("Error getting stats:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});
