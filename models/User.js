import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const bookHistorySchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Books", required: true },
  bookTitle: String,
  coverImage: String,
  author: String,
  category: String,
  pdfUrl: String,
  bookCode: String,
  transactionId: {
    type: String,
    required: true,
  },
  issueDate: { type: Date, required: true },
  returnDate: { type: Date, required: true },
  actualReturnDate: { type: Date, default: null },
  returned: { type: Boolean, default: false },
  graceEndDate: { type: Date, required: true },
  isOverdue: { type: Boolean, default: false },
  overdueDays: { type: Number, default: 0 },
  penalty: { type: Number, default: 0 }
});

const userSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    rawPassword: String,
    role: { type: String, enum: ["student", "admin"], default: "student" },
    totalIssuedBooks: { type: Number, default: 0 },
    currentIssuedBooks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Books" }],
    issueHistory: [bookHistorySchema],
    penalty: { type: Number, default: 0 },
    overdueBooks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Books" }],
    otherDetails: {
      fullName: String,
      contactNumber: String,
      address: String,
    },
    
  },
  { timestamps: true, strict: false }
);

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    if (!this.rawPassword) {
      this.rawPassword = this.password;
    }
    const hashed = await bcrypt.hash(this.password, 10);
    this.password = hashed;
  }
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

export const User = mongoose.model("User", userSchema);
