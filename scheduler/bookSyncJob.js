import cron from 'node-cron';
import { Book } from '../models/Book.js';
import { Transaction } from '../models/Transaction.js';
import { SyncLog } from '../models/SyncLog.js';

// Daily at midnight
export const startBookSyncJob = () => {
  cron.schedule('0 0 * * *', async () => {
    console.log("⏰ Daily book sync started");

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
          console.log(`🔄 Synced book: ${book.title}`);
        }
      }

      // Log success entry
      await SyncLog.create({
        status: "success",
        message: "Book availability sync completed successfully",
        updatedBooks: updatedTitles,
      });

      console.log("✅ Book availability sync complete");
    } catch (err) {
      console.error("❌ Book sync error:", err.message);

      // Log error entry
      await SyncLog.create({
        status: "error",
        message: "Book sync failed",
        error: err.message,
      });
    }
  });
};
