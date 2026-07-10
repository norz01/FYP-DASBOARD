import { Router } from 'express';
import {
  getAllStudents,
  getStudentById,
  getStudentSkillGapById,
  createStudent,
  updateStudent,
  deleteStudent,
  getRealAIPrediction
} from './item.model.js';
import { verifyToken } from './middleware/authMiddleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Students
 *   description: Student management and analytics API
 */

/**
 * @swagger
 * /api/students:
 *   get:
 *     summary: Get all students
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all students.
 *       403:
 *         description: No token provided.
 */
router.get('/students', verifyToken, async (_req, res) => {
  try {
    const students = await getAllStudents();
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/students:
 *   post:
 *     summary: Create a new student (Admin only)
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ID_Pelajar:
 *                 type: string
 *               Nama:
 *                 type: string
 *               Kursus:
 *                 type: string
 *     responses:
 *       201:
 *         description: Student created successfully.
 *       403:
 *         description: Unauthorized (Admin only).
 */
router.post('/students', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Unauthorized" });
  try {
    const student = await createStudent(req.body);
    res.status(201).json(student);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/students/{studentId}:
 *   put:
 *     summary: Update a student (Admin only)
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               CGPA:
 *                 type: string
 *               Kehadiran_Pct:
 *                 type: string
 *     responses:
 *       200:
 *         description: Student updated successfully.
 */
router.put('/students/:studentId', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Unauthorized" });
  try {
    const updated = await updateStudent(req.params.studentId, req.body);
    if (!updated) return res.status(404).json({ message: "Student not found" });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/students/{studentId}:
 *   delete:
 *     summary: Delete a student (Admin only)
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Student deleted successfully.
 */
router.delete('/students/:studentId', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Unauthorized" });
  try {
    const deleted = await deleteStudent(req.params.studentId);
    if (!deleted) return res.status(404).json({ message: "Student not found" });
    res.json({ message: "Student deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/students/{studentId}:
 *   get:
 *     summary: Get student by ID
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Student data.
 *       404:
 *         description: Student not found.
 */
router.get('/students/:studentId', verifyToken, async (req, res) => {
  try {
    const student = await getStudentById(req.params.studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    return res.json(student);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/students/{studentId}/skill-gap:
 *   get:
 *     summary: Get student skill gap analysis
 *     description: Retrieves PLO metrics and AI-generated insight for a specific student.
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Skill gap data and AI insight.
 */
router.get('/students/:studentId/skill-gap', verifyToken, async (req, res) => {
  try {
    const skillGap = await getStudentSkillGapById(req.params.studentId);
    if (!skillGap) return res.status(404).json({ message: 'Student skill gap data not found' });
    return res.json(skillGap);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/predict/manual:
 *   post:
 *     summary: Manual AI Prediction (Admin only)
 *     description: Manually predict student risk based on input features.
 *     tags: [AI Prediction]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cgpa:
 *                 type: number
 *                 example: 3.50
 *               attendance:
 *                 type: number
 *                 example: 85
 *               plo1:
 *                 type: number
 *                 example: 80
 *     responses:
 *       200:
 *         description: AI Prediction result.
 */
router.post('/predict/manual', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Unauthorized" });
  try {
    const features = req.body;
    const prediction = await getRealAIPrediction(features);
    res.json({ success: true, prediction });
  } catch (error) {
    res.status(500).json({ success: false, message: "Prediction failed" });
  }
});

export default router;