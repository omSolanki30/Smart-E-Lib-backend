import express from 'express';
import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import {Transaction} from '../models/Transaction.js';
import  {Book}  from '../models/Book.js';
import  {User}  from '../models/User.js';

const router = express.Router();

// Get all transactions
router.get('/', async (req, res) => {
  const transactions = await Transaction.find().populate('userId').populate('bookId');
  res.json(transactions);
});

router.get("/transaction/:id", async (req, res) => {
  const txnId = req.params.id;
  try {
    const txn = await Transaction.findOne({ transactionId: txnId });
    if (!txn) return res.status(404).json({ message: "Transaction not found" });
    res.json(txn);
  } catch (error) {
    res.status(500).json({ message: "Error finding transaction" });
  }
});

router.get("/verify", async (req, res) => {
  const { query } = req.query;

  try {
    if (query.startsWith("TXN")) {
      const txn = await Transaction.findOne({ transactionId: query });
      if (!txn) return res.status(404).send("Not found");
      return res.json({ type: "Transaction", id: query, details: txn });
    }

    if (query.startsWith("STU")) {
      const user = await User.findOne({ id: query });
      if (!user) return res.status(404).send("Not found");
      return res.json({ type: "Student", id: query, details: user });
    }

    if (query.startsWith("BOOK")) {
      const book = await Book.findOne({ bookCode: query });
      if (!book) return res.status(404).send("Not found");
      return res.json({ type: "Book", id: query, details: book });
    }

    return res.status(404).send("Invalid query");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});


// Get User Book Summary
router.get('/summary/:userId', async (req, res) => {
  try {
    const user = await User.findByOne({id}).populate('currentIssuedBooks');

    if (!user) return res.status(404).json({ message: 'User not found' });

    const overdue = user.issueHistory.filter(
      (entry) => !entry.returned && new Date(entry.returnDate) < new Date()
    ).length;

    res.json({
      totalIssuedBooks: user.totalIssuedBooks,
      currentlyIssued: user.currentIssuedBooks.length,
      overdue,
      currentIssuedBooks: user.currentIssuedBooks,
      issueHistory: user.issueHistory,
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user summary', error: err.message });
  }
});


router.post('/', async (req, res) => {
  const { studentID, userId, bookId, bookCode, issueDate, returnDate, bookTitle, graceEndDate} = req.body;
  
  try {

    const user = await User.findOne({ id: studentID }); // e.g., STU2021
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const transactionId = 'TXN-' + nanoid(10);

    // 1. Create Transaction
    const transaction = await Transaction.create({
      userId:user._id,
      studentId: user.id,
      bookId:  new mongoose.Types.ObjectId(bookId),
      bookCode,
      bookTitle,
      transactionId,
      issueDate,
      returnDate,
      graceEndDate 
    });

    // 2. Mark Book as Unavailable
    await Book.findByIdAndUpdate(bookId, { isAvailable: false });

    // 3. Get Book Title (for history entry)
    const book = await Book.findById(bookId);

    if (!book) return res.status(404).json({ message: 'Book not found' });

    // 4. Update User's book info
    await User.findByIdAndUpdate(userId, {
      $push: {
        currentIssuedBooks: bookId,
        issueHistory: {
          transactionId,
          bookId,
          bookTitle: book.title,
          coverImage: book.coverImage,
          author: book.author,
          category: book.category,
          pdfUrl: book.pdfUrl,
          bookCode,
          issueDate,
          returnDate,
          graceEndDate,
          returned: false,
        },
      },
      $inc: { totalIssuedBooks: 1 },
    });

    res.status(201).json(transaction);

  } catch (err) {
    console.error('❌ Error issuing book:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


router.put('/return/:transactionId', async (req, res) => {
  const { transactionId } = req.params;
  const actualReturnDate = new Date(); 

  try {
    // Update Transaction
    const txn = await Transaction.findOneAndUpdate(
      { transactionId },
      { returned: true, actualReturnDate },
      { new: true }
    );

    if (!txn) return res.status(404).json({ message: 'Transaction not found' });

    // Mark Book as available again
    await Book.findByIdAndUpdate(txn.bookId, { isAvailable: true });

    // Update User's history with actualReturnDate
    await User.findOneAndUpdate(
      { _id: txn.userId, 'issueHistory.transactionId': transactionId },
      {
        $set: {
          'issueHistory.$.returned': true,
          'issueHistory.$.actualReturnDate': actualReturnDate,
        },
        $pull: {
          currentIssuedBooks: txn.bookId,
        }
      }
    );

    res.json({ message: '✅ Book returned successfully', transaction: txn });
  } catch (err) {
    console.error('❌ Return error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});



export default router;
