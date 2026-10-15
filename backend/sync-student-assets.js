import mongoose from "mongoose";
import dotenv from "dotenv";
import Student from "./models/Student.js";

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ikmb-dashboard";

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("🔍 Mengimbas snapshot pelajar...");

  const rows = await Student.find(
    {},
    { ID_Pelajar: 1, profileImage: 1, uploadedCertificates: 1 }
  ).sort({ _id: 1 });

  const best = new Map();
  for (const r of rows) {
    const cur = best.get(r.ID_Pelajar) || { profileImage: null, uploadedCertificates: [] };
    if (!cur.profileImage && r.profileImage) cur.profileImage = r.profileImage;
    if (
      (!cur.uploadedCertificates || cur.uploadedCertificates.length === 0) &&
      Array.isArray(r.uploadedCertificates) && r.uploadedCertificates.length > 0
    ) {
      cur.uploadedCertificates = r.uploadedCertificates;
    }
    best.set(r.ID_Pelajar, cur);
  }

  const ops = [];
  for (const [id, b] of best.entries()) {
    ops.push({
      updateMany: {
        filter: { ID_Pelajar: id },
        update: {
          $set: {
            profileImage: b.profileImage || null,
            uploadedCertificates: b.uploadedCertificates || [],
          },
        },
      },
    });
  }

  for (let i = 0; i < ops.length; i += 1000) {
    await Student.bulkWrite(ops.slice(i, i + 1000));
  }

  console.log(`✅ Aset pelajar diselaraskan merentas semua semester untuk ${ops.length} pelajar.`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
