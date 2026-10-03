import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import StudentReport from "./models/StudentReport.js";
import {
  verifyToken,
  requireStaff,
} from "./middleware/authMiddleware.js";

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "reports");

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extname = path.extname(file.originalname).toLowerCase() === ".pdf";
    const mimetype = file.mimetype === "application/pdf";

    if (mimetype && extname) {
      return cb(null, true);
    }

    cb(new Error("Hanya fail PDF sahaja dibenarkan untuk laporan pelajar!"));
  },
});

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("🔴 Gagal memadam fail sementara:", error.message);
  }
}

/**
 * POST /api/student-reports
 * Staff creates a report/letter for a student.
 */
router.post(
  "/",
  verifyToken,
  requireStaff,
  upload.single("file"),
  async (req, res) => {
    try {
      const {
        studentId,
        studentName,
        course,
        cgpa,
        attendance,
        riskLevel,
        semester,
        ploScores,
        employability,
        title,
        message,
      } = req.body;

      if (!studentId || !studentId.trim()) {
        safeUnlink(req.file?.path);
        return res.status(400).json({ message: "studentId diperlukan." });
      }

      if (!studentName || !studentName.trim()) {
        safeUnlink(req.file?.path);
        return res.status(400).json({ message: "studentName diperlukan." });
      }

      if (!title || !title.trim()) {
        safeUnlink(req.file?.path);
        return res.status(400).json({ message: "title diperlukan." });
      }

      let parsedPloScores = [];

      if (ploScores) {
        try {
          parsedPloScores = JSON.parse(ploScores);

          if (!Array.isArray(parsedPloScores)) {
            throw new Error("ploScores mesti array.");
          }

          parsedPloScores = parsedPloScores.map((item) => ({
            label: String(item.label || ""),
            value: Number(item.value) || 0,
          }));
        } catch (error) {
          safeUnlink(req.file?.path);
          return res.status(400).json({
            message: "ploScores tidak sah. Pastikan ia adalah JSON array.",
          });
        }
      }

      const safeEmployability = Math.max(
        0,
        Math.min(100, Number(employability) || 0)
      );

      let reportType = "message";

      if (req.file && message && message.trim()) {
        reportType = "full";
      } else if (req.file) {
        reportType = "letter";
      } else {
        reportType = "message";
      }

      const newStudentReport = new StudentReport({
        studentId: studentId.trim(),
        studentName: studentName.trim(),
        course: course || "",
        cgpa: cgpa || "",
        attendance: attendance || "",
        riskLevel: riskLevel || "",
        semester: semester || "",
        ploScores: parsedPloScores,
        employability: safeEmployability,
        authorEmail: req.user.email,
        authorRole: req.user.role,
        authorName: req.user.displayName || req.user.email,
        title: title.trim(),
        message: message || "",
        fileName: req.file ? req.file.originalname : null,
        filePath: req.file ? `/uploads/reports/${req.file.filename}` : null,
        reportType,
        readByStudent: false,
      });

      await newStudentReport.save();

      return res.status(201).json({
        message: "Laporan pelajar berjaya dihantar.",
        report: newStudentReport,
      });
    } catch (error) {
      safeUnlink(req.file?.path);
      console.error("🔴 CREATE STUDENT REPORT ERROR:", error);
      return res.status(500).json({ message: error.message });
    }
  }
);

/**
 * GET /api/student-reports
 *
 * Student:
 * - sees reports sent to them
 *
 * Counselor:
 * - sees reports authored by them
 *
 * Admin:
 * - sees all reports
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role === "user" && !req.user.studentId) {
      return res.json([]);
    }

    let filter = {};

    if (req.user.role === "user") {
      filter = { studentId: req.user.studentId };
    } else if (req.user.role === "counselor") {
      filter = { authorEmail: req.user.email };
    }

    const reports = await StudentReport.find(filter).sort({ createdAt: -1 });

    return res.json(reports);
  } catch (error) {
    console.error("🔴 GET STUDENT REPORTS ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/student-reports/:id
 *
 * Owner student can read.
 * Author can read.
 * Admin can read.
 *
 * If owner student reads it, set readByStudent = true.
 */
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const report = await StudentReport.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: "Laporan tidak dijumpai." });
    }

    const isAdmin = req.user.role === "admin";
    const isAuthor = req.user.email === report.authorEmail;
    const isOwnerStudent =
      req.user.studentId && req.user.studentId === report.studentId;

    if (!isAdmin && !isAuthor && !isOwnerStudent) {
      return res.status(403).json({
        message: "Akses ditolak. Anda tidak boleh melihat laporan ini.",
      });
    }

    if (isOwnerStudent && !report.readByStudent) {
      report.readByStudent = true;
      await report.save();
    }

    return res.json(report);
  } catch (error) {
    console.error("🔴 GET STUDENT REPORT BY ID ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
});

/**
 * DELETE /api/student-reports/:id
 *
 * Admin can delete any report.
 * Author can delete their own report.
 */
router.delete("/:id", verifyToken, requireStaff, async (req, res) => {
  try {
    const report = await StudentReport.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: "Laporan tidak dijumpai." });
    }

    const isAdmin = req.user.role === "admin";
    const isAuthor = req.user.email === report.authorEmail;

    if (!isAdmin && !isAuthor) {
      return res.status(403).json({
        message: "Akses ditolak. Hanya admin atau penulis boleh memadam laporan.",
      });
    }

    if (report.filePath) {
      const uploadsRoot = path.join(process.cwd(), "uploads");
      const resolvedFilePath = path.resolve(
        path.join(process.cwd(), report.filePath)
      );

      if (
        fs.existsSync(resolvedFilePath) &&
        resolvedFilePath.startsWith(uploadsRoot + path.sep)
      ) {
        fs.unlinkSync(resolvedFilePath);
      }
    }

    await report.deleteOne();

    return res.json({
      message: "Laporan pelajar berjaya dipadam.",
    });
  } catch (error) {
    console.error("🔴 DELETE STUDENT REPORT ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
});

// Multer and route error handler
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `Ralat Muat Naik: ${err.message}` });
  }

  if (err) {
    if (err.message && err.message.includes("Hanya fail PDF")) {
      return res.status(400).json({ message: err.message });
    }

    console.error("🔴 STUDENT REPORT ROUTE ERROR:", err);
    return res.status(500).json({ message: err.message || "Ralat pelayan tidak dijangka." });
  }

  next();
});

export default router;