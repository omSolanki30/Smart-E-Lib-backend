import mongoose from "mongoose";

const syncLogSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ["success", "error"], required: true },
    message: String,
    updatedBooks: [String], // titles of books that were synced
    error: String,
  },
  { timestamps: true }
);

export const SyncLog = mongoose.model("SyncLog", syncLogSchema);
