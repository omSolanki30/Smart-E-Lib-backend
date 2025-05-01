# 📚 Smart E-Library System — Backend

This is the backend server for the Smart E-Library System built using **Node.js**, **Express.js**, and **MongoDB**. It handles user authentication, book management, transactions, overdue tracking, and admin operations.

---

## 🚀 Features

- 🧑‍💻 User Authentication (JWT-based)
- 📘 Book management (add/update/delete/view)
- 🔁 Book issuing and returning logic
- 🔒 Role-based access for students and admins
- 🕒 Automated overdue checks with penalties
- 📊 Transaction & report generation
- 🛠️ RESTful API for frontend integration

---

## 🧾 Technologies Used

- **Node.js**, **Express.js**
- **MongoDB**, **Mongoose**
- **JWT** for authentication
- **bcrypt** for password hashing
- **cron jobs** for scheduled penalty checks

---

## 📂 Project Structure

```
📁 backend/
├── config/             # Database configuration
├── controllers/        # Route handler logic
├── middleware/         # Auth middlewares
├── models/             # Mongoose models
├── routes/             # All API routes
├── scheduler/          # Overdue/Sync jobs
├── uploads/            # File uploads (if any)
├── utils/              # Helper functions
├── .env                # Environment variables
├── server.js           # App entry point
```

---

## ⚙️ Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-username/smart-e-library-backend.git
cd smart-e-library-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create `.env` file

```env
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
PORT=5000
```

### 4. Start the server

```bash
npm run dev
```

---

## 📬 API Base URL

```
http://localhost:5000/api/
```

---

## 📝 License

This project is licensed under the MIT License.
