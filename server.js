import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose'; // NEW: Import mongoose
import authRouter from './auth.js';
import itemsRouter from './items.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// NEW: Connect to MongoDB locally
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB successfully!'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', source: 'mongodb-database' }); // Updated source text
});

app.use('/api/auth', authRouter);
app.use('/api', itemsRouter);

const port = Number(process.env.PORT) || 5000;

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});