import jwt from "jsonwebtoken";

const isStaffRole = (role) => role === "admin" || role === "counselor";

export const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Akses ditolak. Tiada token." });
    }

    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET || "super_secret_fyp_key_2026";

    const decoded = jwt.verify(token, secret);
    req.user = decoded;

    next();
  } catch (error) {
    console.error("🔴 JWT VERIFY ERROR:", error.message);
    return res.status(401).json({ message: "Token tidak sah atau ralat JWT." });
  }
};

export const requireAdmin = (req, res, next) => {
  try {
    if (req.user && req.user.role === "admin") return next();

    return res.status(403).json({ message: "Akses ditolak. Admin sahaja." });
  } catch (error) {
    console.error("🔴 ADMIN CHECK CRASH:", error.message);
    return res.status(500).json({ message: "Ralat memeriksa role." });
  }
};

export const requireStaff = (req, res, next) => {
  try {
    if (req.user && isStaffRole(req.user.role)) return next();

    return res.status(403).json({ message: "Akses ditolak. Staff sahaja." });
  } catch (error) {
    console.error("🔴 STAFF CHECK CRASH:", error.message);
    return res.status(500).json({ message: "Ralat memeriksa role staff." });
  }
};

export const requireOwnershipOrAdmin = (req, res, next) => {
  try {
    const isStaff = req.user && isStaffRole(req.user.role);
    const isOwner = req.user && req.user.studentId === req.params.studentId;

    if (isStaff || isOwner) return next();

    return res.status(403).json({ message: "Akses ditolak." });
  } catch (error) {
    console.error("🔴 OWNERSHIP CHECK CRASH:", error.message);
    return res.status(500).json({ message: "Ralat memeriksa hak milik." });
  }
};