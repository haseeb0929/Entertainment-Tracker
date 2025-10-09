import mongoose from "mongoose";

const ListItemSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ["watched", "unwatched", "hold"],
      default: "unwatched",
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
    games: {
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
  },
  { timestamps: true }
);

export default mongoose.model("Profile", ProfileSchema);
