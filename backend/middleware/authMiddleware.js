import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log("🔵 VERIFY TOKEN: Auth header received:", authHeader ? "Yes" : "No");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Akses ditolak. Tiada token." });
    }

    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET || "super_secret_fyp_key_2026"; // Fallback secret
    
    console.log("🔵 VERIFY TOKEN: Secret loaded?", secret ? "Yes" : "NO - SECRET IS MISSING!");

    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (error) {
    // This catches the crash and returns a clean JSON error instead of crashing the server
    console.error("🔴 JWT VERIFY CRASH:", error.message);
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

export const requireOwnershipOrAdmin = (req, res, next) => {
  try {
    if (req.user.role === "admin" || req.user.studentId === req.params.studentId) return next();
    return res.status(403).json({ message: "Akses ditolak." });
  } catch (error) {
    console.error("🔴 OWNERSHIP CHECK CRASH:", error.message);
    return res.status(500).json({ message: "Ralat memeriksa hak milik." });
  }
};
