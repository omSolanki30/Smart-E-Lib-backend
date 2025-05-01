import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import userRoutes from './routes/users.js';
import bookRoutes from './routes/books.js';
import transactionRoutes from './routes/transactions.js';
import authRoutes from './routes/authRoutes.js';
import adminuserRoutes from "./routes/adminUserRoutes.js";
import reportRoutes from "./routes/reports.js"

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());



app.use('/api/users', userRoutes);//http://localhost:5000/api/users/
app.use('/api/admin', adminuserRoutes);//http://localhost:5000/api/admin/
app.use('/api/books', bookRoutes);//http://localhost:5000/api/books/
app.use('/api/transactions', transactionRoutes);//http://localhost:5000/api/transactions/
app.use('/api/auth', authRoutes);//http://localhost:5000/api/auth/
app.use('/api/reports', reportRoutes);//http://localhost:5000/api/reports/


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
