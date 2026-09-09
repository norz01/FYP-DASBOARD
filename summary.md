# TVETMARA Besut Skills Talent Development Dashboard - Project Summary

**Last Modified:** 2026-09-09 15:00:00

## Overview
This is a Full-Stack MERN (MongoDB, Express, React/Next.js, Node.js) application with an integrated AI/ML service (Python/FastAPI) designed for the TVETMARA Besut institution. The system monitors, predicts, and develops student talent using AI analytics. It provides role-based dashboards for admin (staff) and students, enabling management of student records, certificates, profile images, and AI-driven risk predictions.

## Technology Stack
- **Frontend:** Next.js 15 (React 19), TypeScript (via jsconfig.json), Tailwind CSS, Vitest for testing.
- **Backend:** Express.js 5, MongoDB (Mongoose ODM), JWT authentication, bcryptjs for password hashing, CORS, Swagger UI for API docs.
- **ML Service:** FastAPI, joblib (scikit-learn model), pandas for data processing, mdbtools for MDB file parsing.
- **DevOps:** Docker (Containerfiles for each service), docker-compose.yml for orchestration.
- **Other:** ESLint, PostCSS.

## Architecture
The system consists of three decoupled services communicating via HTTP/APIs:
1. **Frontend (Next.js)** – Runs on port 3000 (default). Handles UI, authentication cookies, and calls backend APIs via `/api` proxy (see next.config.mjs rewrites).
2. **Backend (Express)** – Runs on port 5000. Provides REST APIs for auth, student management, certificates, profile images, manual AI prediction, and MDB upload processing. Connects to MongoDB.
3. **ML Service (FastAPI)** – Runs on port 8000 (internal). Loads a trained scikit-learn model (`model_ai_risiko_lengkap_v4.pkl`) to predict student risk/status based on features (CGPA, Attendance, PLO scores, etc.). Exposes `/predict/risk`, `/predict/batch`, and `/etl/process-mdb` endpoints.

Communication flow:
- Frontend ↔ Backend: Proxy rewrites in Next.js forward `/api/*` and `/uploads/*` to backend.
- Backend ↔ ML Service: When processing an MDB upload, the backend forwards the file to ML service for ETL and batch prediction, then updates MongoDB with results.

## Detailed Component Breakdown

### Frontend (`/src`)
- **App Router (Next.js 13+):** Uses `src/app` with `layout.jsx`, `page.jsx` (home), and route groups for `staff-dashboard`, `student-dashboard`, `student-profile`.
- **Authentication:** Handled via cookies (`user` and `ikmbToken`). Middleware (`middleware.js`) protects routes and redirects based on role.
  - Middleware logic:
    - If user has cookie → redirect to appropriate dashboard (`/staff-dashboard` for admin, `/student-dashboard` for user).
    - Protected routes: `/staff-dashboard`, `/student-profile` require admin role.
    - `/student-dashboard` requires user role.
    - Login page (`/`, `/login`) accessible publicly; if already logged in, redirects to dashboard.
- **Server Actions:** `src/app/actions.js` contains `loginAction` and `logoutAction` using `use server`; they call backend `/api/auth/login`, set cookies, and redirect.
- **Styling:** Tailwind CSS (`tailwind.config.js`, `postcss.config.js`), global CSS in `src/app/globals.css`.
- **Components:** Located in `src/components/` (not inspected in detail but present).
- **Assets:** `src/assets/` (images, etc.).
- **Lib:** `src/lib/` likely contains utility functions.
- **Tests:** `src/__tests__/` (Vitest).

### Backend (`/backend`)
- **Entry Point:** `server.js` sets up Express, CORS, JSON parsing, static uploads serving, Swagger UI (`/api/docs`), connects to MongoDB, mounts routers.
- **API Routes:**
  - **Auth (`/api/auth`):**
    - `POST /api/auth/login` – authenticate user, return JWT token and user info.
    - `GET /api/auth/users` (admin only) – list all users (sanitized).
  - **Students & General (`/api`):**
    - `GET /api/health` – system health.
    - **Student CRUD (secured):**
      - `GET /api/students` – list students (admin sees all; user sees own).
      - `POST /api/students` (admin) – create new student.
      - `PUT /api/students/:studentId` (admin) – update student.
      - `DELETE /api/students/:studentId` (admin) – delete student.
      - `GET /api/students/:studentId` (ownership or admin) – get single student.
      - `GET /api/students/:studentId/skill-gap` (ownership or admin) – get skill gap analysis.
    - **Certificates:**
      - `POST /api/students/:studentId/certificates` (ownership or admin, upload) – upload certificate file (PDF/JPG/PNG, max 5MB), stores file in `/uploads/certificates/` and references in student doc.
      - `DELETE /api/students/:studentId/certificates/:certId` (ownership or admin) – delete certificate and remove file.
    - **Profile Image:**
      - `POST /api/students/:studentId/profile-image` (ownership or admin, upload) – upload image, stores in same certificates folder, updates `profileImage` field.
    - **AI Prediction (manual):**
      - `POST /api/predict/manual` (admin) – send features to ML service `/predict/risk` and return result.
    - **MDB Upload & Processing:**
      - `POST /api/data/upload-mdb` (admin) – upload `.mdb` file, forwards to ML service `/etl/process-mdb`, receives processed student data, runs batch prediction via ML service `/predict/batch`, updates MongoDB (upserts students and default user accounts), syncs deletions.
