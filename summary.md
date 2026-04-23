# TVETMARA Besut Skills Talent Development Dashboard - Project Summary

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Purpose & Goals](#2-purpose--goals)
3. [Target Users](#3-target-users)
4. [Technology Stack](#4-technology-stack)
5. [System Architecture](#5-system-architecture)
6. [Project Structure](#6-project-structure)
7. [File-by-File Description](#7-file-by-file-description)
8. [Database Structure](#8-database-structure)
9. [Authentication System](#9-authentication-system)
10. [API Endpoints](#10-api-endpoints)
11. [Machine Learning Integration](#11-machine-learning-integration)
12. [Frontend Pages](#12-frontend-pages)
13. [Docker Deployment](#13-docker-deployment)
14. [Course Codes & Certifications](#14-course-codes--certifications)
15. [How to Run the Project](#15-how-to-run-the-project)
16. [Default Login Credentials](#16-default-login-credentials)

---

## 1. Project Overview

This is a **Final Year Project (FYP)** for **TVETMARA Besut** (Institut Kemahiran MARA Besut), a Malaysian TVET (Technical and Vocational Education and Training) institution.

The project is a **smart web-based analytics dashboard** that combines:
- **Student data management** (CRUD operations)
- **AI-powered predictions** (dropout risk, employability)
- **Skills gap analysis** (visual charts and recommendations)
- **Career matching** (job recommendations based on course)

The application is built using the **MERN Stack** (MongoDB, Express.js, React, Node.js) with a **Python FastAPI ML service** for AI predictions.

---

## 2. Purpose & Goals

### Main Goals

1. **Monitor Student Performance** - Track CGPA, attendance, and PLO (Program Learning Outcomes) scores
2. **Predict Dropout Risk** - Use AI/ML to identify students at risk of dropping out
3. **Identify Skill Gaps** - Compare student skills against industry targets
4. **Career Recommendations** - Suggest suitable jobs and courses based on student profile
5. **Intervention Planning** - Provide prescriptive analytics to help staff intervene early

### Key Features

- AI-powered dropout risk prediction
- Radar chart for skills gap visualization
- Career path matching based on course
- Student management (Add/Edit/Delete records)
- Real-time KPI dashboard for administrators
- Responsive design for mobile and desktop

---

## 3. Target Users

| User Type | Role | Access Level | Dashboard |
|-----------|------|--------------|-----------|
| Administrator | Admin | Full access to all features | StaffDashboard |
| Lecturer/Staff | Admin | Manage students, view all data | StaffDashboard |
| Student | User | View own data only | StudentDashboard |

---

## 4. Technology Stack

### Frontend (User Interface)

| Technology | Version | Purpose |
|------------|---------|---------|
| React.js | 19.2.0 | UI framework |
| Vite | 7.3.1 | Build tool and dev server |
| React Router DOM | 7.13.1 | Page navigation |
| Tailwind CSS | 3.4.19 | Styling framework |
| Chart.js | 4.5.1 | Data visualization |
| react-chartjs-2 | 5.3.1 | React wrapper for Chart.js |
| ESLint | 9.39.1 | Code linting |
| Phosphor Icons | CDN | Icon library |

### Backend (Server)

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | JavaScript runtime |
| Express.js | 5.2.1 | Web server framework |
| MongoDB | 7 | NoSQL database |
| Mongoose | 9.3.3 | Database ORM/ODM |
| JWT (jsonwebtoken) | 9.0.3 | Authentication tokens |
| bcryptjs | 3.0.3 | Password hashing |
| cors | 2.8.6 | Cross-origin requests |
| dotenv | 17.3.1 | Environment variables |

### ML/AI Service

| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.9+ | ML runtime |
| FastAPI | 2 | Python web framework |
| scikit-learn | 1.6 | Machine learning library |
| joblib | 1.5 | Model serialization |
| Uvicorn | 0.34 | ASGI server |
| Pydantic | 2 | Data validation |

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (CLIENT)                            │
│  ┌──────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │  Login   │  │ StaffDashboard   │  │ StudentDashboard │           │
│  │  Page    │  │ (Admin only)     │  │ (Students only)  │           │
│  └────┬─────┘  └────────┬─────────┘  └────────┬─────────┘           │
└───────┼─────────────────┼─────────────────────┼─────────────────────┘
        │                 │                     │
        │ HTTP + JWT       │ HTTP + JWT           │ HTTP + JWT
        ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   EXPRESS.JS BACKEND (Port 5000/5001)              │
│  ┌────────────────┐  ┌──────────────────────┐  ┌─────────────────┐  │
│  │ /api/auth/*    │  │ /api/students/*      │  │ /api/health     │  │
│  │ Login routes   │  │ Student CRUD + AI    │  │ Health check    │  │
│  └───────┬────────┘  └──────────┬───────────┘  └─────────────────┘  │
│          │                      │                                      │
│          ▼                      ▼                                      │
│  ┌────────────────┐  ┌─────────────────────────────────────┐          │
│  │ User Model     │  │ Student Model + Skill Gap + AI     │          │
│  │ (auth.model.js)│  │ (item.model.js)                     │          │
│  └───────┬────────┘  └──────────┬─────────────────────────┘          │
│          │                       │                                   │
��──────────┼───────────────────────┼───────────────────────────────────┘
           │                       │ HTTP POST /predict/risk
           ▼                       ▼
┌─────────────────────┐  ┌─────────────────────────────────────────────┐
│  MongoDB            │  │  ML Service (FastAPI, Port 8000)            │
│  (Port 27017)       │  │  ┌───────────────────────────────────────┐ │
│  ┌───────────────┐  │  │  │ /predict/risk                         │ │
│  │ users         │  │  │  │ (Random Forest Model)                 │ │
│  │ collection    │  │  │  └───────────────────────────────────────┘ │
│  └───────────────┘  │  └─────────────────────────────────────────────┘
│  ┌───────────────┐  │
│  │ students      │  │
│  │ collection    │  │
│  └───────────────┘  │
└─────────────────────┘
```

### Data Flow

1. **User Login Flow**:
   - User submits email + password at Login page
   - Frontend sends POST to `/api/auth/login`
   - Backend verifies credentials against MongoDB
   - On success, returns JWT token (8-hour expiration)
   - Frontend stores token in localStorage
   - User is redirected to appropriate dashboard

2. **Dashboard Loading Flow**:
   - Dashboard fetches student data with JWT token
   - Backend queries MongoDB
   - Returns normalized student records

3. **Skill Gap Analysis Flow**:
   - Frontend requests `/api/students/:id/skill-gap`
   - Backend fetches student data from MongoDB
   - Backend calls ML API for risk prediction
   - Backend calculates PLO metrics and insights
   - Returns chart data, metrics, and AI recommendations

---

## 6. Project Structure

```
TVETMARA-Besut-Skills-Talent-Development-Dashboard/
│
├── ROOT LEVEL (Configuration Files)
│   ├── package.json              # NPM dependencies and scripts
│   ├── vite.config.js            # Vite build configuration
│   ├── tailwind.config.js        # Tailwind CSS configuration
│   ├── postcss.config.js         # PostCSS configuration
│   ├── eslint.config.js          # ESLint code quality rules
│   ├── index.html                # HTML entry point
│   ├── .env                      # Environment variables (secrets)
│   ├── .gitignore                # Git ignore patterns
│   └── .dockerignore             # Docker ignore patterns
│
├── BACKEND (Node.js/Express)
│   ├── server.js                 # Main Express server entry point
│   ├── auth.js                   # Authentication routes (login, users)
│   ├── auth.model.js             # Authentication logic (verify, JWT)
│   ├── items.js                  # Student data routes (CRUD)
│   ├── item.model.js             # Student data logic + ML integration
│   ├── seed.js                   # Database seeding script
│   ├── middleware/
│   │   └── authMiddleware.js     # JWT token verification middleware
│   └── models/
│       ├── User.js               # User Mongoose schema
│       └── Student.js            # Student Mongoose schema
│
├── FRONTEND (React/Vite)
│   ├── src/
│   │   ├── main.jsx              # React entry point
│   │   ├── App.jsx               # Main app with routing
│   │   ├── index.css             # Global CSS (Tailwind directives)
│   │   ├── App.css               # App-specific styles
│   │   ├── pages/
│   │   │   ├── Login.jsx         # Login page
│   │   │   ├── StaffDashboard.jsx  # Admin dashboard
│   │   │   ├── StudentDashboard.jsx # Student dashboard
│   │   │   └── StudentProfile.jsx   # Detailed student view
│   │   ├── utils/
│   │   │   └── auth.js           # Frontend auth utilities
│   │   └── assets/
│   │       └── react.svg         # React logo asset
│   └── public/
│       └── vite.svg              # Vite logo
│
├── ML SERVICE (Python/FastAPI)
│   ├── ml.py                     # FastAPI ML server
│   ├── requirements.txt          # Python dependencies
│   ├── Containerfile             # Docker config for ML
│   ├── model_ai_tvet_besut.pkl   # Trained AI model v1
│   └── model_ai_risiko_lengkap_v2.pkl  # Trained AI model v2
│
├── DOCKER & DEPLOYMENT
│   ├── compose.yml               # Docker Compose (all services)
│   ├── Containerfile.frontend   # Docker config for React frontend
│   ├── Containerfile.backend    # Docker config for Express backend
│   └── nginx.conf                # Nginx reverse proxy config
│
├── DATABASE FILES
│   ├── data_tvet_muktamad.json   # Student data (15,000+ records)
│   ├── data_tvet.json            # Student data (old version)
│   ├── login_users.json          # Login account definitions
│   ├── Ekspot_Senat.mdb          # Microsoft Access database (source)
│   ├── ekstrak_mdb.py            # Data extraction script
│   └── sedut_mdb_tulen.py        # Data processing script
│
├── BACKEND PLACEHOLDER
│   └── backend/
│       └── package.json          # Reserved for future use
│
├── DOCUMENTATION
│   ├── README.md                 # Project readme
│   ├── AGENTS.md                 # AI agent instructions
│   ├── summary.md                # This file
│   ├── info.md                   # Detailed project info
│   └── serverreadme.md          # Deployment guide
│
├── OUTPUT FILES
│   ├── dist/                     # Built frontend output
│   │   ├── index.html
│   │   ├── assets/
│   │   │   ├── index-DtA1jIHZ.js
│   │   │   └── index-CqPjm1Aq.css
│   │   └── vite.svg
│   └── server.log               # Server log file
│
├── IMAGES
│   └── logo-tvetmara.jpg         # TVETMARA logo
│
└── node_modules/                 # NPM packages (generated)
```

---

## 7. File-by-File Description

### 7.1 Root Configuration Files

| File | Purpose | Key Details |
|------|---------|-------------|
| `package.json` | NPM package definitions | Scripts: `dev`, `build`, `lint`, `preview`, `start` |
| `vite.config.js` | Vite build tool config | Sets up React plugin and API proxy to Express |
| `tailwind.config.js` | Tailwind CSS config | Uses Plus Jakarta Sans font, scans `src/**` files |
| `postcss.config.js` | PostCSS config | Loads Tailwind and Autoprefixer |
| `eslint.config.js` | ESLint rules | Flat config with React Hooks and React Refresh plugins |
| `index.html` | HTML entry point | Loads Phosphor Icons CDN, mounts React to `#root` |
| `.env` | Environment secrets | Contains PORT, MONGO_URI, JWT_SECRET |
| `.gitignore` | Git ignore patterns | Ignores node_modules, dist, logs, editor files |
| `.dockerignore` | Docker ignore | Ignores ML folder, .git, .env, node_modules |

### 7.2 Backend Files

| File | Purpose | Key Functions |
|------|---------|---------------|
| `server.js` | Express entry point | Connects to MongoDB, registers routes, starts server |
| `auth.js` | Auth routes | `GET /users` (public), `POST /login` |
| `auth.model.js` | Auth logic | Merges User collection + Student DB accounts, verifies password, generates JWT |
| `items.js` | Student routes | CRUD endpoints + skill-gap analysis endpoint |
| `item.model.js` | Student logic | CRUD operations, normalizes data, calls ML API, generates insights |
| `seed.js` | Database seeder | Loads JSON data, creates Student + User records in MongoDB |
| `middleware/authMiddleware.js` | JWT middleware | Verifies token, attaches user to request |
| `models/User.js` | User schema | email, password, role, displayName, studentId |
| `models/Student.js` | Student schema | ID_Pelajar, Nama, Kursus, Semester, CGPA, Kehadiran_Pct, PLO_1-9, etc. |

### 7.3 Frontend Files

| File | Purpose | Key Features |
|------|---------|-------------|
| `src/main.jsx` | React entry | Renders App component inside StrictMode |
| `src/App.jsx` | Main app | React Router setup, protected routes by role |
| `src/index.css` | Global CSS | Tailwind directives + Google Fonts import |
| `src/App.css` | App styles | Logo animation, card styles |
| `src/pages/Login.jsx` | Login page | Split-screen layout, form validation, pre-filled credentials |
| `src/pages/StaffDashboard.jsx` | Admin dashboard | 5 tabs: Overview, AI Prediction, Skills Gap, Learning Pathways, Student Management |
| `src/pages/StudentDashboard.jsx` | Student dashboard | 3 tabs: Profile & Achievement, Career Matching, Recommended Courses |
| `src/pages/StudentProfile.jsx` | Student detail | Full profile, charts, intervention recommendations |
| `src/utils/auth.js` | Auth utilities | localStorage helpers for user/token storage |

### 7.4 ML Service Files

| File | Purpose | Key Details |
|------|---------|-------------|
| `ML/ml.py` | FastAPI server | `/predict/risk` endpoint, loads joblib model |
| `ML/requirements.txt` | Python deps | fastapi, uvicorn, scikit-learn, joblib, pydantic, pandas, numpy |
| `ML/Containerfile` | Docker config | Python 3.9-slim, runs uvicorn on port 8000 |
| `ML/model_ai_risiko_lengkap_v2.pkl` | Trained model | Random Forest model for dropout risk prediction |
| `ML/model_ai_tvet_besut.pkl` | Old model | Earlier version of the ML model |

### 7.5 Docker Files

| File | Purpose | Key Details |
|------|---------|-------------|
| `compose.yml` | All services orchestration | 4 services: mongodb, backend, frontend, ml-api |
| `Containerfile.frontend` | Frontend Docker | Multi-stage: npm build → nginx serve |
| `Containerfile.backend` | Backend Docker | Node 20-alpine, production deps only |
| `nginx.conf` | Nginx config | Serves React files, proxies `/api` to backend |

### 7.6 Database Files

| File | Purpose | Key Details |
|------|---------|-------------|
| `db/data_tvet_muktamad.json` | Student data | 15,394 lines, 15,000+ student records |
| `db/data_tvet.json` | Old student data | Previous version |
| `db/login_users.json` | Login accounts | 260+ test accounts (admin, staff, students) |
| `db/Ekspot_Senat.mdb` | Source database | Microsoft Access database from Senat |
| `db/ekstrak_mdb.py` | Extraction script | Extracts data from Access DB |
| `db/sedut_mdb_tulen.py` | Processing script | Processes and cleans extracted data |

---

## 8. Database Structure

### 8.1 MongoDB Connection

```
Database: ikmb-dashboard (from .env: MONGO_URI=mongodb://127.0.0.1:27017/ikmb-dashboard)
```

### 8.2 Collections

#### Collection: `users`

Stores login accounts for authentication.

```javascript
{
  email: String,        // Unique, required (e.g., "admin@ikmb.edu.my")
  password: String,     // Hashed with bcrypt (or plain for students)
  role: String,         // "admin" or "user"
  displayName: String,  // Display name (e.g., "Admin IKMB")
  studentId: String     // Reference to student ID (null for admin)
}
```

#### Collection: `students`

Stores student academic records.

```javascript
{
  ID_Pelajar: String,       // Student ID (e.g., "TVET001")
  Nama: String,             // Full name
  Kursus: String,           // Course code (e.g., "DFK", "ITW")
  Semester: Number,         // Current semester
  Kehadiran_Pct: String,    // Attendance percentage (as string)
  CGPA: String,             // Cumulative GPA (as string)
  Sijil_Profesional: String, // Professional certification
  PLO_1 to PLO_9: String,   // Program Learning Outcomes (scores)
  Status_Pelajar: String,   // Status: "Bermasalah", "Sederhana", "Cemerlang"
  Anugerah: Boolean,       // Award recipient flag
  Koko_Lulus: Boolean      // Koko graduation flag
}
```

### 8.3 Data Normalization

The system normalizes raw data from strings to proper types:

| Raw Field | Normalized Field | Transformation |
|-----------|-----------------|----------------|
| `Kehadiran_Pct` | `attendance` | String → Number |
| `CGPA` | `cgpa` | String → Number |
| `Status_Pelajar` | `dropoutRisk` | Mapped to risk levels |
| `Sijil_Profesional` | `certificationScore` | Mapped to numeric scores |

#### Risk Level Mapping

| Status_Pelajar | dropoutRisk (Malay) | dropoutRisk (English) |
|----------------|---------------------|-----------------------|
| Bermasalah | Tinggi | High |
| Sederhana | Sederhana | Moderate |
| Cemerlang | Rendah | Low |

#### Certification Score Mapping

| Sijil_Profesional | Score |
|-------------------|-------|
| Tiada (None) | 35 |
| CompTIA | 70 |
| Cisco CCNA | 85 |
| AWS Cloud | 90 |

---

## 9. Authentication System

### 9.1 User Roles

| Role | Description | Access |
|------|-------------|--------|
| `admin` | Administrators, lecturers | Full access to all features and all student data |
| `user` | Students | Limited to own data only |

### 9.2 Login Flow (Step by Step)

```
1. User enters email and password on Login page
2. Frontend sends POST request to /api/auth/login
3. Backend (auth.js) calls authenticateUser() from auth.model.js
4. auth.model.js performs:
   a. Merges users from MongoDB 'users' collection with students from 'students' collection
   b. For students: derives email from student ID (format: {ID_Pelajar}@student.ikmb.edu.my)
   c. For admin/staff: verifies password using bcrypt.compare()
   d. For students: verifies password using simple string comparison (password123)
   e. Generates JWT token with payload: {email, role, studentId}
   f. Token expires in 8 hours
5. Backend returns {user, token} to frontend
6. Frontend stores:
   a. User object in localStorage (key: 'ikmbCurrentUser')
   b. JWT token in localStorage (key: 'ikmbToken')
7. User is redirected to appropriate dashboard based on role
```

### 9.3 Protected Routes

Every request to `/api/students/*` requires the following header:

```
Authorization: Bearer <JWT_TOKEN>
```

The `middleware/authMiddleware.js` performs:
- Extracts token from Authorization header
- Verifies using JWT_SECRET from .env
- Stores decoded user in `req.user`
- Returns 401 if token is invalid/expired

### 9.4 Token Payload

```javascript
{
  email: String,      // User email
  role: String,       // "admin" or "user"
  studentId: String,  // Student ID (null for admin)
  iat: Number,        // Issued at timestamp
  exp: Number         // Expiration timestamp (8 hours from issue)
}
```

### 9.5 Frontend Auth Utilities (src/utils/auth.js)

| Function | Purpose |
|----------|---------|
| `getStoredUser()` | Get user object from localStorage |
| `storeUser(user)` | Store user object in localStorage |
| `clearStoredUser()` | Remove user and token from localStorage |
| `getToken()` | Get JWT token from localStorage |
| `getDashboardPathForRole(role)` | Get redirect path for role ('/staff-dashboard' or '/student-dashboard') |

---

## 10. API Endpoints

### 10.1 Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/auth/users` | Get list of all login accounts (public info only) | No |
| POST | `/api/auth/login` | Login user and get JWT token | No |

**POST /api/auth/login Request:**
```json
{
  "email": "admin@ikmb.edu.my",
  "password": "password123"
}
```

**POST /api/auth/login Response (Success):**
```json
{
  "message": "Login berjaya.",
  "user": {
    "email": "admin@ikmb.edu.my",
    "role": "admin",
    "displayName": "Admin IKMB",
    "studentId": null,
    "source": "mongodb-login"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 10.2 Student Data Endpoints

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| GET | `/api/students` | Get all students | Yes (JWT) | Admin |
| GET | `/api/students/:studentId` | Get specific student | Yes (JWT) | Admin |
| GET | `/api/students/:studentId/skill-gap` | Get skill gap analysis + AI prediction | Yes (JWT) | Admin |
| POST | `/api/students` | Add new student | Yes (JWT) | Admin only |
| PUT | `/api/students/:studentId` | Update student data | Yes (JWT) | Admin only |
| DELETE | `/api/students/:studentId` | Delete student | Yes (JWT) | Admin only |

### 10.3 System Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health check |

**GET /api/health Response:**
```json
{
  "status": "ok",
  "source": "mongodb-database"
}
```

### 10.4 ML Service Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `http://localhost:8000/` | ML service health check |
| POST | `http://localhost:8000/predict/risk` | Predict dropout risk |

**POST /predict/risk Request:**
```json
{
  "CGPA": 3.5,
  "Attendance": 95,
  "PLO_1": 80,
  "PLO_2": 75,
  "PLO_3": 82,
  "PLO_4": 78,
  "PLO_5": 85,
  "PLO_6": 70,
  "PLO_7": 88,
  "PLO_8": 90,
  "PLO_9": 76,
  "Sijil": "AWS Cloud"
}
```

**POST /predict/risk Response:**
```json
{
  "success": true,
  "prediction": "Cemerlang",
  "raw_output": "Cemerlang"
}
```

---

## 11. Machine Learning Integration

### 11.1 ML Model Details

| Property | Value |
|----------|-------|
| Algorithm | Random Forest Classifier |
| Framework | scikit-learn |
| Serialization | joblib |
| Input Features | CGPA, Attendance, PLO_1-9, Sijil |
| Output Classes | Bermasalah (High Risk), Sederhana (Moderate), Cemerlang (Low Risk) |

### 11.2 Prediction Flow

```
Frontend (StaffDashboard or StudentDashboard)
    │
    ▼
API Request to /api/students/:id/skill-gap
    │
    ▼
Express Backend (item.model.js)
    │
    ├── Fetch student from MongoDB
    ├── Normalize student data
    │
    ▼
Call ML API (http://127.0.0.1:8000/predict/risk)
    │
    ├── Send: CGPA, Attendance, PLO_1-9, Sijil
    │
    ▼
ML Service (ml.py)
    │
    ├── Load model from .pkl file
    ├── Transform features (Sijil → numeric)
    ├── Run model.predict()
    │
    ▼
Return: {success, prediction, raw_output}
    │
    ▼
Express Backend
    │
    ├── Map prediction to risk level
    ├── Build chart data (PLO metrics)
    ├── Generate AI insights
    │
    ▼
Return: {student, chart, insight}
    │
    ▼
Frontend renders radar chart and insights
```

### 11.3 Fallback Logic

If ML server is unavailable, `item.model.js` calculates risk locally:

| Condition | Risk Level |
|-----------|------------|
| Attendance < 80% OR CGPA < 2.0 | Tinggi (High) |
| CGPA >= 3.5 | Rendah (Low) |
| Status_Pelajar === 'Cemerlang' | Rendah (Low) |
| Otherwise | Sederhana (Moderate) |

### 11.4 Insight Generation

The system analyzes PLO scores to generate insights:

1. **Find Weakest Skill**: Identifies the PLO with the lowest score
2. **Calculate Gap**: `target (80) - current score`
3. **Generate Message**: Personalized recommendation based on gap size

| Gap Size | Priority |
|----------|----------|
| >= 20 points | Urgent attention required |
| < 20 points | Can be improved |

---

## 12. Frontend Pages

### 12.1 Login Page (`/`, Login.jsx)

**URL:** `/` (root path)

**Layout:** Split-screen design
- Left side (desktop only): Blue background with AI-themed image overlay
- Right side: Login form

**Features:**
- Email and password input fields
- Phosphor Icons for visual cues
- Pre-filled test credentials: `admin@ikmb.edu.my` / `password123`
- Error message display for failed login
- Loading state during login
- Automatic redirect after successful login

**Component Flow:**
```
User enters credentials → handleLogin() → POST /api/auth/login
    │
    ├── Success → storeUser(), setItem('ikmbToken'), navigate()
    └── Failure → setErrorMessage()
```

### 12.2 Staff Dashboard (`/staff-dashboard`, StaffDashboard.jsx)

**URL:** `/staff-dashboard`

**Access:** Admin role only (role = 'admin')

**Layout:** Sidebar + Main content area

**Sidebar Menu:**
1. Overview (Dashboard)
2. AI Prediction
3. Skills Gap Analysis
4. Learning Pathways
5. Student Management

**Tab 1: Overview**
- KPI Cards:
  - Total Students (from MongoDB)
  - Average Employability (calculated: CGPA + Attendance)
  - High Risk Students (attendance < 80% or CGPA < 2.0)
- Performance Trend Chart (Line chart, mock data for historical trends)
- High Risk Students List (clickable, navigates to StudentProfile)
- Top Performers List (sorted by CGPA)

**Tab 2-4:** Reserved for future development (placeholder content)

**Tab 5: Student Management**
- Table with all students
- CRUD operations with modal form
- Add/Edit/Delete student records
- Real-time data from MongoDB

**Student CRUD Modal:**
- ID Pelajar (disabled when editing)
- CGPA
- Kehadiran (%)
- Sijil Profesional (dropdown)
- Status Pelajar (dropdown)
- PLO 1-9 scores

### 12.3 Student Dashboard (`/student-dashboard`, StudentDashboard.jsx)

**URL:** `/student-dashboard`

**Access:** User role only (role = 'user')

**Layout:** Sidebar + Main content area

**Sidebar Menu:**
1. Profil & Prestasi (Profile & Achievement)
2. Padanan Kerjaya (Career Matching)
3. Kursus Cadangan (Recommended Courses)

**Tab 1: Profile & Achievement**
- KPI Cards:
  - Employability Prediction (calculated from CGPA + Attendance)
  - Average Attendance
  - Current CGPA (with Dean's List indicator)
- Risk Status Badge (Tinggi/Sederhana/Rendah)
- Skills Gap Radar Chart (PLO 1-9 vs Target 80)
- AI Insight Box (weakest skill recommendation)

**Tab 2: Career Matching**
- Course-based career recommendations
- Job cards with match percentage
- Company names and job titles
- Course-specific mapping (ITW, DFK, DGA, SLR, DCG, SED, PPU)

**Tab 3: Recommended Courses**
- Personalized course suggestions
- Three course cards with:
  - Course title and type
  - Duration and format
  - Description explaining why recommended
  - Call-to-action button

**Data Fetching:**
- Uses `getToken()` to include JWT in Authorization header
- Students can only see their own data (filtered by `studentId`)

### 12.4 Student Profile (`/student-profile`, StudentProfile.jsx)

**URL:** `/student-profile?id={student_id}`

**Access:** Admin role only

**Features:**
- Back button to Staff Dashboard
- Student info card with risk badge
- AI Employability Prediction (percentage display)
- Academic History Chart (Bar + Line mixed chart)
- Skills Radar Chart (PLO scores vs targets)
- Intervention Recommendations (Prescriptive Analytics)

**Intervention Cards:**
1. Counseling (for attendance issues)
2. Academic Clinic (for low scores)
3. Soft Skills Development (for communication skills)

---

## 13. Docker Deployment

### 13.1 Docker Compose Services

| Service | Image | Ports | Description |
|---------|-------|-------|-------------|
| mongodb | mongo:latest | 27017:27017 | MongoDB database |
| backend | Containerfile.backend | 5000:5000 | Express API server |
| frontend | Containerfile.frontend | 8080:80 | React app (Nginx) |
| ml-api | ML/Containerfile | 8000:8000 | FastAPI ML service |

### 13.2 Docker Workflow

```
┌─────────────────────────────────────────────────────────┐
│                    docker-compose up                     │
└─────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│  Build Containers                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │  backend    │ │  frontend   │ │   ml-api    │        │
│  │ (Node 20)   │ │  (Node 20   │ │ (Python 3.9)│        │
│  │             │ │  + Nginx)   │ │             │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
           │
           ▼
┌───────────────────��─────────────────────────────────────┐
│  Start Services                                         │
│  ┌────────┐  ┌──────────┐  ┌───────────┐  ┌─────────┐   │
│  │ MongoDB│  │ Backend  │  │ Frontend  │  │  ML API │   │
│  │ :27017 │  │  :5000   │  │   :8080   │  │  :8000  │   │
│  └────────┘  └──────────┘  └───────────┘  └─────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 13.3 Access URLs (Docker)

| Service | URL |
|---------|-----|
| Frontend | http://localhost:8080 |
| Backend API | http://localhost:5000 |
| ML API | http://localhost:8000 |
| MongoDB | localhost:27017 |

---

## 14. Course Codes & Certifications

### 14.1 Course Codes

| Code | Full Course Name (Malay) | Full Course Name (English) |
|------|--------------------------|---------------------------|
| ITW | Diploma Kompetensi Kimpalan | Welding Competency Diploma |
| DFK | Diploma Teknologi Komputer (Komputasi Awan) | Computer Technology Diploma (Cloud Computing) |
| DGA | Diploma Teknologi Automotif | Automotive Technology Diploma |
| SLR | Sijil Teknologi Kejuruteraan Mekanikal (Lukisan Rekabentuk) | Mechanical Engineering Technology Certificate (CAD Design) |
| DCG | Diploma Kompetensi Elektrik (Industri) | Industrial Electrical Competency Diploma |
| SED | Sijil Teknologi Kejuruteraan Elektrik (Domestik dan Industri) | Electrical Engineering Technology Certificate (Domestic & Industrial) |
| PPU | Diploma Teknologi Penyejukan dan Penyamanan Udara | Refrigeration and Air Conditioning Technology Diploma |

### 14.2 Career Mapping by Course

| Course | Top Career Paths |
|--------|------------------|
| ITW | Welding Technician 6G, Welding Inspector, Fabrication Supervisor |
| DFK | Cloud Infrastructure Engineer, Cloud Support Specialist, Junior DevOps Engineer |
| DGA | Service Advisor, Automotive Diagnostic Tech, Workshop Manager |
| SLR | CAD Drafter, Junior Design Engineer, 3D Modeler |
| DCG | Electrical Chargeman A0, Industrial Electrician, Control System Technician |
| SED | Wireman PW4, Electrical Maintenance, Building Electrician |
| PPU | HVAC Technician, ACMV Supervisor, Refrigeration Engineer |

### 14.3 Professional Certifications

| Certification | Score | Description |
|---------------|-------|-------------|
| Tiada | 35 | No certification |
| CompTIA | 70 | CompTIA IT certification |
| Cisco CCNA | 85 | Cisco Certified Network Associate |
| AWS Cloud | 90 | Amazon Web Services Cloud certification |

---

## 15. How to Run the Project

### 15.1 Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | 18+ | JavaScript runtime |
| MongoDB | 7+ | Database (local or Atlas) |
| Python | 3.9+ | ML service runtime |
| npm | Latest | Package manager |

### 15.2 Installation Steps

**Step 1: Install Node.js Dependencies**
```bash
npm install
```

**Step 2: Configure Environment Variables**
Create `.env` file in root directory:
```env
PORT=5001
MONGO_URI=mongodb://127.0.0.1:27017/ikmb-dashboard
JWT_SECRET=super_secret_tvetmara_fyp_key_2026
```

**Step 3: Seed Database (First Time Only)**
```bash
node seed.js
```
This will:
- Connect to MongoDB
- Load student data from `db/data_tvet_muktamad.json`
- Create Student records in MongoDB
- Create User accounts for each student

### 15.3 Running the Application

**Option 1: Development Mode (All Services Manually)**

Terminal 1: Start Express Backend
```bash
npm run start
# or: node server.js
# Backend runs on http://localhost:5001
```

Terminal 2: Start ML Service
```bash
cd ML
pip install -r requirements.txt
uvicorn ml:app --reload --port 8000
# ML service runs on http://localhost:8000
```

Terminal 3: Start Vite Dev Server
```bash
npm run dev
# Frontend runs on http://localhost:5173
```

**Option 2: Production Build**

```bash
npm run build
npm run start
```

**Option 3: Docker (All Services)**

```bash
docker-compose up -d
```

### 15.4 Access URLs (Development)

| Service | URL |
|---------|-----|
| Frontend (Vite Dev) | http://localhost:5173 |
| Frontend (Production) | http://localhost:8080 |
| Express API | http://localhost:5001 |
| ML API | http://localhost:8000 |
| MongoDB | localhost:27017 |

---

## 16. Default Login Credentials

### 16.1 Admin/Staff Accounts

| Email | Password | Role | Display Name |
|-------|----------|------|--------------|
| admin@ikmb.edu.my | password123 | admin | Admin IKMB |
| user@ikmb.edu.my | password123 | user | Default User |

### 16.2 Student Accounts (Dynamically Generated)

Student accounts are generated from the MongoDB `students` collection.

**Email Format:** `{ID_Pelajar}@student.ikmb.edu.my`

**Example:**
| Email | Password | Student ID |
|-------|----------|------------|
| TVET001@student.ikmb.edu.my | password123 | TVET001 |
| TVET002@student.ikmb.edu.my | password123 | TVET002 |
| tvet001@student.ikmb.edu.my | password123 | tvet001 |

**Password for all student accounts:** `password123`

### 16.3 Login Page Default Values

The login page pre-fills with:
- **Email:** admin@ikmb.edu.my
- **Password:** password123

---

## Additional Information

### Design System

| Element | Value |
|---------|-------|
| Font Family | Plus Jakarta Sans (Google Fonts) |
| Primary Color | Blue (#2563EB) |
| Layout | Card-based with sidebar navigation |
| Icons | Phosphor Icons (CDN) |
| Charts | Chart.js with react-chartjs-2 |

### Project Statistics

| Metric | Value |
|--------|-------|
| Student Data Fields | 17 |
| PLO Metrics | 9 |
| Status Categories | 3 (Bermasalah/Sederhana/Cemerlang) |
| Certification Types | 4 |
| Total Student Records | 15,000+ |
| Login Test Accounts | 260+ |
| Course Codes | 7 |
| Career Paths | 21+ |

### Key Dependencies (package.json)

**Production Dependencies:**
- react, react-dom (19.2.0)
- react-router-dom (7.13.1)
- chart.js (4.5.1), react-chartjs-2 (5.3.1)
- express (5.2.1)
- mongoose (9.3.3)
- jsonwebtoken (9.0.3)
- bcryptjs (3.0.3)
- cors (2.8.6)
- dotenv (17.3.1)

**Dev Dependencies:**
- vite (7.3.1)
- tailwindcss (3.4.19)
- autoprefixer, postcss
- eslint, eslint-plugin-react-hooks, eslint-plugin-react-refresh
- @eslint/js, globals

---

## Credits

This is a **Final Year Project (FYP)** demonstrating AI-enabled capabilities for TVET student management and analytics at **IKMB Besut** (Institut Kemahiran MARA Besut).

### Technologies Used

- **Frontend:** React.js, Vite, Tailwind CSS, Chart.js
- **Backend:** Node.js, Express.js, MongoDB, Mongoose
- **ML:** Python, FastAPI, scikit-learn, joblib
- **Icons:** Phosphor Icons
- **Deployment:** Docker, Docker Compose, Nginx

---

*Last Updated: April 2026*