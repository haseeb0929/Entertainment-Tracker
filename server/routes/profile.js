import express from "express";
import Profile from "../models/Profile.js";
import User from "../models/User.js";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import requireAuth from "../middleware/auth.js";

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

// Require the authenticated user to match :userId param
const ensureSelf = (req, res, next) => {
  if (!req.user || req.user.id !== req.params.userId) {
    return res.status(403).json({ msg: "Forbidden" });
  }
  next();
};

// Get profile (all data)
router.get("/:userId", requireAuth, ensureSelf, async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.params.userId });
    if (!profile) {
      res.status(404);
      return res.json({ message: "Profile not found" });
    }
    const user = await User.findById(req.params.userId).select('name username');
    const resp = profile.toObject();
    if (user) {
      resp.name = user.name;
      resp.username = user.username;
    }
    res.status(200);
    res.json(resp);
  } catch (err) {
    res.status(500);
    res.json({ error: "Failed to fetch profile" });
  }
});

// Set or update username (unique handle)
router.post("/:userId/username", requireAuth, ensureSelf, async (req, res) => {
  try {
    const { userId } = req.params;
    const { username } = req.body || {};
    if (!username || typeof username !== 'string') return res.status(400).json({ msg: "username required" });
    const clean = username.trim().toLowerCase();
    if (!/^[a-z0-9_\.]{3,20}$/.test(clean)) return res.status(400).json({ msg: "username must be 3-20 chars: letters, numbers, underscore, dot" });

    // ensure unique (sparse unique index on schema helps, but we check manually for message)
    const existing = await User.findOne({ username: clean });
    if (existing && existing._id.toString() !== userId) {
      return res.status(409).json({ msg: "Username already taken" });
    }
    await User.findByIdAndUpdate(userId, { username: clean });
    return res.status(200).json({ msg: "Username updated", username: clean });
  } catch (err) {
    console.error("Set username error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

// Add a friend by friend's username
// Send friend request (or auto-accept if inverse pending)
router.post("/:userId/friends/request", requireAuth, ensureSelf, async (req, res) => {
  try {
    const { userId } = req.params;
    const { friendUsername } = req.body || {};
    if (!friendUsername) return res.status(400).json({ msg: "friendUsername required" });
    const friend = await User.findOne({ username: friendUsername.toLowerCase() });
    if (!friend) return res.status(404).json({ msg: "Friend not found" });
    if (friend._id.toString() === userId) return res.status(400).json({ msg: "Cannot add yourself" });

    const myProfile = await Profile.findOne({ userId });
    const theirProfile = await Profile.findOne({ userId: friend._id });
    if (!myProfile || !theirProfile) return res.status(404).json({ msg: "Profile not found" });

    const alreadyFriends = (myProfile.friends || []).some(fid => fid.toString() === friend._id.toString());
    if (alreadyFriends) return res.status(200).json({ msg: "Already friends", already: true });

    // If they already requested me, accept automatically
    const theyRequestedMe = (myProfile.incomingRequests || []).some(fid => fid.toString() === friend._id.toString());
    if (theyRequestedMe) {
      myProfile.incomingRequests = (myProfile.incomingRequests || []).filter(fid => fid.toString() !== friend._id.toString());
      theirProfile.outgoingRequests = (theirProfile.outgoingRequests || []).filter(fid => fid.toString() !== userId);
      myProfile.friends = Array.isArray(myProfile.friends) ? myProfile.friends : [];
      theirProfile.friends = Array.isArray(theirProfile.friends) ? theirProfile.friends : [];
      myProfile.friends.push(friend._id);
      theirProfile.friends.push(myProfile.userId);
      await myProfile.save();
      await theirProfile.save();
      return res.status(200).json({ msg: "Friend request matched. You are now friends.", friend: { id: friend._id, username: friend.username, name: friend.name } });
    }

    // Otherwise, add outgoing for me and incoming for them
    const alreadyPending = (myProfile.outgoingRequests || []).some(fid => fid.toString() === friend._id.toString());
    if (alreadyPending) return res.status(200).json({ msg: "Request already sent", pending: true });
    myProfile.outgoingRequests = Array.isArray(myProfile.outgoingRequests) ? myProfile.outgoingRequests : [];
    theirProfile.incomingRequests = Array.isArray(theirProfile.incomingRequests) ? theirProfile.incomingRequests : [];
    myProfile.outgoingRequests.push(friend._id);
    theirProfile.incomingRequests.push(myProfile.userId);
    await myProfile.save();
    await theirProfile.save();
    return res.status(200).json({ msg: "Friend request sent" });
  } catch (err) {
    console.error("Request friend error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

// Respond to a friend request (accept or decline)
router.post("/:userId/friends/respond", requireAuth, ensureSelf, async (req, res) => {
  try {
    const { userId } = req.params;
    const { requesterUsername, action } = req.body || {};
    if (!requesterUsername || !action) return res.status(400).json({ msg: "requesterUsername and action required" });
    const requester = await User.findOne({ username: requesterUsername.toLowerCase() });
    if (!requester) return res.status(404).json({ msg: "Requester not found" });

    const me = await Profile.findOne({ userId });
    const them = await Profile.findOne({ userId: requester._id });
    if (!me || !them) return res.status(404).json({ msg: "Profile not found" });

    const pending = (me.incomingRequests || []).some(fid => fid.toString() === requester._id.toString());
    if (!pending) return res.status(400).json({ msg: "No such pending request" });

    // remove from pending
    me.incomingRequests = (me.incomingRequests || []).filter(fid => fid.toString() !== requester._id.toString());
    them.outgoingRequests = (them.outgoingRequests || []).filter(fid => fid.toString() !== userId);

    if (action === 'accept') {
      me.friends = Array.isArray(me.friends) ? me.friends : [];
      them.friends = Array.isArray(them.friends) ? them.friends : [];
      if (!me.friends.some(fid => fid.toString() === requester._id.toString())) me.friends.push(requester._id);
      if (!them.friends.some(fid => fid.toString() === userId)) them.friends.push(me.userId);
      await me.save();
      await them.save();
      return res.status(200).json({ msg: "Friend request accepted" });
    } else if (action === 'decline') {
      await me.save();
      await them.save();
      return res.status(200).json({ msg: "Friend request declined" });
    } else {
      return res.status(400).json({ msg: "Invalid action" });
    }
  } catch (err) {
    console.error("Respond friend error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

// List pending friend requests
router.get("/:userId/friends/requests", requireAuth, ensureSelf, async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = await Profile.findOne({ userId })
      .populate({ path: 'incomingRequests', select: 'username name' })
      .populate({ path: 'outgoingRequests', select: 'username name' });
    if (!profile) return res.status(404).json({ msg: "Profile not found" });
    const incoming = (profile.incomingRequests || []).map(u => ({ id: u._id, username: u.username, name: u.name }));
    const outgoing = (profile.outgoingRequests || []).map(u => ({ id: u._id, username: u.username, name: u.name }));
    return res.status(200).json({ incoming, outgoing });
  } catch (err) {
    console.error("List requests error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

// Remove a friend
router.post("/:userId/friends/remove", requireAuth, ensureSelf, async (req, res) => {
  try {
    const { userId } = req.params;
    const { friendUsername } = req.body || {};
    if (!friendUsername) return res.status(400).json({ msg: "friendUsername required" });
    const friend = await User.findOne({ username: friendUsername.toLowerCase() });
    if (!friend) return res.status(404).json({ msg: "Friend not found" });
    const me = await Profile.findOne({ userId });
    const them = await Profile.findOne({ userId: friend._id });
    if (!me) return res.status(404).json({ msg: "Profile not found" });
    const before = (me.friends || []).length;
    me.friends = (me.friends || []).filter(fid => fid.toString() !== friend._id.toString());
    // cleanup pending both sides
    me.incomingRequests = (me.incomingRequests || []).filter(fid => fid.toString() !== friend._id.toString());
    me.outgoingRequests = (me.outgoingRequests || []).filter(fid => fid.toString() !== friend._id.toString());
    if (them) {
      them.friends = (them.friends || []).filter(fid => fid.toString() !== userId);
      them.incomingRequests = (them.incomingRequests || []).filter(fid => fid.toString() !== userId);
      them.outgoingRequests = (them.outgoingRequests || []).filter(fid => fid.toString() !== userId);
      await them.save();
    }
  await me.save();
  const removed = before !== (me.friends || []).length;
    return res.status(200).json({ msg: removed ? "Friend removed" : "Friend not in list" });
  } catch (err) {
    console.error("Remove friend error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

// Cancel an outgoing friend request
router.post("/:userId/friends/cancel", requireAuth, ensureSelf, async (req, res) => {
  try {
    const { userId } = req.params;
    const { targetUsername } = req.body || {};
    if (!targetUsername) return res.status(400).json({ msg: "targetUsername required" });
    const target = await User.findOne({ username: targetUsername.toLowerCase() });
    if (!target) return res.status(404).json({ msg: "User not found" });
    const me = await Profile.findOne({ userId });
    const them = await Profile.findOne({ userId: target._id });
    if (!me) return res.status(404).json({ msg: "Profile not found" });
    me.outgoingRequests = (me.outgoingRequests || []).filter(fid => fid.toString() !== target._id.toString());
    if (them) {
      them.incomingRequests = (them.incomingRequests || []).filter(fid => fid.toString() !== userId);
      await them.save();
    }
    await me.save();
    return res.status(200).json({ msg: "Request canceled" });
  } catch (err) {
    console.error("Cancel request error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

// List current user's friends
router.get("/:userId/friends", requireAuth, ensureSelf, async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = await Profile.findOne({ userId }).populate({ path: 'friends', select: 'username name' });
    if (!profile) return res.status(404).json({ msg: "Profile not found" });
    const friends = (profile.friends || []).map(u => ({ id: u._id, username: u.username, name: u.name }));
    return res.status(200).json({ friends });
  } catch (err) {
    console.error("List friends error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

// View a friend's profile and items by username (only if in friends list)
router.get("/:userId/friends/view/:friendUsername", requireAuth, ensureSelf, async (req, res) => {
  try {
    const { userId, friendUsername } = req.params;
    const friend = await User.findOne({ username: friendUsername.toLowerCase() });
    if (!friend) return res.status(404).json({ msg: "Friend not found" });

    const myProfile = await Profile.findOne({ userId });
    if (!myProfile) return res.status(404).json({ msg: "Profile not found" });
    const allowed = (myProfile.friends || []).some(fid => fid.toString() === friend._id.toString());
    if (!allowed) return res.status(403).json({ msg: "Not in your friends list" });

    const friendProfile = await Profile.findOne({ userId: friend._id });
    if (!friendProfile) return res.status(404).json({ msg: "Friend profile not found" });

    // Return read-only snapshot
    const data = {
      user: { id: friend._id, username: friend.username, name: friend.name },
      bio: friendProfile.bio,
      avatarUrl: friendProfile.avatarUrl,
      lists: friendProfile.lists,
      stats: friendProfile.stats,
    };
    return res.status(200).json(data);
  } catch (err) {
    console.error("View friend error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

router.post("/saveItem", requireAuth, async (req, res) => {
  try {
    const { userId, item } = req.body;
    if (!req.user || req.user.id !== userId) return res.status(403).json({ msg: "Forbidden" });

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
router.patch("/updateItemStatus", requireAuth, async (req, res) => {
  try {
    const { userId, identifier = {}, newStatus } = req.body;
    if (!req.user || req.user.id !== userId) return res.status(403).json({ msg: "Forbidden" });

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
router.patch("/updateItemMeta", requireAuth, async (req, res) => {
  try {
    const { userId, identifier = {}, patch = {} } = req.body;
    if (!req.user || req.user.id !== userId) return res.status(403).json({ msg: "Forbidden" });
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
router.delete("/deleteItem", requireAuth, async (req, res) => {
  try {
    const { userId, identifier = {} } = req.body || {};
    if (!req.user || req.user.id !== userId) return res.status(403).json({ msg: "Forbidden" });
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
router.put("/:userId", requireAuth, ensureSelf, async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, bio, website, location, avatarUrl, username } = req.body || {};

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

    // Update username if provided and valid
    if (typeof username === 'string' && username.trim()) {
      const clean = username.trim().toLowerCase();
      if (!/^[a-z0-9_\.]{3,20}$/.test(clean)) {
        return res.status(400).json({ error: "username must be 3-20 chars: letters, numbers, underscore, dot" });
      }
      const existing = await User.findOne({ username: clean });
      if (existing && existing._id.toString() !== userId) {
        return res.status(409).json({ error: "Username already taken" });
      }
      await User.findByIdAndUpdate(userId, { username: clean });
    }

    // Load the latest user name to return together with profile
    const user = await User.findById(userId).select('name username');
    const response = updatedProfile ? updatedProfile.toObject() : {};
    response.name = user?.name || response.name;
    response.username = user?.username || response.username;

    res.status(200).json(response);
  } catch (err) {
    console.error('Failed to update profile:', err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
// Upload avatar
router.post("/:userId/avatar", requireAuth, ensureSelf, upload.single("avatar"), async (req, res) => {
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
router.get("/:userId/stats", requireAuth, ensureSelf, async (req, res) => {
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
