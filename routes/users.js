import express from "express";
import multer from "multer";
import csv from "csvtojson";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { Book } from "../models/Book.js";
import { SyncLog } from "../models/SyncLog.js";
import { Transaction } from "../models/Transaction.js";

const router = express.Router();

// Get all users
router.get("/", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ message: "User not found" });

    let totalPenalty = 0;
    const today = new Date();

    const updatedHistory = user.issueHistory.map((entry) => {
      if (!entry.returned && new Date(entry.returnDate) < today) {
        const overdueDays = Math.ceil(
          (today - new Date(entry.returnDate)) / (1000 * 60 * 60 * 24)
        );
        totalPenalty += overdueDays * 100;
        return {
          ...entry._doc,
          overdueDays,
          penalty: overdueDays * 100,
          isOverdue: true,
        };
      }
      return { ...entry._doc, isOverdue: false };
    });

    const updatedUser = {
      ...user.toObject(),
      issueHistory: updatedHistory,
      totalPenalty,
    };

    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Create a new user
router.post("/", async (req, res) => {
  const { id, name, email, password, role } = req.body;
  const newUser = new User({
    id,
    name,
    email,
    password,
    role,
    rawPassword: password,
  });
  await newUser.save();
  res.status(201).json(newUser);
});

//calculate-overdues
router.put("/calculate-overdues", async (req, res) => {
  try {
    const users = await User.find();
    const today = new Date();

    for (let user of users) {
      let updated = false;

      user.issueHistory.forEach((entry) => {
        if (!entry.returned && entry.graceEndDate) {
          const graceEnd = new Date(entry.graceEndDate);

          if (today > graceEnd) {
            const penaltyDays = Math.floor(
              (today - graceEnd) / (1000 * 60 * 60 * 24)
            );

            entry.isOverdue = true;
            entry.overdueDays = penaltyDays;
            entry.penalty = penaltyDays * 50;
            updated = true;
          } else {
            // Grace period not yet over, or still in it
            entry.isOverdue = false;
            entry.overdueDays = 0;
            entry.penalty = 0;
          }
        }
      });

      if (updated) {
        await user.save();
      }
    }

    res.json({ message: "✅ Overdue + Penalty calculation completed" });
  } catch (error) {
    console.error("❌ Error calculating penalty:", error);
    res.status(500).json({ message: "Error calculating penalty", error });
  }
});

// PUT /api/users/update-details/:id
router.put("/update-details/:id", async (req, res) => {
  const { name, email, otherDetails } = req.body;

  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      {
        name,
        email,
        otherDetails: {
          fullName: otherDetails?.fullName,
          contactNumber: otherDetails?.contactNumber,
          address: otherDetails?.address,
        },
      },
      { new: true }
    );

    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });

    res.json({ message: "User details updated successfully", updatedUser });
  } catch (error) {
    console.error("❌ Error updating user details:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/book-sync", async (req, res) => {
  const updatedTitles = [];

  try {
    const books = await Book.find();

    for (const book of books) {
      const txn = await Transaction.findOne({
        bookId: book._id,
        returned: false,
      });

      const isIssued = !!txn;

      if (book.isAvailable === isIssued) {
        await Book.findByIdAndUpdate(book._id, {
          isAvailable: !isIssued,
        });

        updatedTitles.push(book.title);
        console.log(`🔄 Book synced: ${book.title}`);
      }
    }

    // Save sync log (success)
    await SyncLog.create({
      status: "success",
      message: "Manual book sync completed successfully",
      updatedBooks: updatedTitles,
    });

    res.json({
      message: "✅ Manual book sync completed",
      updatedBooks: updatedTitles,
    });
  } catch (err) {
    console.error("❌ Manual book sync error:", err.message);

    await SyncLog.create({
      status: "error",
      message: "Manual book sync failed",
      error: err.message,
    });

    res.status(500).json({
      message: "❌ Manual book sync failed",
      error: err.message,
    });
  }
});

//bulk upload users
const upload = multer({ storage: multer.memoryStorage() });

router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const buffer = req.file.buffer;
    const ext = req.file.originalname.split(".").pop().toLowerCase();

    let users = [];

    if (ext === "json") {
      users = JSON.parse(buffer.toString());
    } else if (ext === "csv") {
      users = await csv().fromString(buffer.toString());
    } else {
      return res.status(400).json({ message: "Unsupported file type" });
    }

    const savedUsers = [];

    for (let userData of users) {
      const { id, name, email, password, role, ...rest } = userData;

      if (!id || !name || !email || !password) continue; // skip invalid
      

      const newUser = new User({
        id,
        name,
        email,
        password, // plain-text password
        rawPassword: password, // store original
        role: role || "student",
        ...rest,
      });

      const saved = await newUser.save();
      savedUsers.push(saved);
    }

    res.status(201).json({
      message: `✅ Uploaded ${savedUsers.length} users successfully`,
      data: savedUsers,
    });
  } catch (err) {
    console.error("❌ Error during bulk user upload:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
