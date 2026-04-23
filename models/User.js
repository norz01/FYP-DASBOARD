import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  displayName: { type: String },
  studentId: { type: String, default: null }
});

export default mongoose.model('User', userSchema);