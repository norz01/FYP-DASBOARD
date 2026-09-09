import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(403).json({ error: 'A token is required for authentication' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired Token' });
  }
  
  return next();
};

// NEW: Middleware to restrict access to Admins only
export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak. Admin sahaja.' });
  }
  next();
};

// NEW: Middleware to ensure the user owns the student record (or is an admin)
export const requireOwnershipOrAdmin = (req, res, next) => {
  const { studentId } = req.params;
  if (req.user.role !== 'admin' && req.user.studentId !== studentId) {
    return res.status(403).json({ message: 'Akses ditolak. Anda tidak mempunyai kebenaran untuk melihat data pelajar ini.' });
  }
  next();
};