import { Router } from 'express';
import {
  getAllStudents,
  getStudentById,
  getStudentSkillGapById,
  createStudent,
  updateStudent,
  deleteStudent
} from './item.model.js';
import { verifyToken } from './middleware/authMiddleware.js';

const router = Router();

router.get('/students', verifyToken, async (_req, res) => {
  try {
    const students = await getAllStudents();
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. Create Student (Admin Only)
router.post('/students', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Unauthorized" });
  try {
    const student = await createStudent(req.body);
    res.status(201).json(student);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 3. Update Student (Admin Only)
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

// 4. Delete Student (Admin Only)
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

router.get('/students/:studentId', verifyToken, async (req, res) => {
  try {
    const student = await getStudentById(req.params.studentId);

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    return res.json(student);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/students/:studentId/skill-gap', verifyToken, async (req, res) => {
  try {
    const skillGap = await getStudentSkillGapById(req.params.studentId);

    if (!skillGap) {
      return res.status(404).json({ message: 'Student skill gap data not found' });
    }

    return res.json(skillGap);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

export default router;