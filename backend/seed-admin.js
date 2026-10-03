import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/tvetmara_db";

const seedAdminDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI);

    console.log("✅ Berjaya bersambung ke MongoDB.");

    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash("password123", salt);

    const demoAccounts = [
      {
        email: "admin@ikmb.edu.my",
        role: "admin",
        displayName: "Admin IKMB",
      },
      {
        email: "counselor@ikmb.edu.my",
        role: "counselor",
        displayName: "Counselor IKMB",
      },
      {
        email: "user@ikmb.edu.my",
        role: "user",
        displayName: "User IKMB",
      },
    ];

    for (const account of demoAccounts) {
      await User.findOneAndUpdate(
        { email: account.email },
        {
          $set: {
            password: defaultPassword,
            role: account.role,
            displayName: account.displayName,
            studentId: null,
          },
        },
        { upsert: true, returnDocument: "after" }
      );

      console.log(`✅ Akaun ${account.role} disediakan: ${account.email}`);
    }

    console.log("✨ Seed admin selesai.");

    process.exit();
  } catch (error) {
    console.error("❌ Ralat:", error);
    process.exit(1);
  }
};

seedAdminDatabase();