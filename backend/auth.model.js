import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from './models/User.js';

// Fetch all users directly from MongoDB (where passwords are hashed)
async function readLoginDatabase() {
  const records = await User.find({});
  return records.map((record) => ({
    email: String(record.email).toLowerCase(),
    password: String(record.password), // This is now the hashed password from DB
    role: record.role,
    displayName: record.displayName,
    studentId: record.studentId ?? null,
  }));
}

function sanitiseUser(user) {
  return {
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    studentId: user.studentId,
  };
}

export async function getAllLoginUsers() {
  // We no longer need to merge with a dummy array. Just fetch from DB.
  return await readLoginDatabase();
}

export async function getPublicLoginUsers() {
  const users = await getAllLoginUsers();
  return users.map(sanitiseUser);
}

export async function authenticateUser(email, password) {
  const users = await getAllLoginUsers();
  const normalisedEmail = String(email).trim().toLowerCase();
  
  const user = users.find((entry) => entry.email === normalisedEmail);
  if (!user) return null;

  // All passwords in the DB are hashed, so we always use bcrypt.compare
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return null;

  const token = jwt.sign(
    { 
      email: user.email, 
      role: user.role, 
      studentId: user.studentId 
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  return {
    user: sanitiseUser(user),
    token: token
  };
}