import mongoose from "mongoose";

const ListItemSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    thumbnail: { type: String, default: "" },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    review: { type: String, default: "" },
    rewatchCount: { type: Number, min: 0, default: 0 },
    // Added to identify what the item is
    type: {
      type: String,
      enum: ["movies", "series", "music", "books", "anime", "games", "unknown"],
      default: "unknown",
    },
    // Optional external API id to aid de-duplication
    externalId: { type: String },
    status: {
      type: String,
      enum: [
        // legacy
        "watched", "unwatched", "hold",
        // new categories
        "currently_watching", "completed", "dropped", "on_hold"
      ],
      default: "currently_watching",
    },
  },
  { _id: false }
);

const StatsSchema = new mongoose.Schema(
  {
    movies: {
      weekly: { type: Number, default: 0 },
      monthly: { type: Number, default: 0 },
      yearly: { type: Number, default: 0 },
    },
    series: {
      weekly: { type: Number, default: 0 },
      monthly: { type: Number, default: 0 },
      yearly: { type: Number, default: 0 },
    },
    music: {
      weekly: { type: Number, default: 0 },
      monthly: { type: Number, default: 0 },
      yearly: { type: Number, default: 0 },
    },
    books: {
      weekly: { type: Number, default: 0 },
      monthly: { type: Number, default: 0 },
      yearly: { type: Number, default: 0 },
    },
    anime: {
      weekly: { type: Number, default: 0 },
      monthly: { type: Number, default: 0 },
      yearly: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

const ProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },

    // basic info
    bio: { type: String, default: "" },
    location: { type: String, default: "" },
    website: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },

    // extra fields for your UI
    lists: { type: [ListItemSchema], default: [] },
    activity: { type: Array, default: [] },
    stats: { type: StatsSchema, default: () => ({}) },

    joinDate: { type: Date, default: Date.now },

    // social graph
    friends: { type: [ { type: mongoose.Schema.Types.ObjectId, ref: 'User' } ], default: [] },
    incomingRequests: { type: [ { type: mongoose.Schema.Types.ObjectId, ref: 'User' } ], default: [] },
    outgoingRequests: { type: [ { type: mongoose.Schema.Types.ObjectId, ref: 'User' } ], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("Profile", ProfileSchema);