- **Middleware:** `backend/middleware/` contains:
  - `authMiddleware.js` – exports `verifyToken` (checks JWT), `requireAdmin`, `requireOwnershipOrAdmin`.
- **Models:** `backend/models/`
  - `Student.js` – schema includes: `ID_Pelajar`, `Nama`, `Kursus`, `Semester`, `Kehadiran_Pct` (string), `CGPA` (string), `Sijil_Profesional`, `PLO_1` through `PLO_9` (strings), `Status_Pelajar`, personal info (`No_KP`, `No_Telefon`, `Alamat`), `academicHistory` array (semester, gpa, cgpa, attendance), `uploadedCertificates` array (name, issuer, fileName, filePath, uploadDate), `profileImage`.
  - `User.js` – schema: `email` (unique), `password`, `role` (`admin`/`user`), `displayName`, `studentId` (ref to Student.ID_Pelajar).
- **Utilities:** `item.model.js` (not inspected) likely contains DB helper functions used by routes.

### ML Service (`/ML`)
- **Entry Point:** `ml.py` – FastAPI application.
- **Model:** Loads `model_ai_risiko_lengkap_v4.pkl` (scikit-learn pipeline) at startup.
- **Endpoints:**
  - `GET /` – health check.
  - `POST /predict/risk` – receives `StudentFeatures` (CGPA, Attendance, PLO_1..PLO_9, Sijil string), engineers features (PLO_Avg, PLO_Variance), runs model, returns prediction string.
  - `POST /predict/batch` – receives list of `StudentFeatures`, returns list of predictions.
  - `POST /etl/process-mdb` – accepts uploaded `.mdb` file, uses `mdbtools` (`mdb-export`, `mdb-tables`) to extract tables:
    - `GPA` – gets latest CGPA per student.
    - `Pelajar` – personal info (name, course, KP, phone, address).
    - `Daftar_Subjek` – attendance per subject.
    - `Detail_Result` – PLO scores (LO1-LO9 mapping; excludes subjects with LO>9 as internal CLO).
    - `Anugerah` – award flag.
    - `Pelajar_Koko_Detail` – co-curricular pass flag.
    - Computes `academicHistory` from GPA table per semester.
    - Outputs JSON list of student documents ready for MongoDB upsert (includes all Student schema fields except `uploadedCertificates` and `profileImage` which are handled separately).
- **Dependencies:** `requirements.txt` (not inspected) includes fastapi, uvicorn, joblib, pandas, numpy, etc.

## Docker & Deployment
- **Containerfiles:**
  - `Containerfile.frontend` – builds Next.js standalone output.
  - `Containerfile.backend` – builds Express backend.
  - `ML/Containerfile` – builds ML service.
- **docker-compose.yml** – defines three services:
  - `frontend`: maps port 3000, depends on backend.
  - `backend`: maps port 5000, depends on mongo (implicitly via network).
  - `tvet_ml_api`: maps port 8000, loads model, environment variables.
  - Also includes a MongoDB service? Not seen in compose.yml; likely external or implied. The backend connects to `mongodb://127.0.0.1:27017/ikmb-dashboard` per `.env`.
- **Volumes:** `mongodb_data` directory persists MongoDB data.

## Environment Variables
- **Frontend (`.env.local`):**
  - `BACKEND_URL=http://127.0.0.1:5000` – used for API proxy and server actions.
- **Backend (`.env`):**
  - `PORT=5000`
  - `MONGO_URI=mongodb://127.0.0.1:27017/ikmb-dashboard`
  - `JWT_SECRET=super_secret_tvetmara_fyp_key_2026`
  - `ML_API_URL=http://tvet_ml_api:8000` – internal docker service name for ML.
- **ML Service:** Likely uses defaults; can be configured via env (not seen).

## Key Features
- **Role-Based Access Control (RBAC):** Admin vs Student.
- **Authentication:** JWT token stored in cookie (`ikmbToken`), user info in cookie (`user`).
- **Student Management:** CRUD operations, list, skill gap view.
- **Certificate Handling:** Upload (PDF/JPG/PNG), view, delete; storage in filesystem (`/uploads/certificates/`).
- **Profile Image:** Upload and display.
- **AI Prediction:**
  - Manual single prediction (admin).
  - Batch prediction triggered after MDB upload.
  - Predicts student status (likely risk categories like "Berjaya", "Berisiko", etc.).
- **MDB Processing:** Legacy Microsoft Access database upload, ETL to extract student data, clean, map to schema, compute academic history, attendance, PLO averages, then store in MongoDB.
- **Data Sync:** After MDB upload, system syncs MongoDB collections: removes students not in new MDB, upserts updated student data, creates/upserts default user accounts (email: `ID_Pelajar@student.ikmb.edu.my`, password: hashed `password123`).
- **API Documentation:** Swagger UI available at `/api/docs` on backend.
- **Health Checks:** Both backend (`/api/health`) and ML service (`/`).

