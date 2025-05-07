import express from "express";
import { User } from "../models/User.js";
import { Book } from "../models/Book.js";
import { Transaction } from "../models/Transaction.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get('/me', protect, adminOnly, async (req, res) => {
  try {
    const adminId = req.user._id; // This may be something like "ADM100001"

    // Find the admin using findOne instead of findById
    const admin = await User.findOne({ _id: adminId });

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    res.status(200).json(admin);
  } catch (error) {
    console.error('Error fetching admin info:', error);
    res.status(500).json({ message: 'Error fetching admin info', error: error.message });
  }
});


// Fetch all users (admin only)
router.get("/users", protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Delete user
router.delete("/users/:id", protect, adminOnly, async (req, res) => {
  try {
    const userId = req.params.id;

    // 1. Fetch the user and populate their current issued books
    const user = await User.findById(userId).populate("currentIssuedBooks");
    if (!user) return res.status(404).json({ message: "User not found" });

    const issuedBookIds = user.currentIssuedBooks.map((book) => book._id);

    if (issuedBookIds.length > 0) {
      // 2. Update Books: make them available
      await Book.updateMany(
        { _id: { $in: issuedBookIds } },
        { $set: { isAvailable: true } }
      );

      // 3. Update Transactions: mark as returned
      await Transaction.updateMany(
        {
          userId: user._id,
          bookId: { $in: issuedBookIds },
          returned: false,
        },
        {
          $set: {
            returned: true,
            actualReturnDate: new Date(),
          },
        }
      );
    }

    // 4. Delete the user
    await User.findByIdAndDelete(userId);

    res.json({
      message:
        "User deleted successfully. Issued books were returned and transactions updated.",
    });
  } catch (err) {
    console.error("❌ Failed to delete user:", err);
    res
      .status(500)
      .json({ message: "Failed to delete user and clean up books" });
  }
});

// Promote student to admin
router.put("/users/promote/:id", protect, adminOnly, async (req, res) => {
  try {
    const userId = req.params.id;

    // Step 1: Fetch the user and populate their issued books
    const user = await User.findById(userId).populate("currentIssuedBooks");
    if (!user) return res.status(404).json({ message: "User not found" });

    // Step 2: If the user has issued books, handle returns
    if (user.currentIssuedBooks.length > 0) {
      // 2A: Update isAvailable for all issued books
      await Book.updateMany(
        { _id: { $in: user.currentIssuedBooks.map(book => book._id) } },
        { $set: { isAvailable: true } }
      );

      // 2B: Mark matching transactions as returned
      await Transaction.updateMany(
        { userId: user._id, returned: false },
        {
          $set: {
            returned: true,
            actualReturnDate: new Date(),
          },
        }
      );

      // 2C: Clear currentIssuedBooks for the user
      user.currentIssuedBooks = [];
    }

    // Step 3: Promote user to admin
    user.role = "admin";

    // Save the updated user
    const updatedUser = await user.save();

    res.json({
      message: "User promoted to admin successfully and all issued books returned",
      user: updatedUser,
    });
  } catch (err) {
    console.error("❌ Error promoting user:", err);
    res.status(500).json({ message: "Failed to promote user" });
  }
});

router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalBooks = await Book.countDocuments();
    res.json({ totalUsers, totalBooks });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: 'Error fetching stats' });
  }
});

export default router;
