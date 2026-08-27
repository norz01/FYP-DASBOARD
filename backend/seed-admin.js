import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/tvetmara_db";

const seedAdminOnly = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Berjaya bersambung ke MongoDB.");
    
    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash("password123", salt);

    console.log("👑 Menambah akaun admin & user demo...");
    await User.findOneAndUpdate({ email: "admin@ikmb.edu.my" }, { $set: { password: defaultPassword, role: "admin", displayName: "Admin IKMB", studentId: null } }, { upsert: true, new: true });
    await User.findOneAndUpdate({ email: "user@ikmb.edu.my" }, { $set: { password: defaultPassword, role: "user", displayName: "User IKMB", studentId: null } }, { upsert: true, new: true });

    console.log("✨ SELESAI! Akaun admin sahaja dijana.");
    process.exit();
  } catch (error) {
    console.error("❌ Ralat:", error);
    process.exit(1);
  }
};
seedAdminOnly();
