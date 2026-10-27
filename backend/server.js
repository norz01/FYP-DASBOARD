import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import authRouter from "./auth.js";
import itemsRouter from "./items.js";
import reportsRouter from "./reports.js";
import studentReportsRouter from "./studentReports.js";
import careersRouter from "./careers.js";
import MdbFile from "./models/MdbFile.js";

dotenv.config();

// F-1: Fail-closed boot if secrets are missing
if (!process.env.JWT_SECRET && process.env.NODE_ENV !== "test") {
  console.error("🔴 FATAL: JWT_SECRET is not set. Server refusing to start.");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// F-1: Enable Content Security Policy (CSP)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"], // Phosphor icons
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://images.unsplash.com"],
      connectSrc: ["'self'"],
    },
  },
}));

// F-1: Restrict CORS to allowlist
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(",").map(s => s.trim()) 
  : ["http://localhost:3000", "http://localhost:8080"];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
}));

app.use(express.json({ limit: "200kb" }));

// Ensure upload directories exist
const uploadDirectories = ["certificates", "mdb", "referrals", "reports"];
for (const dir of uploadDirectories) {
  const uploadPath = path.join(__dirname, "uploads", dir);
  if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
}

// Public static uploads
app.use("/uploads/certificates", express.static(path.join(__dirname, "uploads", "certificates")));
app.use("/uploads/referrals", express.static(path.join(__dirname, "uploads", "referrals")));
app.use("/uploads/reports", express.static(path.join(__dirname, "uploads", "reports")));

// Swagger Configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "TVETMARA Besut Dashboard API",
      version: "1.0.0",
      description: "API documentation for the TVETMARA Skills Talent Development Dashboard FYP.",
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  },
  apis: ["./auth.js", "./items.js", "./reports.js", "./studentReports.js"],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

if (process.env.NODE_ENV !== "test") {
  mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
      console.log("✅ Connected to MongoDB successfully!");
      const reset = await MdbFile.updateMany({ status: "Processing" }, { $set: { status: "Saved" } });
      if (reset.modifiedCount > 0) console.log(`🔄 Recovered ${reset.modifiedCount} stuck MDB file(s).`);
    })
    .catch((err) => console.error("❌ MongoDB connection error:", err));
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", source: "mongodb-database" });
});

app.use("/api/auth", authRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/student-reports", studentReportsRouter);
app.use("/api/careers", careersRouter);
app.use("/api", itemsRouter);

// F-1 & F-3: Global error handler (No stack traces in production)
app.use((err, req, res, next) => {
  console.error("🔥 GLOBAL UNHANDLED ERROR:", err);
  const isProd = process.env.NODE_ENV === "production";
  
  res.status(err.status || 500).json({
    message: isProd ? "Ralat pelayan tidak dijangka." : (err.message || "Global server error"),
    stack: isProd ? undefined : err.stack,
  });
});

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT) || 5000;
  app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
    console.log(`📄 API Documentation available at: http://localhost:${port}/api/docs`);
  });
}

export default app;