import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from './models/User.js';
import { getAllStudents } from './item.model.js';

// Replaced fs.readFile with MongoDB query
async function readLoginDatabase() {
  const records = await User.find({});
  return records.map((record) => ({
    email: String(record.email).toLowerCase(),
    password: String(record.password),
    role: record.role,
    displayName: record.displayName,
    studentId: record.studentId ?? null,
    source: 'mongodb-login',
  }));
}

function buildStudentLoginAccounts(students) {
  return students.map((student) => ({
    email: `${student.id.toLowerCase()}@student.ikmb.edu.my`,
    password: 'password123',
    role: 'user',
    displayName: `Pelajar ${student.id}`,
    studentId: student.id,
    source: 'dummy-student-db',
  }));
}

function sanitiseUser(user) {
  return {
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    studentId: user.studentId,
    source: user.source,
  };
}

export async function getAllLoginUsers() {
  const [defaultUsers, students] = await Promise.all([
    readLoginDatabase(),
    getAllStudents(),
  ]);

  const mergedByEmail = new Map();

  for (const user of buildStudentLoginAccounts(students)) {
    mergedByEmail.set(user.email, user);
  }

  for (const user of defaultUsers) {
    mergedByEmail.set(user.email, user);
  }

  return Array.from(mergedByEmail.values());
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

  let isMatch = false;
  if (user.source === 'dummy-student-db') {
    isMatch = (password === 'password123'); 
  } else {
    isMatch = await bcrypt.compare(password, user.password);
  }

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