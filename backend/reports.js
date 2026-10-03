import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import Report from "./models/Report.js";
import User from "./models/User.js";
import {
  verifyToken,
  requireAdmin,
  requireStaff,
} from "./middleware/authMiddleware.js";

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "referrals");

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
    const filetypes = /jpeg|jpg|png|pdf/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }

    cb(new Error("Hanya fail PDF, JPG, dan PNG sahaja dibenarkan!"));
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
 * POST /api/reports
 * Admin creates a counselor referral / intervention appointment.
 */
router.post(
  "/",
  verifyToken,
  requireStaff, // <-- TUKAR DI SINI
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
        interventionType,
        reason,
        priority,
        scheduledDate,
        counselorId,
      } = req.body;

      const missingFields = [];

      if (!studentId || !studentId.trim()) missingFields.push("studentId");
      if (!studentName || !studentName.trim()) missingFields.push("studentName");
      if (!interventionType || !interventionType.trim())
        missingFields.push("interventionType");
      if (!reason || !reason.trim()) missingFields.push("reason");
      if (!scheduledDate || !scheduledDate.trim())
        missingFields.push("scheduledDate");
      if (!counselorId || !counselorId.trim()) missingFields.push("counselorId");

      if (missingFields.length > 0) {
        safeUnlink(req.file?.path);
        return res.status(400).json({
          message: `Medan diperlukan: ${missingFields.join(", ")}`,
        });
      }

      const allowedInterventions = ["kaunseling", "klinik", "softskills"];

      if (!allowedInterventions.includes(interventionType)) {
        safeUnlink(req.file?.path);
        return res.status(400).json({
          message:
            "Jenis intervensi tidak sah. Gunakan kaunseling, klinik, atau softskills.",
        });
      }

      const parsedScheduledDate = new Date(scheduledDate);

      if (isNaN(parsedScheduledDate.getTime())) {
        safeUnlink(req.file?.path);
        return res.status(400).json({
          message: "Tarikh temujanji tidak sah.",
        });
      }

      const counselor = await User.findOne({
        email: counselorId.trim().toLowerCase(),
        role: "counselor",
      });

      if (!counselor) {
        safeUnlink(req.file?.path);
        return res.status(400).json({
          message: "Kaunselor tidak dijumpai untuk counselorId yang diberikan.",
        });
      }

      const safePriority = priority === "urgent" ? "urgent" : "normal";

      const newReport = new Report({
        studentId: studentId.trim(),
        studentName: studentName.trim(),
        course: course || "",
        cgpa: cgpa || "",
        attendance: attendance || "",
        riskLevel: riskLevel || "",
        interventionType,
        reason: reason.trim(),
        priority: safePriority,
        status: "scheduled",
        adminEmail: req.user.email,
        counselorId: counselor.email,
        scheduledDate: parsedScheduledDate,
        fileName: req.file ? req.file.originalname : null,
        filePath: req.file ? `/uploads/referrals/${req.file.filename}` : null,
      });

      await newReport.save();

      return res.status(201).json({
        message: "Rujukan kaunseling berjaya dihantar.",
        report: newReport,
      });
    } catch (error) {
      safeUnlink(req.file?.path);
      console.error("🔴 CREATE REPORT ERROR:", error);
      return res.status(500).json({ message: error.message });
    }
  }
);

/**
 * GET /api/reports
 * Admin sees all reports.
 * Counselor sees pending reports or reports assigned to them.
 */
router.get("/", verifyToken, requireStaff, async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "counselor") {
      filter = {
        $or: [
          { status: "pending" },
          { counselorId: req.user.email },
        ],
      };
    }

    const reports = await Report.find(filter).sort({ createdAt: -1 });

    return res.json(reports);
  } catch (error) {
    console.error("🔴 GET REPORTS ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/reports/mine
 * Student fetches their own upcoming reports/appointments.
 */
router.get("/mine", verifyToken, async (req, res) => {
  try {
    if (!req.user.studentId) {
      return res.json([]);
    }

    const reports = await Report.find({
      studentId: req.user.studentId,
      status: {
        $in: ["accepted", "scheduled"],
      },
    }).sort({ scheduledDate: 1 });

    return res.json(reports);
  } catch (error) {
    console.error("🔴 GET MY REPORTS ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/reports/:id
 * Staff fetch one report.
 */
router.get("/:id", verifyToken, requireStaff, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: "Rujukan tidak dijumpai." });
    }

    if (
      req.user.role === "counselor" &&
      report.status !== "pending" &&
      report.counselorId !== req.user.email
    ) {
      return res.status(403).json({
        message: "Akses ditolak. Rujukan ini bukan milik anda.",
      });
    }

    return res.json(report);
  } catch (error) {
    console.error("🔴 GET REPORT BY ID ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
});

/**
 * PATCH /api/reports/:id
 * Unified State Machine for ALL Staff (Admin + Counselor).
 */
router.patch("/:id", verifyToken, requireStaff, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: "Rujukan tidak dijumpai." });
    }

    const body = req.body || {};
    const target = String(body.action || body.status || "").toLowerCase();
    const hasNotesUpdate = body.counselorNotes !== undefined;

    // Unified State Machine for ALL Staff (Admin + Counselor)
    if (["accept", "accepted"].includes(target)) {
      report.status = "accepted";
      if (!report.counselorId) report.counselorId = req.user.email;
    } else if (["reject", "rejected"].includes(target)) {
      report.status = "rejected";
    } else if (["reset", "pending"].includes(target)) {
      report.status = "pending";
    } else if (["complete", "completed"].includes(target)) {
      report.status = "completed";
    } else if (["schedule", "scheduled"].includes(target)) {
      const parsedScheduledDate = new Date(body.scheduledDate);
      if (!body.scheduledDate || isNaN(parsedScheduledDate.getTime())) {
        return res.status(400).json({ message: "Tarikh temujanji tidak sah." });
      }
      report.status = "scheduled";
      report.scheduledDate = parsedScheduledDate;
      if (!report.counselorId) report.counselorId = req.user.email;
    } else if (hasNotesUpdate && !target) {
      // Hanya mengemaskini nota, status kekal sama
    } else {
      return res.status(400).json({
        message: "Tindakan tidak sah. Gunakan accept, reject, schedule, complete, atau reset.",
      });
    }

    if (hasNotesUpdate) {
      report.counselorNotes = body.counselorNotes;
    }

    await report.save();
    return res.json(report);
  } catch (error) {
    console.error("🔴 PATCH REPORT ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
});

// Multer and route error handler
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `Ralat Muat Naik: ${err.message}` });
  }

  if (err) {
    if (
      err.message &&
      (err.message.includes("Hanya fail") ||
        err.message.includes("PDF") ||
        err.message.includes("PNG") ||
        err.message.includes("JPG"))
    ) {
      return res.status(400).json({ message: err.message });
    }

    console.error("🔴 REPORT ROUTE ERROR:", err);
    return res.status(500).json({ message: err.message || "Ralat pelayan tidak dijangka." });
  }

  next();
});

export default router;