## File Structure Highlights
```
.
├── backend/                 # Express API
│   ├── models/              # Mongoose schemas (Student, User)
│   ├── middleware/          # Auth middleware
│   ├── auth.js              # Auth routes
│   ├── items.js             # Student/certificates/routes
│   ├── item.model.js        # DB helper functions (not inspected)
│   ├── server.js            # Entry point
│   ├── Containerfile.backend
│   ├── .env
│   └── package.json
├── ML/                      # FastAPI service
│   ├── ml.py                # Main app
│   ├── model_ai_risiko_lengkap_v4.pkl
│   ├── model_ai_risiko_lengkap_v3.pkl
│   ├── train_and_evaluate*.py
│   ├── test_ml.py
│   ├── Containerfile
│   └── requirements.txt
├── src/                     # Next.js frontend
│   ├── app/                 # App router (layout, page, dashboard routes)
│   ├── actions.js           # Server actions (login/logout)
│   ├── components/
│   ├── lib/
│   └── assets/
├── public/                  # Static assets
├── middleware.js            # Next.js middleware (auth)
├── next.config.mjs          # Next.js config (rewrites, images)
├── package.json             # Frontend deps/scripts
├── compose.yml              # Docker compose
├── Containerfile.frontend   # Frontend Docker
├── .env.local               # Frontend env
├── logo-tvetmara.jpg
├── ML_TEST_RESULTS.md
├── README.md? (not present)
└── summary.md               # This file
```

## API Endpoints Summary (from Swagger)
- **GET /api/health** – System health.
- **Auth:**
  - POST /api/auth/login – Login.
  - GET /api/auth/users – Get all users (admin).
- **Students:**
  - GET /api/students – List (filtered by role).
  - POST /api/students – Create (admin).
  - PUT /api/students/:id – Update (admin).
  - DELETE /api/students/:id – Delete (admin).
  - GET /api/students/:id – Get single (owner/admin).
  - GET /api/students/:id/skill-gap – Skill gap (owner/admin).
- **Certificates:**
  - POST /api/students/:id/certificates – Upload (owner/admin).
  - DELETE /api/students/:id/certificates/:certId – Delete (owner/admin).
- **Profile Image:**
  - POST /api/students/:id/profile-image – Upload (owner/admin).
- **AI:**
  - POST /api/predict/manual – Manual prediction (admin).
- **MDB:**
  - POST /api/data/upload-mdb – Upload & process MDB (admin).

## Database Schema Summary
**Students Collection:**
- `_id` (ObjectId)
- `ID_Pelajar` (String) – Student ID.
- `Nama` (String).
- `Kursus` (String).
- `Semester` (Number).
- `Kehadiran_Pct` (String) – Percentage.
- `CGPA` (String).
- `Sijil_Profesional` (String).
- `PLO_1` through `PLO_9` (String) – Average scores.
- `Status_Pelajar` (String) – AI prediction result (e.g., "Lulus", "Berisiko").
- `No_KP`, `No_Telefon`, `Alamat` (String, default empty).
- `academicHistory` (Array) – Objects with `semester` (Number), `gpa` (String), `cgpa` (String), `attendance` (String).
- `uploadedCertificates` (Array) – Objects with `name`, `issuer`, `fileName`, `filePath`, `uploadDate` (Date).
- `profileImage` (String) – Path to image.

**Users Collection:**
- `_id` (ObjectId)
- `email` (String, unique) – e.g., `20201234@student.ikmb.edu.my`.
- `password` (String, hashed).
- `role` (String) – `admin` or `user`.
- `displayName` (String) – Student name.
- `studentId` (String, references `Students.ID_Pelajar`).

## Setup & Run Instructions (Summary)
1. Ensure Docker & docker-compose are installed.
2. Copy `.env.example` to `.env` in backend if needed (already present).
3. Ensure `.env.local` exists in root (already present).
4. Run `docker-compose up --build` to start all services.
5. Frontend available at http://localhost:3000.
6. Backend API at http://localhost:5000.
7. ML service at http://localhost:8000.
8. API docs at http://localhost:5000/api/docs.
9. Seed admin user: run `docker-compose exec backend node seed.js` (or `npm run seed`).
10. Default admin credentials likely in seed file (not inspected).

## Notes
- The project uses Next.js 15 with `output: standalone` for Docker efficiency.
- Authentication cookies are `httpOnly: false` for simplicity (not production secure).
- File uploads limited to 5MB for certificates, 100MB for MDB.
- The ML model predicts based on engineered features: PLO average and variance.
- The system handles legacy MDB files via `mdbtools` (must be installed in ML container; Containerfile likely includes it).

--- 

*This summary provides a comprehensive overview of the TVETMARA Besut Dashboard project, detailing its architecture, technologies, features, and implementation specifics for quick understanding and onboarding.*
Last modified: 2026-09-09 15:00:00