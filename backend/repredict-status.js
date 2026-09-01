import mongoose from "mongoose";
import Student from "./models/Student.js";

const ML_API_URL = process.env.ML_API_URL || "http://127.0.0.1:8000";
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ikmb-dashboard";

async function main() {
  await mongoose.connect(MONGO_URI);
  const students = await Student.find({});
  console.log(`📚 Loaded ${students.length} students from MongoDB`);

  const payload = students.map((s) => ({
    CGPA: parseFloat(s.CGPA) || 0,
    Attendance: parseFloat(s.Kehadiran_Pct) || 0,
    PLO_1: parseFloat(s.PLO_1) || 0, PLO_2: parseFloat(s.PLO_2) || 0,
    PLO_3: parseFloat(s.PLO_3) || 0, PLO_4: parseFloat(s.PLO_4) || 0,
    PLO_5: parseFloat(s.PLO_5) || 0, PLO_6: parseFloat(s.PLO_6) || 0,
    PLO_7: parseFloat(s.PLO_7) || 0, PLO_8: parseFloat(s.PLO_8) || 0,
    PLO_9: parseFloat(s.PLO_9) || 0,
    Sijil: s.Sijil_Profesional || "Tiada",
  }));

  const predictions = [];
  for (let i = 0; i < payload.length; i += 500) {
    const chunk = payload.slice(i, i + 500);
    const res = await fetch(`${ML_API_URL}/predict/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ students: chunk }),
    });
    if (!res.ok) throw new Error(`Batch prediction failed: ${res.status}`);
    const data = await res.json();
    predictions.push(...data.predictions);
  }

  const ops = students.map((s, i) => ({
    updateOne: {
      filter: { ID_Pelajar: s.ID_Pelajar },
      update: { $set: { Status_Pelajar: predictions[i] } },
    },
  }));
  await Student.bulkWrite(ops);

  const counts = {};
  predictions.forEach((p) => (counts[p] = (counts[p] || 0) + 1));
  console.log("✅ Status_Pelajar updated:", counts);

  await mongoose.disconnect();
}

main().catch((e) => { console.error("❌", e); process.exit(1); });