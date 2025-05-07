import express from 'express';
import { Transaction } from '../models/Transaction.js';
import { Book } from '../models/Book.js';
import { User } from '../models/User.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.put('/sync-books', async (req, res) => {
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
      }
    }

    res.json({ message: "✅ Book availability synced with transactions" });
  } catch (err) {
    console.error("❌ Sync failed", err);
    res.status(500).json({ message: "Server error during sync" });
  }
});

router.get('/issued-stats', async (req, res) => {
  try {
    const allTxns = await Transaction.find();

    const totalIssued = allTxns.length;
    const currentlyIssued = allTxns.filter(t => !t.returned).length;
    const returned = totalIssued - currentlyIssued;

    const monthly = {};

    allTxns.forEach(txn => {
      const month = new Date(txn.issueDate).toLocaleString('default', { month: 'short', year: 'numeric' });

      if (!monthly[month]) {
        monthly[month] = { issued: 0, currentlyIssued: 0, returned: 0 };
      }

      monthly[month].issued++;

      if (txn.returned) {
        monthly[month].returned++;
      } else {
        monthly[month].currentlyIssued++;
      }
    });

    const monthlyData = Object.entries(monthly).map(([month, stats]) => ({
      month,
      issued: stats.issued,
      currentlyIssued: stats.currentlyIssued,
      returned: stats.returned,
      count: stats.issued // for backward compatibility
    }));

    res.json({ totalIssued, currentlyIssued, returned, monthlyData });
  } catch (err) {
    res.status(500).json({ message: 'Error generating report' });
  }
});


router.get("/most-issued-monthly", async (req, res) => {
  try {
    const result = await Transaction.aggregate([
      {
        $group: {
          _id: {
            month: { $dateToString: { format: "%b %Y", date: "$issueDate" } },
            bookId: "$bookId",
          },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "books",
          localField: "_id.bookId",
          foreignField: "_id",
          as: "book",
        },
      },
      { $unwind: "$book" },
      {
        $project: {
          month: "$_id.month",
          bookTitle: "$book.title",
          count: 1,
        },
      },
      {
        $sort: { "month": 1, "count": -1 },
      }
    ]);

    // Group by month into an object
    const monthlyData = {};
    result.forEach((entry) => {
      if (!monthlyData[entry.month]) {
        monthlyData[entry.month] = [];
      }
      monthlyData[entry.month].push({
        title: entry.bookTitle,
        count: entry.count,
      });
    });

    res.json(monthlyData);
  } catch (err) {
    console.error("❌ Error fetching monthly most issued books:", err);
    res.status(500).json({ message: "Server error" });
  }
});


router.get("/issue-history", protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find({ "issueHistory.0": { $exists: true } });

    const events = [];

    users.forEach((user) => {
      user.issueHistory.forEach((record) => {
        events.push({
          bookTitle: record.bookTitle,
          bookCode: record.bookCode,
          issueDate: record.issueDate,
          returnDate: record.returnDate,
          actualReturnDate: record.actualReturnDate || null,
          studentId: user.id,
          returned: record.returned,
          graceEndDate: record.graceEndDate,
        });
      });
    });

    res.json(events);
  } catch (error) {
    res.status(500).json({ message: "Error fetching issue history", error });
  }
});

router.get("/overdue", protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find();
    const today = new Date();
    const gracePeriod = 4;

    const overdueDetails = [];
    const monthlyMap = {};

    users.forEach(user => {
      user.issueHistory.forEach(entry => {
        const returnDate = new Date(entry.returnDate);
        const graceEndDate = new Date(entry.graceEndDate); // ✅ already saved in DB
        const actualReturnDate = entry.actualReturnDate ? new Date(entry.actualReturnDate) : null;
        const isReturned = entry.returned;

        const monthKey = new Date(entry.issueDate).toLocaleString("default", {
          month: "short",
          year: "numeric",
        });

        // Case 1: Not returned and past return date
        if (!isReturned && returnDate < today) {
          const overdueDays = Math.floor((today - returnDate) / (1000 * 60 * 60 * 24));

          if (!monthlyMap[monthKey]) {
            monthlyMap[monthKey] = { totalOverdues: 0, returnedWithinGrace: 0 };
          }
          monthlyMap[monthKey].totalOverdues++;

          overdueDetails.push({
            studentId: user.id,
            bookTitle: entry.bookTitle,
            bookCode: entry.bookCode,
            issueDate: entry.issueDate,
            returnDate: entry.returnDate,
            graceEndDate: entry.graceEndDate,
            actualReturnDate: null,
            overdueDays,
            returned: false,
            penalty: overdueDays > gracePeriod ? (overdueDays - gracePeriod) * 50 : 0,
          });
        }

        // Case 2: Returned but after returnDate
        else if (isReturned && actualReturnDate && returnDate < actualReturnDate) {
          const overdueDays = Math.floor(
            (actualReturnDate - returnDate) / (1000 * 60 * 60 * 24)
          );

          if (!monthlyMap[monthKey]) {
            monthlyMap[monthKey] = { totalOverdues: 0, returnedWithinGrace: 0 };
          }
          monthlyMap[monthKey].totalOverdues++;

          if (overdueDays <= gracePeriod) {
            monthlyMap[monthKey].returnedWithinGrace++;
          }

          overdueDetails.push({
            studentId: user.id,
            bookTitle: entry.bookTitle,
            bookCode: entry.bookCode,
            issueDate: entry.issueDate,
            returnDate: entry.returnDate,
            graceEndDate: entry.graceEndDate,
            actualReturnDate: entry.actualReturnDate,
            overdueDays,
            returned: true,
            penalty: overdueDays > gracePeriod ? (overdueDays - gracePeriod) * 50 : 0,
          });
        }
      });
    });

    const monthlyStats = Object.entries(monthlyMap).map(([month, stats]) => ({
      month,
      totalOverdues: stats.totalOverdues,
      returnedWithinGrace: stats.returnedWithinGrace,
    }));

    res.json({ overdueDetails, monthlyStats });
  } catch (error) {
    console.error("❌ Error generating overdue report:", error);
    res.status(500).json({ message: "Error generating overdue report", error });
  }
});


export default router;
