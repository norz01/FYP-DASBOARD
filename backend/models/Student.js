import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
  ID_Pelajar: String,
  Nama: String,
  Kursus: String,
  Semester: Number,
  Kehadiran_Pct: String,
  CGPA: String,
  Sijil_Profesional: String,
  PLO_1: String,
  PLO_2: String,
  PLO_3: String,
  PLO_4: String,
  PLO_5: String,
  PLO_6: String,
  PLO_7: String,
  PLO_8: String,
  PLO_9: String,
  Status_Pelajar: String,
  No_KP: { type: String, default: '' },
  No_Telefon: { type: String, default: '' },
  Alamat: { type: String, default: '' },
  academicHistory: [
    {
      semester: Number,
      gpa: String,
      cgpa: String,
      attendance: String,
    },
  ],
  uploadedCertificates: [
    {
      name: String,
      issuer: String,
      fileName: String,
      filePath: String,
      uploadDate: { type: Date, default: Date.now },
    },
  ],
  // TAMBAHAN BAHARU:
  profileImage: String,
});

export default mongoose.model("Student", studentSchema);
