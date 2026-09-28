import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import path from "path";
import { fileURLToPath } from "url";
import authRouter from "./auth.js";
import itemsRouter from "./items.js";
import MdbFile from "./models/MdbFile.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(helmet({ contentSecurityPolicy: false })); // CSP off so Swagger UI keeps working
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
}));
app.use(express.json({ limit: "200kb" })); // Prevent oversized payload abuse

// Only certificates/profile images are public; .mdb files stay private
app.use("/uploads/certificates", express.static(path.join(__dirname, "uploads", "certificates")));

// Swagger Configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "TVETMARA Besut Dashboard API",
      version: "1.0.0",
      description:
        "API documentation for the TVETMARA Skills Talent Development Dashboard FYP.",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./auth.js", "./items.js"],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

if (process.env.NODE_ENV !== "test") {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(async () => {
      console.log("✅ Connected to MongoDB successfully!");
      // 🔄 Recover files stuck in "Processing" from a previous crash
      const reset = await MdbFile.updateMany({ status: "Processing" }, { $set: { status: "Saved" } });
      if (reset.modifiedCount > 0) console.log(`🔄 Recovered ${reset.modifiedCount} stuck MDB file(s).`);
    })
    .catch((err) => console.error("❌ MongoDB connection error:", err));
}

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health Check
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server is healthy.
 */
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", source: "mongodb-database" });
});

app.use("/api/auth", authRouter);
app.use("/api", itemsRouter);

// 🚨 GLOBAL ERROR HANDLER HERE 🚨
app.use((err, req, res, next) => {
  console.error("🔥 GLOBAL UNHANDLED ERROR:", err);
  res.status(500).json({
    message: err.message || "Global server error",
    stack: err.stack
  });
});

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT) || 5000;
  app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
    console.log(
      `📄 API Documentation available at: http://localhost:${port}/api/docs`,
    );
  });
}

export default app;
