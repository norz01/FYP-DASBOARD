import mongoose from 'mongoose';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Guna Default Imports (tanpa kurungan dakap)
import Student from './models/Student.js'; 
import User from './models/User.js'; 

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/tvetmara_db';

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Berjaya bersambung ke MongoDB.");

    const rawData = fs.readFileSync('./db/data_tvet_muktamad.json', 'utf-8');
    const students = JSON.parse(rawData);

    console.log(`🚀 Memulakan seeding untuk ${students.length} pelajar...`);

    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash('password123', salt);

    for (let data of students) {
      // Simpan Student
      await Student.create({
        ID_Pelajar: data.ID_Pelajar,
        Nama: data.Nama,
        Kursus: data.Kursus,
        Semester: data.Semester,
        CGPA: data.CGPA,
        Kehadiran_Pct: data.Kehadiran_Pct,
        Anugerah: data.Anugerah,
        Koko_Lulus: data.Koko_Lulus,
        Status_Pelajar: data.Status_Pelajar,
        Sijil_Profesional: data.Sijil_Profesional,
        PLO_1: data.PLO_1,
        PLO_2: data.PLO_2,
        PLO_3: data.PLO_3,
        PLO_4: data.PLO_4,
        PLO_5: data.PLO_5,
        PLO_6: data.PLO_6,
        PLO_7: data.PLO_7,
        PLO_8: data.PLO_8,
        PLO_9: data.PLO_9
      });

      // Simpan User (Login)
      await User.create({
        email: `${data.ID_Pelajar}@student.ikmb.edu.my`,
        password: defaultPassword,
        role: 'user',
        displayName: data.Nama,
        studentId: data.ID_Pelajar
      });
    }

    console.log("✨ SELESAI! Sila cuba login di Dashboard.");
    process.exit();
  } catch (error) {
    console.error("❌ Ralat:", error);
    process.exit(1);
  }
};

seedDatabase();