import mongoose from "mongoose";

const bookSchema = new mongoose.Schema(
  {
    bookCode: { type: String, required: true },
    title: { type: String, required: true },
    author: { type: String, required: true },
    category: { type: String, required: true },
    pdfUrl: { type: String, required: true },
    isAvailable: { type: Boolean, default: true },
  },
  { strict: false, timestamps: true, }
);

export const Book = mongoose.model("Books", bookSchema);
