import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from './models/User.js';
import Student from "./models/Student.js";   // for identity verification

const JWT_SIGN_OPTIONS = {
  expiresIn: '8h',
  algorithm: 'HS256',
  issuer: process.env.JWT_ISSUER || "tvetmara-backend",
  audience: process.env.JWT_AUDIENCE || "tvetmara-dashboard",
};

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000; // 15 minit

function sanitiseUser(user) {
  return {
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    studentId: user.studentId ?? null,
  };
}

// Token carries two extra claims:
//  mcp   -> must-change-password flag (Edge redirect UX)
//  pwdAt -> epoch of passwordChangedAt (sessions die on password change)
export function signTokenForUser(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return jwt.sign(
    {
      email: user.email,
      role: user.role,
      studentId: user.studentId ?? null,
      mcp: !!user.mustChangePassword,
      pwdAt: user.passwordChangedAt
        ? Math.floor(new Date(user.passwordChangedAt).getTime() / 1000)
        : 0,
    },
    secret,
    JWT_SIGN_OPTIONS
  );
}

export function validatePasswordPolicy(pw) {
  if (typeof pw !== 'string' || pw.length < 8) {
    return 'Kata laluan mesti sekurang-kurangnya 8 aksara.';
  }
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    return 'Kata laluan mesti mengandungi huruf dan nombor.';
  }
  return null;
}

async function readLoginDatabase() {
  const records = await User.find({});
  return records.map((record) => ({
    email: String(record.email).toLowerCase(),
    password: String(record.password),
    role: record.role,
    displayName: record.displayName,
    studentId: record.studentId ?? null,
  }));
}

export async function getAllLoginUsers() {
  return await readLoginDatabase();
}

export async function getPublicLoginUsers() {
  const users = await getAllLoginUsers();
  return users.map(sanitiseUser);
}

export async function authenticateUser(email, password) {
  // F-3: Validate credential types to prevent crashes/500s on weird JSON types
  if (typeof email !== 'string' || typeof password !== 'string') {
    return null;
  }

  const normalisedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalisedEmail });
  if (!user) return null;

  // ── Account lockout ──
  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    const mins = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
    throw Object.assign(
      new Error(`Akaun dikunci sementara. Cuba lagi dalam ${mins} minit.`),
      { status: 423 }
    );
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const attempts = (user.loginAttempts || 0) + 1;
    const update = { loginAttempts: attempts };
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      update.lockUntil = new Date(Date.now() + LOCK_WINDOW_MS);
    }
    await User.updateOne({ _id: user._id }, { $set: update });
    return null;
  }

  const previousLogin = user.lastLoginAt || null;
  await User.updateOne(
    { _id: user._id },
    { $set: { loginAttempts: 0, lockUntil: null, lastLoginAt: new Date() } }
  );

  return {
    user: sanitiseUser(user),
    token: signTokenForUser(user),
    mustChangePassword: !!user.mustChangePassword,
    lastLoginAt: previousLogin,
  };
}

// ── Forced / voluntary password change by the account owner ──
export async function changeOwnPassword(email, currentPassword, newPassword) {
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    throw Object.assign(new Error('Input tidak sah.'), { status: 400 });
  }
  const user = await User.findOne({ email });
  if (!user) throw Object.assign(new Error('Pengguna tidak dijumpai.'), { status: 404 });

  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    throw Object.assign(new Error('Akaun dikunci sementara. Sila cuba nanti.'), { status: 423 });
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    throw Object.assign(new Error('Kata laluan semasa tidak sah.'), { status: 401 });
  }

  const policyError = validatePasswordPolicy(newPassword);
  if (policyError) throw Object.assign(new Error(policyError), { status: 400 });

  if (await bcrypt.compare(newPassword, user.password)) {
    throw Object.assign(
      new Error('Kata laluan baharu tidak boleh sama dengan kata laluan semasa.'),
      { status: 400 }
    );
  }

  user.password = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date(); // kills every older session (pwdAt claim)
  user.loginAttempts = 0;
  user.lockUntil = null;
  await user.save();

  return { user: sanitiseUser(user), token: signTokenForUser(user), mustChangePassword: false };
}

