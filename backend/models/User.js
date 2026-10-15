import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'counselor', 'user'],
    default: 'user',
  },
  displayName: {
    type: String,
  },
  studentId: {
    type: String,
    default: null,
  },
  // ── Password lifecycle (forced change on first login) ──
  mustChangePassword: { type: Boolean, default: false },
  passwordChangedAt: { type: Date },
  lastLoginAt: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
});

export default mongoose.model('User', userSchema);