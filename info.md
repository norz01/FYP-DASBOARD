# TVETMARA Besut Skills Talent Development Dashboard

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Features](#features)
5. [Architecture](#architecture)
6. [API Endpoints](#api-endpoints)
7. [Data Models](#data-models)
8. [Authentication](#authentication)
9. [Machine Learning Integration](#machine-learning-integration)
10. [Installation & Setup](#installation--setup)
11. [Running the Application](#running-the-application)
12. [Default Accounts](#default-accounts)
13. [Deployment](#deployment)

---

## Project Overview

**TVETMARA Besut Skills Talent Development Dashboard** is a smart analytics platform built for **TVETMARA Besut** (Institut Kemahiran Besut Malaysia) to monitor, predict, and develop student talents using AI-powered analytics.

### Purpose

The system is designed to:
- Track student academic performance (CGPA, attendance)
- Monitor skill development through Program Learning Outcomes (PLO 1-9)
- Predict dropout risk using Machine Learning
- Provide career pathway recommendations based on student skills
- Enable staff to manage student records through a comprehensive dashboard

### Key Features

- **AI-Powered Risk Prediction**: Uses ML model to predict student dropout risk
- **Skills Gap Analysis**: Radar chart visualization of PLO scores vs targets
- **Career Matching**: AI-suggested job opportunities based on course
- **Student Management**: CRUD operations for student records
- **Real-time Analytics**: Dynamic KPIs and dashboard metrics

---

## Technology Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| React 19 | UI Framework |
| Vite 7 | Build Tool |
| React Router DOM 7 | Client-side Routing |
| Tailwind CSS 3 | Styling |
| Chart.js 4 | Charts & Visualization |
| react-chartjs-2 | React Chart.js Wrapper |
| Phosphor Icons | Icon Library |

### Backend

| Technology | Purpose |
|------------|---------|
| Node.js | JavaScript Runtime |
| Express.js 5 | Web Framework |
| MongoDB | Database |
| Mongoose 9 | ODM (Object Data Modeling) |
| JWT | Authentication |
| bcryptjs | Password Hashing |
| cors | Cross-Origin Resource Sharing |

### ML Service

| Technology | Purpose |
|------------|---------|
| Python | ML Runtime |
| FastAPI | ML API Framework |
| scikit-learn | Machine Learning Library |
| joblib | Model Serialization |
| Pydantic | Data Validation |

---

## Project Structure

```
TVETMARA-Besut-Skills-Talent-Development-Dashboard/
|
├── ML/                           # Python ML Service
|   ├── ml.py                     # FastAPI ML prediction endpoints
|   ├── model_ai_risiko_lengkap_v2.pkl  # Trained ML model
|   ├── requirements.txt            # Python dependencies
|   └── Containerfile            # Docker build file
|
├── src/                          # React Frontend Source
|   ├── pages/
|   │   ├── Login.jsx             # Login page
|   │   ├── StaffDashboard.jsx     # Admin/Staff dashboard
|   │   ├── StudentDashboard.jsx   # Student dashboard
|   │   └── StudentProfile.jsx      # Individual student profile
|   ├── utils/
|   │   └── auth.js               # Auth utilities (token storage)
|   ├── App.jsx                  # Main app with routing
|   ├── main.jsx                  # Entry point
|   └── index.css                  # Global styles
|
├── models/                       # Mongoose Models
|   ├── User.js                  # User model (for login)
|   └── Student.js               # Student data model
|
├── middleware/
|   └── authMiddleware.js          # JWT verification middleware
|
├── backend/                     # Backend placeholder (empty)
|   └── package.json
|
├── db/                          # Database files
|   ├── data_tvet_muktamad.json   # Student data JSON
|   ├── sedut_mdb_tulen.py     # Data extraction script
|   ├── ekstrak_mdb.py        # Additional extraction
|   └── login_users.json       # Login users data
|
├── server.js                    # Express server entry point
├── auth.js                     # Authentication routes
├── auth.model.js               # Auth logic & user management
├── items.js                    # Student API routes
├── item.model.js                # Student CRUD & analytics
├── seed.js                    # Database seeding script
├── package.json                # Root package.json
├── compose.yml                # Docker Compose configuration
├── Containerfile.frontend      # Frontend container build
├── Containerfile.backend      # Backend container build
├── nginx.conf                # Nginx configuration
└── .env                     # Environment variables
```

---

## Features

### 1. Authentication System

- **Admin Login**: Full access to all features
- **Student Login**: Limited to own data only
- **JWT-based Session**: 8-hour token expiration
- **Role-based Access Control**: Admin vs User roles

### 2. Staff Dashboard (Admin)

- **Overview Tab**: KPI cards (total students, employability, high-risk count)
- **AI Prediction Tab**: Risk visualization
- **Skills Gap Tab**: PLO analysis charts
- **Learning Pathways Tab**: Course recommendations
- **Student Management Tab**: Add/Edit/Delete student records
- **Real Student Data**: Fetched from MongoDB
- **High Risk Alerts**: Automatic detection of at-risk students

### 3. Student Dashboard

- **Profile & Prestasi**: Personal stats (CGPA, attendance, employability)
- **Skills Gap Analysis**: Radar chart comparing PLO scores to industry targets
- **Career Matching**: AI-recommended job opportunities
- **Course Suggestions**: Personalized learning recommendations

### 4. Student Profile (Admin View)

- **Student Details**: Comprehensive student info
- **Academic History**: Trend charts
- **Radar Chart**: Visual skill gaps
- **Intervention Suggestions**: Prescriptive analytics

---

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BROWSER (CLIENT)                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐│
│  │    Login    │  │  Staff      │  │  Student    │  │   Student    ││
│  │   Page     │  │  Dashboard  │  │  Dashboard  │  │   Profile    ││
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────────┘│
└────────────────────────────────────────┬────────────────────────────────┘
                                         │ HTTP + JWT
                                         ▼
┌──────────────────────────────────────────────────────────���──────────────────┐
│                     EXPRESS.JS BACKEND (Port 5000)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  /api/auth │  │  /api/students  │  │  /api/health │  │                │ │
│  │  Routes   │  │  Routes   │  │  Endpoint   │  │                │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘ │
│        │                │                                           │    │
│        ▼                ▼                                           ▼    │
│  ┌─────────────┐  ┌─────────────────────────────────────────────┐    │
│  │  User      │  │  Student CRUD + AI Risk Prediction            │    │
│  │  Model     │  │  (Skill Gap Analysis + PLO Metrics)           │    │
│  └─────────────┘  └─────────────────────────────────────────────┘    │
│        │                                          │                    │
└────────┼──────────────────────────────────────────┼────────────────────┘
         │                                          │ POST /predict/risk
         ▼                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              MONGODB (Port 27017)                                 │
│  ┌──────────────────┐  ┌─────────────────────────────────────┐ │
│  │   users         │  │   students                           │ │
│  │   collection    │  │   collection                        │ │
│  └──────────────────┘  └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼ (Optional: ML Service, separate container)
┌─────────────────────────────────────────────────────────────────┐
│         ML SERVICE (FastAPI, Port 8000)                │
│  ┌─────────────────────────────────────────────┐   │
│  │  /predict/risk                              │   │
│  │  (Random Forest Model)                      │   │
│  └─────────────────────────────────────────────┘   │
│          ▲                                            │
│          │ Input: CGPA, Attendance, PLO 1-9, Sijil  │
└──────────┼───────────────────────────────────────────┘
```

### Data Flow

1. **Login Flow**:
   - User enters email/password
   - Backend verifies credentials
   - Returns JWT token + user role

2. **Dashboard Loading**:
   - Frontend requests student data with JWT
   - Backend queries MongoDB
   - Returns normalized student records

3. **Skill Gap Analysis**:
   - Frontend requests `/api/students/:id/skill-gap`
   - Backend fetches student data
   - Backend calls ML API for risk prediction
   - Returns metrics, charts, and AI insights

---

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth |
|--------|---------|------------|------|
| POST | `/api/auth/login` | User login | No |
| GET | `/api/auth/users` | Get public user list | No |

### Students

| Method | Endpoint | Description | Auth |
|--------|---------|------------|------|
| GET | `/api/students` | Get all students | Yes (JWT) |
| GET | `/api/students/:studentId` | Get student by ID | Yes (JWT) |
| GET | `/api/students/:studentId/skill-gap` | Get skill gap analysis | Yes (JWT) |
| POST | `/api/students` | Create student | Yes (JWT, Admin) |
| PUT | `/api/students/:studentId` | Update student | Yes (JWT, Admin) |
| DELETE | `/api/students/:studentId` | Delete student | Yes (JWT, Admin) |

### Health Check

| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/health` | Server health status |

### ML Service

| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/` | ML service health |
| POST | `/predict/risk` | Predict dropout risk |

---

## Data Models

### User Model (`models/User.js`)

```javascript
{
  email: String,          // Required, Unique
  password: String,      // Required, Hashed
  role: String,         // 'admin' or 'user'
  displayName: String,
  studentId: String    // Reference to student (nullable)
}
```

### Student Model (`models/Student.js`)

```javascript
{
  ID_Pelajar: String,
  Nama: String,
  Kursus: String,      // Course code (e.g., 'DFK', 'ITW')
  Semester: Number,
  Kehadiran_Pct: String,
  CGPA: String,
  Sijil_Profesional: String,  // Professional certification
  PLO_1 to PLO_9: String, // Program Learning Outcomes
  Status_Pelajar: String     // Student status
}
```

### Normalized Student Data (API Response)

```javascript
{
  id: String,
  nama: String,
  kursus: String,
  semester: Number,
  attendance: Number,
  cgpa: Number,
  anugerah: Boolean,
  kokoLulus: Boolean,
  plo1-plo9: Number,
  certification: String,
  certificationScore: Number,
  dropoutRisk: String,  // 'Tinggi', 'Sederhana', 'Rendah'
  careerStatus: String
}
```

### Skill Gap Response

```javascript
{
  student: { /* normalized student data */ },
  chart: {
    labels: ['PLO 1', 'PLO 2', ..., 'PLO 9'],
    current: [/* actual scores */],
    target: [/* target scores */]
  },
  insight: {
    weakestSkill: String,
    message: String
  }
}
```

---

## Authentication

### Login Process

1. User submits email + password to `/api/auth/login`
2. Backend searches merged user database:
   - Users collection (MongoDB)
   - Students collection (dynamically generated accounts)
3. For students: password comparison (plain text: `password123`)
4. For admin users: bcrypt comparison
5. On success: returns JWT token (8h expiration)

### Token Verification

- Token sent in Authorization header: `Bearer <token>`
- Middleware verifies JWT signature using `JWT_SECRET`
- Token payload contains: `email`, `role`, `studentId`

### Role-based Access

| Role | Routes Accessible |
|------|------------------|
| admin | All routes + CRUD |
| user | Read-only, own data only |

---

## Machine Learning Integration

### ML Model

- **Algorithm**: Random Forest Classifier
- **Purpose**: Predict student dropout risk
- **Input Features**:
  - CGPA (0.0 - 4.0)
  - Attendance (0% - 100%)
  - PLO 1-9 Scores (0 - 100)
  - Sijil (Professional Certification)

### Prediction Output

| Prediction | Risk Level |
|------------|------------|
| Bermasalah | Tinggi (High) |
| Sederhana | Sederhana (Medium) |
| Cemerlang | Rendah (Low) |

### AI Insight Generation

The system analyzes PLO scores to find:
1. **WeakestSkill**: Lowest scoring PLO
2. **Message**: Personalized recommendation
3. **Priority**: Based on gap size (20%+ gap = urgent)

---

## Installation & Setup

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Python 3.9+ (for ML service)
- npm or yarn

### Environment Variables

Create `.env` file:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/ikmb-dashboard
JWT_SECRET=your_secret_key_here
```

### Install Dependencies

```bash
npm install
```

### Seed Database

```bash
npm run seed
# Or:
node seed.js
```

This will:
1. Connect to MongoDB
2. Read student data from `db/data_tvet_muktamad.json`
3. Create Student records
4. Create User accounts for each student

---

## Running the Application

### Development Mode

**Start Backend + Frontend:**

```bash
npm run dev
```

- Frontend runs on: `http://localhost:5173`
- Backend runs on: `http://localhost:5000`

**Start ML Service (separate terminal):**

```bash
cd ML
python ml.py
```

- ML API runs on: `http://localhost:8000`

### Production Build

```bash
npm run build
```

Output in `dist/` folder.

### Start Production Server

```bash
npm run start
# Or:
node server.js
```

---

## Default Accounts

### Admin Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@ikmb.edu.my | password123 | admin |
| user@ikmb.edu.my | password123 | user |

### Student Accounts

Student accounts are dynamically generated from the database:
- **Format**: `<student_id>@student.ikmb.edu.my`
- **Password**: `password123`

Example:
- Email: `ikm001@student.ikmb.edu.my`
- Password: `password123`

### Login Page Default Values

The login page pre-fills with:
- Email: `admin@ikmb.edu.my`
- Password: `password123`

---

## Deployment (Docker Compose)

### Services

| Service | Port | Description |
|---------|------|-------------|
| mongodb | 27017 | MongoDB database |
| backend | 5000 | Express API |
| frontend | 8080 | React app (nginx) |
| ml-api | 8000 | FastAPI ML service |

### Build & Run

```bash
# Build all containers
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Access URLs

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:5000`
- ML API: `http://localhost:8000`

---

## Course Codes

| Code | Full Course Name |
|------|---------------|
| ITW | Diploma Kompetensi Kimpalan |
| DFK | Diploma Teknologi Komputer (Komputasi Awan) |
| DGA | Diploma Teknologi Automotif |
| SLR | Sijil Teknologi Kejuruteraan Mekanikal (Lukisan Rekabentuk) |
| DCG | Diploma Kompetensi Elektrik (Industri) |
| SED | Sijil Teknologi Kejuruteraan Elektrik (Domestik dan Industri) |
| PPU | Diploma Teknologi Penyejukan dan Penyamanan Udara |

---

## Professional Certifications

| Certification | Score |
|---------------|-------|
| Tiada | 35 |
| CompTIA | 70 |
| Cisco CCNA | 85 |
| AWS Cloud | 90 |

---

## Key Files Explained

### `server.js` - Entry Point
- Express app setup
- MongoDB connection
- Route registration
- Health check endpoint

### `auth.js` - Auth Routes
- Login endpoint
- User list endpoint

### `auth.model.js` - Auth Logic
- User merging (MongoDB + Student DB)
- Password verification
- JWT token generation

### `items.js` - Student Routes
- CRUD endpoints
- Skill gap analysis endpoint
- Admin-only routes protection

### `item.model.js` - Student Logic
- Student CRUD operations
- PLO metrics calculation
- AI prediction integration
- Insight generation

### `src/App.jsx` - Main React App
- Route definitions
- Protected routes
- Role-based redirects

### `src/pages/StaffDashboard.jsx` - Admin Dashboard
- Tab-based navigation
- Student management CRUD
- Real-time data fetching
- Interactive charts

### `src/pages/StudentDashboard.jsx` - Student Dashboard
- Radar chart visualization
- Career recommendations
- Skills gap display

### `src/pages/StudentProfile.jsx` - Student Detail View
- Individual student analysis
- Intervention suggestions
- Comprehensive charts

---

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Check MongoDB is running
   - Verify `MONGO_URI` in `.env`

2. **JWT Token Expired**
   - Re-login to get new token
   - Default expiration: 8 hours

3. **ML Prediction Failed**
   - Check ML service is running on port 8000
   - Model file exists in ML folder

4. **CORS Errors**
   - Ensure `cors` middleware is loaded
   - Configure allowed origins in production

---

## License

ISC License

---

## Credits

- **TVETMARA Besut** - Institut Kemahiran Besut Malaysia
- **AI Model**: Trained using scikit-learn Random Forest
- **Icons**: Phosphor Icons
- **Charts**: Chart.js

---

*Last Updated: April 2026*