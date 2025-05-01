import express from "express";
import {Book} from "../models/Book.js";
import multer from "multer";
import csvParser from "csv-parser";
import fs from "fs";
import path from "path";

const router = express.Router();

// GET request to fetch all books
router.get("/", async (req, res) => {
  try {
    // console.log("GET request received for books"); 
    const books = await Book.find(); 
    // console.log('Books:', books); 
    if (!books || books.length === 0) {
      return res.status(404).json({ message: "No books found" });
    }
    res.status(200).json(books); 
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).json({ message: "Error fetching books" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    res.json(book);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const newBook = new Book(req.body); // accepts all fields
    await newBook.save();
    res.status(201).json(newBook);
  } catch (error) {
    console.error("Error creating book:", error);
    res.status(500).json({ message: "Failed to create book" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updatedBook = await Book.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!updatedBook)
      return res.status(404).json({ message: "Book not found" });

    res.json(updatedBook);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// DELETE book by ID
router.delete("/:id", async (req, res) => {
  try {
    const deletedBook = await Book.findByIdAndDelete(req.params.id);
    if (!deletedBook) {
      return res.status(404).json({ message: "Book not found" });
    }
    res.json({ message: "Book deleted successfully" });
  } catch (err) {
    console.error("Error deleting book:", err);
    res.status(500).json({ message: "Server error" });
  }
});


router.put("/issue/:id", async (req, res) => {
  try {
    const updatedBook = await Book.findByIdAndUpdate(
      req.params.id,
      { isAvailable: false },
      { new: true }
    );
    
    if (!updatedBook)
      return res.status(404).json({ message: "Book not found" });
    res.json(updatedBook);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


// bulk upload via CSV or JSON
const upload = multer({ dest: "uploads/" });

router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname);
    let booksToInsert = [];

    if (ext === ".json") {
      const rawData = fs.readFileSync(filePath);
      booksToInsert = JSON.parse(rawData);
    } else if (ext === ".csv") {
      booksToInsert = await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
          .pipe(csvParser())
          .on("data", (data) => results.push(data))
          .on("end", () => resolve(results))
          .on("error", reject);
      });
    } else {
      return res.status(400).json({ message: "Unsupported file format" });
    }

    const inserted = await Book.insertMany(booksToInsert);
    fs.unlinkSync(filePath);
    res.status(201).json({ message: "Books added successfully", inserted });
  } catch (err) {
    console.error("Bulk upload failed:", err);
    res.status(500).json({ message: "Failed to upload books" });
  }
});

export default router;
