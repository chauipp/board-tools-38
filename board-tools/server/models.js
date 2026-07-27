import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: String,
    picture: String,
    lastLoginAt: { type: Date, default: Date.now }
  },
  { minimize: false, versionKey: false }
);

export const User = mongoose.model("User", userSchema);

export async function upsertUser({ email, name, picture }) {
  const normalized = String(email).toLowerCase();
  return User.findOneAndUpdate(
    { email: normalized },
    { email: normalized, name, picture, lastLoginAt: new Date() },
    { upsert: true, new: true }
  );
}

const boardMemberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ["editor", "viewer"], required: true },
    addedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const boardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, default: "Untitled board" },
    ownerEmail: { type: String, required: true, lowercase: true, trim: true },
    members: { type: [boardMemberSchema], default: [] },
    nodes: { type: Array, default: [] },
    edges: { type: Array, default: [] },
    groups: { type: Array, default: [] },
    statuses: { type: Array, default: [] },
    tags: { type: Array, default: [] },
    palette: { type: Array, default: [] },
    drawings: { type: Array, default: [] },
    nextNodeId: { type: Number, default: 1 },
    nextEdgeId: { type: Number, default: 1 },
    nextGroupId: { type: Number, default: 1 },
    nextStatusId: { type: Number, default: 1 },
    nextTagId: { type: Number, default: 1 },
    nextPaletteId: { type: Number, default: 1 },
    nextDrawingId: { type: Number, default: 1 },
    view: { type: Object, default: () => ({ panX: 0, panY: 0, scale: 1 }) },
    updatedAt: { type: Date, default: Date.now }
  },
  { minimize: false, versionKey: false }
);

export const Board = mongoose.model("Board", boardSchema);
