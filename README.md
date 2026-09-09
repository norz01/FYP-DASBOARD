# TVETMARA Besut Skills Talent Development Dashboard

A full-stack MERN (MongoDB, Express, React/Next.js, Node.js) application with an integrated AI/ML service (Python/FastAPI) designed for the TVETMARA Besut institution. The system monitors, predicts, and develops student talent using AI analytics. It provides role-based dashboards for admin (staff) and students, enabling management of student records, certificates, profile images, and AI-driven risk predictions.

## Table of Contents
- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Setup and Installation](#setup-and-installation)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Running with Docker Compose](#running-with-docker-compose)
  - [Running Locally (without Docker)](#running-locally-without-docker)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [CI/CD Pipeline](#cicd-pipeline)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)
- [Last Modified](#last-modified)

## Overview
The TVETMARA Besut Dashboard is a comprehensive system that leverages modern web technologies and machine learning to provide insights into student performance and talent development. The application consists of three main services:
1. **Frontend**: A Next.js 15 application with React 19, providing responsive dashboards for administrators and students.
2. **Backend**: An Express.js 5 API server that handles authentication, student management, certificate uploads, and communication with the ML service.
3. **ML Service**: A FastAPI application that serves a trained machine learning model for predicting student risk status based on academic and behavioral features.

Key features include:
- Role-Based Access Control (RBAC) for admin and student users
- JWT-based authentication with HTTP-only cookies
- Student CRUD operations
- Certificate and profile image uploads
- Manual and batch AI predictions
- Legacy Microsoft Access (.mdb) file processing and ETL
- Data synchronization between MDB uploads and MongoDB
- Swagger UI for API documentation
- Health checks for all services

## Technology Stack
- **Frontend**: 
  - Next.js 15 (React 19) with Server-Side Rendering (SSR)
  - TypeScript (configured via jsconfig.json)
  - Tailwind CSS for styling
  - Vitest for testing
- **Backend**:
  - Express.js 5
  - MongoDB with Mongoose ODM
  - JWT authentication (jsonwebtoken)
  - Password hashing (bcryptjs)
  - CORS middleware
  - Swagger UI for API documentation (swagger-jsdoc, swagger-ui-express)
  - File upload handling (multer)
- **ML Service**:
  - FastAPI
  - Scikit-learn (joblib) for the prediction model
  - Pandas and NumPy for data processing
  - MDBtools for parsing Microsoft Access files
  - Pytest for testing
- **DevOps**:
  - Docker (Containerfiles for each service)
  - Docker Compose for orchestration
  - GitHub Actions for CI/CD
- **Other**:
  - ESLint for code quality
  - PostCSS for CSS processing

## Architecture
The system follows a microservices architecture with three decoupled services communicating via HTTP/APIs:

1. **Frontend (Next.js)** 
   - Runs on port 3000 (default)
   - Handles UI rendering, authentication cookies, and proxies API requests to the backend
   - Uses Next.js App Router with route groups for different user roles
   - Implements middleware for route protection based on user roles

2. **Backend (Express)**
   - Runs on port 5000
   - Provides RESTful APIs for:
     - Authentication (login, token validation)
     - Student management (CRUD operations)
     - Certificate and profile image uploads
     - Manual AI predictions (single student)
     - MDB file upload and processing
     - Health checks
   - Connects to MongoDB for data persistence
   - Communicates with the ML service for AI predictions and MDB processing

3. **ML Service (FastAPI)**
   - Runs on port 8000 (internal)
   - Loads a pre-trained scikit-learn model at startup
   - Exposes endpoints for:
     - Health checks
     - Single student risk prediction
     - Batch student predictions
     - MDB file processing (ETL) to extract student data and compute features
   - Uses mdbtools to parse .mdb files and extract relevant tables

### Communication Flow
- **Frontend ↔ Backend**: 
  - Next.js middleware rewrites `/api/*` and `/uploads/*` requests to the backend service
  - Server actions in `src/app/actions.js` handle login/logout by calling backend APIs
  
- **Backend ↔ ML Service**:
  - When processing an MDB upload, the backend forwards the file to the ML service's `/etl/process-mdb` endpoint
  - The ML service returns processed student data, which the backend then uses for batch predictions via `/predict/batch`
  - The backend updates MongoDB with the prediction results and handles data synchronization

## Project Structure
```
.
├── backend/                 # Express.js backend API
│   ├── models/              # Mongoose schemas (Student, User)
│   │   ├── Student.js       # Student schema definition
│   │   └── User.js          # User schema definition
│   ├── middleware/          # Custom middleware
│   │   ├── authMiddleware.js # JWT verification and role-based access
│   │   └── ...              # Other middleware
│   ├── auth.js              # Authentication routes
│   ├── items.js             # Student, certificate, and profile routes
│   ├── item.model.js        # Database helper functions
│   ├── server.js            # Express application entry point
│   ├── Containerfile.backend # Dockerfile for backend
│   ├── .env                 # Backend environment variables
│   ├── package.json         # Backend dependencies and scripts
│   └── package-lock.json    # Backend lockfile
├── ML/                      # Python/FastAPI ML service
│   ├── ml.py                # FastAPI application entry point
│   ├── model_ai_risiko_lengkap_v4.pkl  # Trained scikit-learn model
│   ├── model_ai_risiko_lengkap_v3.pkl  # Previous model version
│   ├── train_and_evaluate.py   # Model training script (v3)
│   ├── train_and_evaluate_v4.py  # Model training script (v4)
│   ├── test_ml.py           # Unit tests for ML service
│   ├── Containerfile        # Dockerfile for ML service
│   └── requirements.txt     # Python dependencies
├── src/                     # Next.js frontend application
│   ├── app/                 # App router (Next.js 13+)
│   │   ├── layout.jsx       # Root layout
│   │   ├── page.jsx         # Home page (login redirect)
│   │   ├── actions.js       # Server actions (login/logout)
│   │   ├── staff-dashboard/ # Admin dashboard route
│   │   ├── student-dashboard/ # Student dashboard route
│   │   └── student-profile/ # Student profile route (admin only)
│   ├── components/          # Reusable React components
│   ├── lib/                 # Utility functions
│   ├── assets/              # Static assets (images, icons)
│   └── __tests__/           # Vitest tests
├── public/                  # Static assets served by Next.js
├── middleware.js            # Next.js middleware for route protection
├── next.config.mjs          # Next.js configuration (rewrites, images)
├── Containerfile.frontend   # Dockerfile for frontend
├── compose.yml              # Docker Compose orchestration
├── .env.local               # Frontend environment variables
├── package.json             # Frontend dependencies and scripts
├── package-lock.json        # Frontend lockfile
├── logo-tvetmara.jpg        # Application logo
├── summary.md               # Project summary (this file's basis)
├── ML_TEST_RESULTS.md       # ML model test results
└── README.md                # This file
```

## Setup and Installation

### Prerequisites
- Docker and Docker Compose (for containerized deployment)
- Node.js 20+ and npm (for local development without Docker)
- Python 3.9+ and pip (for ML service local development)
- MongoDB (if running backend locally without Docker)

### Environment Variables
The project uses environment variables for configuration. Sample files are provided:

#### Frontend (`.env.local`)
```env
BACKEND_URL=http://127.0.0.1:5000
```

#### Backend (`backend/.env`)
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/ikmb-dashboard
JWT_SECRET=super_secret_tvetmara_fyp_key_2026
ML_API_URL=http://tvet_ml_api:8000
```

#### ML Service
The ML service primarily uses defaults but can be configured via environment variables if needed (not currently implemented).

### Running with Docker Compose
The easiest way to run the entire stack is using Docker Compose:

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd TVETMARA-Besut-Skills-Talent-Development-Dashboard
   ```

2. Ensure Docker is running and execute:
   ```bash
   docker-compose up --build
   ```

3. Wait for all services to start (approximately 1-2 minutes for initial build).

4. Access the services:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - ML Service: http://localhost:8000
   - API Documentation: http://localhost:5000/api/docs

5. To stop the services:
   ```bash
   docker-compose down
   ```

### Running Locally (without Docker)
For development purposes, you can run each service independently:

#### Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   The backend will run on http://localhost:5000

#### ML Service
1. Navigate to the ML directory:
   ```bash
   cd ML
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Install mdbtools (required for MDB processing):
   ```bash
   # On Ubuntu/Debian
   sudo apt-get install -y mdbtools
   # On macOS with Homebrew
   brew install mdbtools
   ```
4. Start the ML service:
   ```bash
   uvicorn ml:app --host 0.0.0.0 --port 8000
   ```
   The ML service will run on http://localhost:8000

#### Frontend
1. Ensure the backend and ML service are running (or set appropriate environment variables)
2. Navigate to the project root:
   ```bash
   cd ..
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
   The frontend will run on http://localhost:3000

Note: For local development, you may need to adjust environment variables:
- Frontend: Set `BACKEND_URL` in `.env.local` to point to your backend
- Backend: Set `MONGO_URI` to your MongoDB instance and `ML_API_URL` to your ML service

## API Documentation
The backend provides interactive API documentation via Swagger UI:
- When running: http://localhost:5000/api/docs
- Includes all available endpoints with request/response examples
- Allows testing endpoints directly from the browser

### Key API Endpoints
#### Authentication
- `POST /api/auth/login` - Authenticate user and return JWT token
- `GET /api/auth/users` (Admin only) - List all users

#### Student Management
- `GET /api/students` - List students (filtered by role)
- `POST /api/students` (Admin only) - Create a new student
- `PUT /api/students/:studentId` (Admin only) - Update student information
- `DELETE /api/students/:studentId` (Admin only) - Delete a student
- `GET /api/students/:studentId` (Owner or Admin) - Get a specific student
- `GET /api/students/:studentId/skill-gap` (Owner or Admin) - Get skill gap analysis

#### Certificates
- `POST /api/students/:studentId/certificates` (Owner or Admin, upload) - Upload a certificate file
- `DELETE /api/students/:studentId/certificates/:certId` (Owner or Admin) - Delete a certificate

#### Profile Image
- `POST /api/students/:studentId/profile-image` (Owner or Admin, upload) - Upload a profile image

#### AI Prediction
- `POST /api/predict/manual` (Admin only) - Request a manual risk prediction for a student

#### MDB Processing
- `POST /api/data/upload-mdb` (Admin only) - Upload and process a Microsoft Access (.mdb) file

#### Health Checks
- `GET /api/health` - Backend health check
- `GET /` (ML Service) - ML service health check

## Testing
The project includes unit tests for all three services:

### Frontend Tests
- Located in `src/__tests__/`
- Run with Vitest
- Command: `npm test` (from project root)

### Backend Tests
- Located in `backend/__tests__/`
- Run with Jest and Supertest
- Command: `npm test` (from backend directory)

### ML Service Tests
- Located in `ML/test_ml.py`
- Run with Pytest
- Command: `pytest test_ml.py` (from ML directory)

### Running All Tests
The CI/CD pipeline runs all tests sequentially. You can also run them individually as described above.

## CI/CD Pipeline
The project uses GitHub Actions for continuous integration and delivery. The workflow (`.github/workflows/ci.yml`) includes:

1. **Frontend Tests & Build**
   - Runs Vitest tests
   - Builds the Next.js application for production

2. **Backend Tests**
   - Runs Jest tests with Supertest for API testing

3. **ML Service Tests**
   - Runs Pytest tests
   - Installs mdbtools dependency for MDB processing tests

4. **Docker Build**
   - Builds Docker images for all three services (only if all tests pass)
   - Images are tagged as `tvet-frontend:latest`, `tvet-backend:latest`, and `tvet-ml-api:latest`

The workflow triggers on push and pull request to the `main` and `master` branches.

## Contributing
Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a new branch for your feature or bug fix
3. Make your changes
4. Ensure all tests pass
5. Submit a pull request

Please make sure to update tests as appropriate and follow the existing code style.

## License
This project is licensed under the ISC License - see the `package.json` file for details.

## Acknowledgements
- TVETMARA Besut for providing the domain requirements and data
- The open-source community for the various libraries and frameworks used
- Contributors who have helped shape this project

## Last Modified
Last updated: 2026-09-09 15:03:00