import cron from 'node-cron';
import { User } from '../models/User.js';

export const startOverdueChecker = () => {
  cron.schedule('0 1 * * *', async () => { // runs daily at 1 AM
    console.log("⏰ Running overdue checker...");

    try {
      const users = await User.find();

      for (const user of users) {
        let updated = false;

        const updatedHistory = user.issueHistory.map(entry => {
          if (entry.returned) return entry;

          const now = new Date();
          const returnDate = new Date(entry.returnDate);
          const graceEnd = new Date(returnDate.getTime() + 4 * 24 * 60 * 60 * 1000);

          if (now > returnDate && now <= graceEnd) {
            entry.isOverdue = true;
            entry.overdueDays = 0;
            entry.penalty = 0;
            updated = true;
          } else if (now > graceEnd) {
            const overdueDays = Math.floor((now - graceEnd) / (1000 * 60 * 60 * 24));
            entry.isOverdue = true;
            entry.overdueDays = overdueDays;
            entry.penalty = overdueDays * 50;
            updated = true;
          }

          return entry;
        });

        if (updated) {
          await User.findByIdAndUpdate(user._id, {
            issueHistory: updatedHistory
          });
          console.log(`📌 Updated overdue info for user ${user.name}`);
        }
      }

      console.log("✅ Overdue check completed.");
    } catch (err) {
      console.error("❌ Error in overdue checker:", err.message);
    }
  });
};
