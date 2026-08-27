import { Router } from 'express';
import { authenticateUser, getPublicLoginUsers } from './auth.model.js';
import { verifyToken } from './middleware/authMiddleware.js';

const router = Router();

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: Get all users
 *     description: Retrieves a sanitized list of all users (without passwords).
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: A list of users.
 */
router.get('/users', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak. Admin sahaja.' });
  }
  try {
    const users = await getPublicLoginUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User Login
 *     description: Authenticate user and return JWT token.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: admin@ikmb.edu.my
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token.
 *       401:
 *         description: Invalid credentials.
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email dan kata laluan diperlukan.' });
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
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

export default router;