import jwt from "jsonwebtoken";
import User from "../models/User.js";

const isStaffRole = (role) => role === "admin" || role === "counselor";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("🔴 FATAL: JWT_SECRET is not set.");
    throw new Error("JWT_SECRET is required");
  }
  return secret;
};

const JWT_VERIFY_OPTIONS = {
  algorithms: ["HS256"],
  issuer: process.env.JWT_ISSUER || "tvetmara-backend",
  audience: process.env.JWT_AUDIENCE || "tvetmara-dashboard",
};

// Routes a flagged (must-change) account may still call
const PASSWORD_CHANGE_WHITELIST = [
  "/api/auth/login",
  "/api/auth/change-password",
];

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Akses ditolak. Tiada token." });
    }

    const token = authHeader.split(" ")[1];
    const secret = getJwtSecret();

    // F-1/F-3: Strict verification with pinned algorithm and bound claims
    const decoded = jwt.verify(token, secret, JWT_VERIFY_OPTIONS);

    // 🛑 A password-reset token must NEVER authenticate API calls
    if (decoded.scope === "password-reset") {
      return res.status(401).json({ message: "Token tidak sah atau telah luput." });
    }

    // 🔐 Authoritative DB check (flag may have changed after token issuance)
    const account = await User.findOne({ email: decoded.email }).select(
      "mustChangePassword passwordChangedAt"
    );
    if (!account) {
      return res.status(401).json({ message: "Token tidak sah atau telah luput." });
    }

    // Sessions issued BEFORE the last password change are dead
    const changedAt = account.passwordChangedAt
      ? Math.floor(new Date(account.passwordChangedAt).getTime() / 1000)
      : 0;
    if (changedAt && (decoded.pwdAt || 0) < changedAt) {
      return res.status(401).json({ message: "Sesi tamat. Sila log masuk semula." });
    }

    // Flagged accounts may only reach the whitelist until they change password
    if (
      account.mustChangePassword &&
      !PASSWORD_CHANGE_WHITELIST.some((p) => req.originalUrl.startsWith(p))
    ) {
      return res.status(403).json({
        code: "PASSWORD_CHANGE_REQUIRED",
        message: "Anda wajib menukar kata laluan sebelum meneruskan.",
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    // F-3: Generic error message to prevent leaking JWT internals
    return res.status(401).json({ message: "Token tidak sah atau telah luput." });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") return next();
  return res.status(403).json({ message: "Akses ditolak. Admin sahaja." });
};

export const requireStaff = (req, res, next) => {
  if (req.user && isStaffRole(req.user.role)) return next();
  return res.status(403).json({ message: "Akses ditolak. Staff sahaja." });
};

export const requireOwnershipOrAdmin = (req, res, next) => {
  const isStaff = req.user && isStaffRole(req.user.role);
  const isOwner = req.user && req.user.studentId === req.params.studentId;

  if (isStaff || isOwner) return next();
  return res.status(403).json({ message: "Akses ditolak." });
};