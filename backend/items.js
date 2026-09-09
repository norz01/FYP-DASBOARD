import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import Student from "./models/Student.js";
import User from "./models/User.js";
import {
  getAllStudents,
  getStudentById,
  getStudentSkillGapById,
  createStudent,
  updateStudent,
  deleteStudent,
  getRealAIPrediction,
} from "./item.model.js";
import { verifyToken, requireAdmin, requireOwnershipOrAdmin } from "./middleware/authMiddleware.js";

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "certificates");
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
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Error: Hanya fail PDF, JPG, dan PNG sahaja dibenarkan!"));
    }
  },
});

const mdbUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith(".mdb")) {
      return cb(null, true);
    }
    cb(new Error("Error: Hanya fail .mdb sahaja dibenarkan!"));
  },
});

// ==========================================
// STUDENT ROUTES (SECURED & REFACTORED)
// ==========================================

// Dapatkan semua pelajar (Data Exposure Fix)
router.get("/students", verifyToken, async (req, res) => {
  try {
    // If the user is a student, only return their own data from the DB
    if (req.user.role === "user" && req.user.studentId) {
      const student = await getStudentById(req.user.studentId);
      if (!student) return res.json([]); 
      return res.json([student]); // Wrap in array to match frontend expectations
    }

    // Admin gets all students
    const students = await getAllStudents();
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Tambah pelajar baharu
router.post("/students", verifyToken, requireAdmin, async (req, res) => {
  try {
    const student = await createStudent(req.body);
    res.status(201).json(student);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Kemaskini pelajar
router.put("/students/:studentId", verifyToken, requireAdmin, async (req, res) => {
  try {
    const updated = await updateStudent(req.params.studentId, req.body);
    if (!updated) return res.status(404).json({ message: "Student not found" });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Padam pelajar
router.delete("/students/:studentId", verifyToken, requireAdmin, async (req, res) => {
  try {
    const deleted = await deleteStudent(req.params.studentId);
    if (!deleted) return res.status(404).json({ message: "Student not found" });
    res.json({ message: "Student deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Dapatkan pelajar mengikut ID (Secured with Ownership Check)
router.get("/students/:studentId", verifyToken, requireOwnershipOrAdmin, async (req, res) => {
  try {
    const student = await getStudentById(req.params.studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });
    return res.json(student);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// Dapatkan analisis jurang skill (Secured with Ownership Check)
router.get("/students/:studentId/skill-gap", verifyToken, requireOwnershipOrAdmin, async (req, res) => {
  try {
    const skillGap = await getStudentSkillGapById(req.params.studentId);
    if (!skillGap)
      return res
        .status(404)
        .json({ message: "Student skill gap data not found" });
    return res.json(skillGap);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// Muat naik sijil pelajar (Secured: Middleware runs BEFORE multer to prevent disk writes)
router.post(
  "/students/:studentId/certificates",
  verifyToken,
  requireOwnershipOrAdmin,
  upload.single("file"),
  async (req, res) => {
    try {
      const { studentId } = req.params;
      const { name, issuer } = req.body;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const newCert = {
        name,
        issuer,
        fileName: req.file.originalname,
        filePath: `/uploads/certificates/${req.file.filename}`,
      };

      const updatedStudent = await Student.findOneAndUpdate(
        { ID_Pelajar: studentId },
        { $push: { uploadedCertificates: newCert } },
        { new: true },
      );

      if (!updatedStudent) {
        return res.status(404).json({ message: "Student not found" });
      }

      res
        .status(201)
        .json({
          message: "Certificate uploaded successfully",
          certificate: newCert,
        });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
);

// Padam sijil pelajar
router.delete(
  "/students/:studentId/certificates/:certId",
  verifyToken,
  requireOwnershipOrAdmin,
  async (req, res) => {
    try {
      const { studentId, certId } = req.params;

      const student = await Student.findOne({ ID_Pelajar: studentId });
      if (!student)
        return res.status(404).json({ message: "Student not found" });

      const cert = student.uploadedCertificates.id(certId);
      if (!cert)
        return res.status(404).json({ message: "Certificate not found" });

      const filePath = path.join(process.cwd(), cert.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      cert.deleteOne();
      await student.save();

      res.json({ message: "Certificate deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
);

// Muat naik gambar profil pelajar (Secured: Middleware runs BEFORE multer)
router.post(
  "/students/:studentId/profile-image", 
  verifyToken, 
  requireOwnershipOrAdmin, 
  upload.single('file'), 
  async (req, res) => {
    try {
      const { studentId } = req.params;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const imagePath = `/uploads/certificates/${req.file.filename}`;

      const updatedStudent = await Student.findOneAndUpdate(
        { ID_Pelajar: studentId },
        { profileImage: imagePath },
        { new: true }
      );

      if (!updatedStudent) {
        return res.status(404).json({ message: "Student not found" });
      }

      res.status(200).json({ message: "Profile image updated successfully", imagePath: imagePath });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Ramalan AI Manual
router.post("/predict/manual", verifyToken, requireAdmin, async (req, res) => {
  try {
    const features = req.body;
    const prediction = await getRealAIPrediction(features);
    res.json({ success: true, prediction });
  } catch (error) {
    res.status(500).json({ success: false, message: "Prediction failed" });
  }
});

// ==========================================
// NEW ENDPOINT: Upload & Process MDB File
// ==========================================
router.post("/data/upload-mdb", verifyToken, requireAdmin, mdbUpload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Tiada fail dimuat naik" });

  try {
    // 1. Hantar fail ke ML Service (Python FastAPI)
    const mlApiUrl = process.env.ML_API_URL || 'http://127.0.0.1:8000';
    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: 'application/octet-stream' });
    formData.append('file', blob, req.file.originalname);

    const mlResponse = await fetch(`${mlApiUrl}/etl/process-mdb`, {
      method: 'POST',
      body: formData
    });

    if (!mlResponse.ok) {
      const errData = await mlResponse.json();
      return res.status(500).json({ message: "ML Service gagal memproses MDB", error: errData.detail });
    }

    const { data: students } = await mlResponse.json();

    // 🤖 NEW: AI batch prediction
    if (students.length > 0) {
      try {
        const batchPayload = students.map((s) => ({
          CGPA: parseFloat(s.CGPA) || 0,
          Attendance: parseFloat(s.Kehadiran_Pct) || 0,
          PLO_1: parseFloat(s.PLO_1) || 0, PLO_2: parseFloat(s.PLO_2) || 0, PLO_3: parseFloat(s.PLO_3) || 0,
          PLO_4: parseFloat(s.PLO_4) || 0, PLO_5: parseFloat(s.PLO_5) || 0, PLO_6: parseFloat(s.PLO_6) || 0,
          PLO_7: parseFloat(s.PLO_7) || 0, PLO_8: parseFloat(s.PLO_8) || 0, PLO_9: parseFloat(s.PLO_9) || 0,
          Sijil: s.Sijil_Profesional || "Tiada",
        }));

        const batchResponse = await fetch(`${mlApiUrl}/predict/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ students: batchPayload }),
        });

        if (batchResponse.ok) {
          const batchData = await batchResponse.json();
          if (Array.isArray(batchData.predictions) && batchData.predictions.length === students.length) {
            students.forEach((s, i) => {
              s.Status_Pelajar = batchData.predictions[i];
            });
            console.log(`🤖 AI batch prediction saved for ${students.length} students.`);
          }
        } else {
          console.warn("⚠️ AI batch prediction failed — keeping ETL status.");
        }
      } catch (aiError) {
        console.warn("⚠️ AI service unreachable:", aiError.message);
      }
    }

    // Sync Data
    if (students.length > 0) {
      const newStudentIds = students.map(s => s.ID_Pelajar);
      const deleteResult = await Student.deleteMany({
        ID_Pelajar: { $nin: newStudentIds }
      });
      console.log(`🧹 Sync: ${deleteResult.deletedCount} pelajar lama telah dipadam.`);
    }

    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash("password123", salt);

    const studentOps = [];
    const userOps = [];

    for (let data of students) {
      studentOps.push({
        updateOne: {
          filter: { ID_Pelajar: data.ID_Pelajar },
          update: {
            $set: {
              Nama: data.Nama, Kursus: data.Kursus, Semester: data.Semester,
              CGPA: data.CGPA, Kehadiran_Pct: data.Kehadiran_Pct, Anugerah: data.Anugerah,
              Koko_Lulus: data.Koko_Lulus, Status_Pelajar: data.Status_Pelajar,
              Sijil_Profesional: data.Sijil_Profesional, No_KP: data.No_KP || '',
              No_Telefon: data.No_Telefon || '', Alamat: data.Alamat || '',
              PLO_1: data.PLO_1, PLO_2: data.PLO_2, PLO_3: data.PLO_3,
              PLO_4: data.PLO_4, PLO_5: data.PLO_5, PLO_6: data.PLO_6,
              PLO_7: data.PLO_7, PLO_8: data.PLO_8, PLO_9: data.PLO_9,
              academicHistory: data.academicHistory || [],
            }
          },
          upsert: true
        }
      });

      userOps.push({
        updateOne: {
          filter: { email: `${data.ID_Pelajar}@student.ikmb.edu.my` },
          update: {
            $set: {
              password: defaultPassword, role: "user",
              displayName: data.Nama, studentId: data.ID_Pelajar,
            }
          },
          upsert: true
        }
      });
    }

    if (studentOps.length > 0) await Student.bulkWrite(studentOps);
    if (userOps.length > 0) await User.bulkWrite(userOps);

    res.status(200).json({ message: `Berjaya! ${students.length} rekod pelajar telah dikemas kini.` });
  } catch (error) {
    console.error("MDB Upload Error:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;