// ── Admin-issued one-time temporary password (no SMTP in this system) ──
export async function adminResetPassword(targetEmail) {
  if (typeof targetEmail !== 'string' || !targetEmail.trim()) {
    throw Object.assign(new Error('Email diperlukan.'), { status: 400 });
  }
  const user = await User.findOne({ email: targetEmail.trim().toLowerCase() });
  if (!user) throw Object.assign(new Error('Pengguna tidak dijumpai.'), { status: 404 });

  const tempPassword = crypto.randomBytes(9).toString('base64url'); // 12 aksara
  user.password = await bcrypt.hash(tempPassword, 10);
  user.mustChangePassword = true;
  user.passwordChangedAt = new Date(); // invalidate existing sessions
  user.loginAttempts = 0;
  user.lockUntil = null;
  await user.save();

  return { user: sanitiseUser(user), tempPassword };
}

// ==========================================
// SELF-SERVICE PASSWORD RECOVERY (no SMTP exists in this system)
// Channel = verified browser session; token is scoped, 15-min, single-use.
// ==========================================
const RESET_AUDIENCE = "tvetmara-password-reset"; // distinct audience => can NEVER authenticate API calls
const RESET_TOKEN_TTL = "15m";

function normaliseKP(value) {
  return String(value || "").replace(/\D/g, "");
}

// Step 1: verify the student against their academic record (ID + No. KP)
export async function verifyStudentIdentity(idPelajar, noKP) {
  if (typeof idPelajar !== "string" || typeof noKP !== "string") return null;
  const id = idPelajar.trim();
  const kp = normaliseKP(noKP);
  if (!id || kp.length < 6) return null;

  const snapshot = await Student.findOne({ ID_Pelajar: id, No_KP: { $ne: "" } })
    .select("ID_Pelajar No_KP");
  if (!snapshot) return null;
  if (normaliseKP(snapshot.No_KP) !== kp) return null;

  const user = await User.findOne({ email: `${id}@student.ikmb.edu.my` });
  if (!user) return null;
  return user;
}

// Issue a scoped, single-use reset token (single-use via pwdAt binding)
export function createPasswordResetToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return jwt.sign(
    {
      sub: user.email,
      scope: "password-reset",
      pwdAt: user.passwordChangedAt
        ? Math.floor(new Date(user.passwordChangedAt).getTime() / 1000)
        : 0,
    },
    secret,
    {
      expiresIn: RESET_TOKEN_TTL,
      algorithm: "HS256",
      issuer: process.env.JWT_ISSUER || "tvetmara-backend",
      audience: RESET_AUDIENCE,
    }
  );
}

// Step 2: consume the token and set the new password
export async function resetPasswordWithToken(token, newPassword) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw Object.assign(new Error("JWT_SECRET is not configured"), { status: 500 });
  if (typeof token !== "string" || !token.trim()) {
    throw Object.assign(new Error("Token reset diperlukan."), { status: 400 });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: process.env.JWT_ISSUER || "tvetmara-backend",
      audience: RESET_AUDIENCE,
    });
  } catch {
    throw Object.assign(new Error("Token reset tidak sah atau telah luput."), { status: 400 });
  }
  if (decoded.scope !== "password-reset") {
    throw Object.assign(new Error("Token reset tidak sah."), { status: 400 });
  }

  const user = await User.findOne({ email: decoded.sub });
  if (!user) throw Object.assign(new Error("Pengguna tidak dijumpai."), { status: 404 });

  // Single-use: once passwordChangedAt moves, the token dies
  const changedAt = user.passwordChangedAt
    ? Math.floor(new Date(user.passwordChangedAt).getTime() / 1000)
    : 0;
  if ((decoded.pwdAt || 0) !== changedAt) {
    throw Object.assign(new Error("Token ini telah digunakan. Sila mula semula."), { status: 400 });
  }

  const policyError = validatePasswordPolicy(newPassword);
  if (policyError) throw Object.assign(new Error(policyError), { status: 400 });
  if (await bcrypt.compare(newPassword, user.password)) {
    throw Object.assign(new Error("Kata laluan baharu tidak boleh sama dengan kata laluan semasa."), { status: 400 });
  }

  user.password = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;      // they chose it themselves
  user.passwordChangedAt = new Date();  // kills old sessions AND this token
  user.loginAttempts = 0;               // also recovers locked accounts
  user.lockUntil = null;
  await user.save();

  return sanitiseUser(user);
}