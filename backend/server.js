import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import authRouter from './auth.js';
import itemsRouter from './items.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Swagger Configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TVETMARA Besut Dashboard API',
      version: '1.0.0',
      description: 'API documentation for the TVETMARA Skills Talent Development Dashboard FYP.',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        }
      }
    },
  },
  apis: ['./auth.js', './items.js'], // Path to the API route files
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Only connect to MongoDB if not in a test environment
if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB successfully!'))
    .catch((err) => console.error('❌ MongoDB connection error:', err));
}

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health Check
 *     description: Checks if the server and database are running.
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server is healthy.
 */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', source: 'mongodb-database' });
});

app.use('/api/auth', authRouter);
app.use('/api', itemsRouter);

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT) || 5000;
  app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
    console.log(`📄 API Documentation available at: http://localhost:${port}/api/docs`);
  });
}

export default app;