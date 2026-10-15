import { Router } from 'express';
import rateLimit from "express-rate-limit";
import {
  authenticateUser,
  getPublicLoginUsers,
  changeOwnPassword,
  adminResetPassword,
  verifyStudentIdentity,
  createPasswordResetToken,
  resetPasswordWithToken,
} from './auth.model.js';
import { verifyToken, requireStaff, requireAdmin } from './middleware/authMiddleware.js';

const router = Router();

router.get('/users', verifyToken, requireStaff, async (req, res) => {
  try {
    const users = await getPublicLoginUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Gagal memuatkan senarai pengguna.' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  // F-3: Strict type validation
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Email dan kata laluan yang sah diperlukan.' });
  }

  try {
    const result = await authenticateUser(email, password);

    if (!result) {
      return res.status(401).json({ message: 'Email atau kata laluan tidak sah.' });
    }

    return res.json({
      message: 'Login berjaya.',
      user: result.user,
      token: result.token,
      mustChangePassword: !!result.mustChangePassword,
      lastLoginAt: result.lastLoginAt || null,
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error("Login error:", error);
    return res.status(status).json({
      message: error.message || 'Ralat pelayan semasa log masuk.',
    });
  }
});

// 🔐 Forced / voluntary password change (whitelisted for flagged accounts)
router.post('/change-password', verifyToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  try {
    const result = await changeOwnPassword(req.user.email, currentPassword, newPassword);
    return res.json({
      message: 'Kata laluan berjaya dikemas kini.',
      user: result.user,
      token: result.token,
      mustChangePassword: false,
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error("Change password error:", error);
    return res.status(status).json({
      message: error.message || 'Ralat pelayan semasa menukar kata laluan.',
    });
  }
});

// 🔑 Admin-only: one-time temporary password (no SMTP exists in this system)
router.post('/reset-password', verifyToken, requireAdmin, async (req, res) => {
  const { email } = req.body ?? {};
  try {
    const result = await adminResetPassword(email);
    return res.json({
      message: 'Kata laluan sementara dijana. Paparkan SEKALI sahaja kepada pengguna.',
      user: result.user,
      tempPassword: result.tempPassword,
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error("Reset password error:", error);
    return res.status(status).json({
      message: error.message || 'Ralat pelayan semasa menetap kata laluan.',
    });
  }
});

// Anti-brute-force / anti-enumeration for the recovery flow
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    String(req.body?.resetToken || req.body?.idPelajar || "unknown").slice(-16),
  message: { message: "Terlalu banyak percubaan. Sila cuba lagi selepas 15 minit." },
});

// 🔑 Step 1: identity check (ID + No. KP) -> scoped reset token
router.post("/forgot-password", forgotLimiter, async (req, res) => {
  const { idPelajar, noKP } = req.body ?? {};
  try {
    const user = await verifyStudentIdentity(idPelajar, noKP);
    if (!user) {
      // Generic wording slows account enumeration
      return res.status(404).json({ message: "Maklumat tidak sepadan dengan rekod kami." });
    }
    return res.json({
      message: "Identiti disahkan. Sila cipta kata laluan baharu.",
      resetToken: createPasswordResetToken(user),
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error("Forgot password error:", error);
    return res.status(status).json({ message: error.message || "Ralat pelayan." });
  }
});

// 🔑 Step 2: consume token -> set new password
router.post("/complete-password-reset", forgotLimiter, async (req, res) => {
  const { resetToken, newPassword } = req.body ?? {};
  try {
    const user = await resetPasswordWithToken(resetToken, newPassword);
    return res.json({ message: "Kata laluan berjaya ditukar. Sila log masuk.", user });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error("Complete reset error:", error);
    return res.status(status).json({ message: error.message || "Ralat pelayan." });
  }
});

export default router;