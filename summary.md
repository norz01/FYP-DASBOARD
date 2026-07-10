# TVETMARA Besut Skills Talent Development Dashboard
## Project Summary

---

## 1. Project Overview

**TVETMARA Besut** is a Final Year Project (FYP) that builds a **Smart Skills & Talent Development Dashboard** for TVETMARA Institut Kemahiran Mara Besut (IKMB). The system is designed to monitor, predict, and develop student talent using **Artificial Intelligence (Machine Learning)** analytics. It enables administrators (staff/penyelaras) to manage student data, view AI-driven predictions on student dropout risk, perform skills gap analysis, and recommend personalized learning pathways and career matches for students.

The application is built using a **MERN stack** (MongoDB, Express.js, React.js, Node.js) with a separate **Python FastAPI ML service** integrated to provide intelligent predictions.

---

## 2. Technology Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React.js | 19.x | User Interface framework |
| React Router DOM | 7.x | Client-side routing and navigation |
| Vite | 7.x | Build tool and development server |
| Tailwind CSS | 3.x | Utility-first CSS styling |
| PostCSS + Autoprefixer | — | CSS processing and vendor prefixing |
| Chart.js | 4.x + react-chartjs-2 | Data visualization (Bar, Radar charts) |
| Phosphor Icons | — | Icon library (loaded via CDN in `index.html`) |
| Vitest + Testing Library | 4.x | Frontend testing |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Express.js | 5.x | REST API server framework |
| Node.js | — | JavaScript runtime |
| MongoDB | — | Database |
| Mongoose | 9.x | MongoDB ODM (Object Document Mapper) |
| JWT (jsonwebtoken) | 9.x | User authentication via tokens |
| bcryptjs | 3.x | Password hashing |
| cors | 2.x | Cross-Origin Resource Sharing |
| Swagger UI | — | Interactive API documentation |
| Jest + Supertest | — | Backend API testing |

### ML Service
| Technology | Version | Purpose |
|---|---|---|
| FastAPI | — | Python REST API framework |
| Uvicorn | — | ASGI web server |
| scikit-learn | — | Machine learning library (RandomForestClassifier) |
| joblib | — | Model serialization and loading |
| Pydantic | — | Data validation |
| pandas | — | Data manipulation |
| numpy | — | Numerical computing |
| pytest | — | ML service testing |

### DevOps / Deployment
| Technology | Purpose |
|---|---|
| Docker Compose | Multi-container orchestration |
| Nginx | Reverse proxy and static file serving |
| GitHub Actions | CI/CD automation |
| Containerfile (Dockerfile) | Frontend + ML service Docker images |

---

## 3. Project Architecture

The system is split into three independent services that communicate over HTTP:

```
┌──────────────────────────────────────────────────────────┐
│                     NGINX (Port 80)                       │
│  - Serves React static files                              │
│  - Proxies /api/* to Backend                              │
└────────────────────┬─────────────────────────────────────┘
                     │
        ─────────────┼─────────────
        │            │            │
   ┌────▼────┐  ┌──▼───┐  ┌────▼────┐
   │Frontend │  │Backend│  │ ML API  │
   │React    │  │Express│  │ FastAPI │
   │(Vite)   │  │MongoDB│  │(Python) │
   │Port 80  │  │Port5k │  │Port 8000│
   └─────────┘  └──▲───┘  └─────────┘
                  │
           ┌──────▼──────────┐
           │   MongoDB       │
           │   (Database)    │
           └─────────────────┘
```

---

## 4. Frontend Application (`src/`)

### 4.1 Entry Point
- **`src/main.jsx`**: Bootstraps the React application using `StrictMode`, mounts it to the DOM element with `id="root"`, and imports the global CSS.
- **`src/App.jsx`**: The main application component that sets up routing via `BrowserRouter` and `Routes`.

### 4.2 Routing Structure

| Path | Component | Access |
|---|---|---|
| `/` | `Login` | Public (redirects to dashboard if already logged in) |
| `/staff-dashboard` | `StaffDashboard` | Admin only (`role: admin`) |
| `/student-dashboard` | `StudentDashboard` | Student only (`role: user`) |
| `/student-profile` | `StudentProfile` | Admin only (`role: admin`) |

A **`ProtectedRoute`** wrapper is used to enforce role-based access control. It reads the stored user from `localStorage` and either redirects to the appropriate dashboard or denies access.

### 4.3 Authentication Utility (`src/utils/auth.js`)

| Function | Purpose |
|---|---|
| `getStoredUser()` | Reads user data from `localStorage` key `ikmbCurrentUser` |
| `storeUser(user)` | Saves user object to `localStorage` |
| `clearStoredUser()` | Removes user data and token from `localStorage` on logout |
| `getToken()` | Returns the JWT token stored at `ikmbToken` |
| `getDashboardPathForRole(role)` | Maps `admin` → `/staff-dashboard`, `user` → `/student-dashboard` |

### 4.4 Pages

#### 4.4.1 Login Page (`src/pages/Login.jsx` — 135 lines)
- **Purpose**: Entry point for all users. Renders a split-screen design with an AI-themed banner on the left (desktop) and a login form on the right.
- **Features**:
  - Pre-filled demo accounts are shown in a hint paragraph for easy testing
  - Form fields: email (type `email`) and password (type `password`)
  - On submission, sends a POST request to `/api/auth/login`
  - On success: stores user data and JWT token in `localStorage`, then navigates to the appropriate dashboard using `getDashboardPathForRole()`
  - On failure: displays an error message in a red alert box
  - Uses Phosphor icons for envelope, lock, and brain imagery

#### 4.4.2 Staff Dashboard (`src/pages/StaffDashboard.jsx` — 309 lines)
- **Purpose**: Administrative dashboard for staff/penyelaras. Contains five major sub-sections accessed via a side navigation tab system.

**Tabs:**

1. **Overview Dashboard** (`activeTab: "overview"`)
   - Three KPI Cards: Total Active Students, Average Employability Score (%), High-Risk Student Count
   - Bar Chart: Average PLO scores vs Institutional Target (80%) across all 9 PLOs — rendered using Chart.js `react-chartjs-2`
   - Two side-by-side panels:
     - **High-Risk Students** (red zone): Lists up to 5 students with low attendance (<80%) or low CGPA (<2.0). Each is clickable to view their profile.
     - **Top Performers** (yellow zone): Lists the top 5 students by CGPA, showing their employability percentage and award status.
   - Both lists navigate to `/student-profile?id={studentId}` when clicked.

2. **AI Manual Prediction** (`activeTab: "prediction"`)
   - A form allowing staff to manually input student features (CGPA, attendance %, certification type, all 9 PLO scores)
   - "Jana Ramalan AI" button sends these features to `/api/predict/manual`
   - The ML service returns a prediction (Rendah / Sederhana / Tinggi) which is displayed with a color-coded badge

3. **Skills Gap Analysis** (`activeTab: "skills"`)
   - A table showing each PLO (1-9), the institute average score, the gap vs target (80%), and a status badge:
     - **Selamat** (≥80%)
     - **Perlu Peningkatan** (60-79%)
     - **Kritikal** (<60%)

4. **Learning Pathways** (`activeTab: "pathways"`)
   - Displays recommended course/workshop cards based on the PLO skills with the largest gaps
   - Each card shows the PLO name, the gap percentage, and the mapped real-world workshop/training path (e.g., PLO 1 → "Kursus Komunikasi Efektif")
   - Mappings are defined in a `pathwayMappings` object within the component

5. **Student Management** (`activeTab: "management"`)
   - A searchable, sortable table of all students with columns: ID, CGPA, Attendance, Dropout Risk status, Actions
   - **Add Student**: Opens a modal (`StudentModal`) to create a new student record (ID_Pelajar, Nama, CGPA, Kehadiran, Sijil, Kursus, Status)
   - **Edit Student**: Pre-fills the modal with existing data and updates via PUT `/api/students/:studentId`
   - **Delete Student**: Sends DELETE `/api/students/:studentId` with a browser confirm dialog
   - CRUD operations require JWT token in the `Authorization: Bearer <token>` header

#### 4.4.3 Student Dashboard (`src/pages/StudentDashboard.jsx` — 252 lines)
- **Purpose**: Personalized dashboard for logged-in students. Restricted to show only the logged-in student's own data via a security filter.
- **Tabs:**

1. **Profil & Prestasi** (`activeTab: "dashboard"`)
   - Welcome header with student display name (from `localStorage`)
   - Risk status badge (green/yellow/red) based on `dropoutRisk`
   - Three stat cards: Employability Score (%), Average Attendance (%), Current CGPA
   - **Radar Chart**: Visualizes the student's 9 PLO scores against the 80% target using `Radar` from react-chartjs-2
   - An AI insight text box that describes the weakest skill and recommended action
   - Career opportunity preview panel (dark-themed card) showing the top 2 job matches for the student's course, with AI match percentage

2. **Padanan Kerjaya (AI)** (`activeTab: "career"`)
   - Displays job recommendation cards based on the student's enrolled course (`kursus` field)
   - Hardcoded `careerMapping` dictionary maps 7 course codes (ITW, DFK, DGA, SLR, DCG, SED, PPU) to realistic Malaysian industry job titles
   - Each `JobCard` shows: job title, company, AI match percentage (%), and a "Mohon Sekarang" button

3. **Kursus Cadangan** (`activeTab: "courses"`)**
   - Shows personalized course recommendations based on the student's weakest PLO
   - A main "Recommended by AI" course card is dynamically selected based on `weakestPlo`
   - A secondary static card for "AWS Cloud Practitioner Essentials" is always shown

#### 4.4.4 Student Profile Page (`src/pages/StudentProfile.jsx` — 289 lines)
- **Purpose**: Detailed profile view for a single student, accessible via `/student-profile?id={studentId}`
- **Features**:
  - Navigation back button to return to the staff dashboard
  - Large avatar circle (colored by risk level: green/yellow/red)
  - Student details: Name, student ID, course, semester, certification, attendance
  - Badges for awards (`anugerah`) and apprenticeship completion (`kokoLulus`)
  - **AI Insight Card**: Shows employability score as a large number with a progress bar and descriptive insight message
  - **Bar + Line Combo Chart**: Shows semester-by-semester CGPA trend (line) and attendance (bars) from `academicHistory` data
  - **Radar Chart**: Individual skill gap visualization for the 9 PLOs. Shows a warning if PLO scores are all zero (data incomplete).
  - **Prescriptive Analytics Section**: Three numbered intervention cards (attendance counseling, academic clinic, soft skills development) with actionable buttons — representing the final layer of analytics (prescriptive/prescribing specific interventions)

### 4.5 Components

#### `src/components/Sidebar.jsx` (48 lines)
- A fixed left sidebar that appears on all dashboards
- Displays the TVETMARA logo, navigation buttons, and a user profile card at the bottom with initials, display name, role label (Penyelaras or Pelajar), and a logout button
- Responsive: collapses off-screen on mobile with a slide-in animation; always visible on desktop (`md:relative md:translate-x-0`)
- Accepts props for `navItems`, `activeTab`, `setActiveTab`, `isSidebarOpen`, `currentUser`, and `handleLogout`

#### `src/components/KpiCard.jsx` (19 lines)
- A reusable KPI card with icon, title, value, optional subtitle, and a colored progress bar
- Parametrized via props: `title`, `value`, `isLoading`, `icon`, `iconBg`, `iconColor`, `barColor`, `barWidth`, `subtitle`
- Used in StaffDashboard's overview section for the three top KPIs

#### `src/components/StudentModal.jsx` (63 lines)
- A modal dialog for adding/editing student records
- Form fields with 2-column grid layout: ID Pelajar, Nama, CGPA, Kehadiran (%), Sijil Profesional, Kursus, Status Pelajar
- On submit: calls the appropriate API (POST or PUT) with JWT auth
- The student ID field is disabled when editing (to prevent ID changes)
- Cancel and Simpan (Save) buttons at the bottom

#### `src/components/JobCard.jsx` (21 lines)
- A card component displaying a job recommendation
- Shows: company icon (Phosphor), match percentage badge, job title, company name, and "Mohon Sekarang" button
- Hover effects lift the card and change icon background to blue

### 4.6 Global Styles (`src/index.css`)
- Imports the **Plus Jakarta Sans** font from Google Fonts
- Imports Tailwind CSS directives (`@tailwind base`, `@tailwind components`, `@tailwind utilities`)
- `tailwind.config.js` configures Plus Jakarta Sans as the default sans-serif font family

### 4.7 Vite Configuration (`vite.config.js`)
- Uses `@vitejs/plugin-react`
- Configures a **dev proxy**: the frontend dev server proxies all `/api` requests to the Express backend (default port 5000, configurable via `PORT` env var)
- Configures Vitest test environment: `jsdom`, `globals: true`, test files pattern `src/**/*.test.{js,jsx}` (strictly frontend only)

---

## 5. Backend Application (`backend/`)

### 5.1 Server Entry (`backend/server.js` — 75 lines)
- Uses `Express.js` as the application framework
- Middleware: `cors()` (all origins), `express.json()` (body parsing)
- **Swagger/OpenAPI** documentation available at `/api/docs` using `swagger-jsdoc` and `swagger-ui-express`
- Swagger definitions are pulled from `auth.js` and `items.js` route files
- MongoDB connection established at startup (skipped when `NODE_ENV=test`)
- Health check endpoint: `GET /api/health`
- Mounts:
  - `/api/auth` → `authRouter`
  - `/api` → `itemsRouter`
- Test environment: does NOT start listening (exported as plain `app` for Supertest)

### 5.2 Authentication Routes (`backend/auth.js` — 76 lines)

| Endpoint | Method | Description | Auth Required |
|---|---|---|---|
| `/api/auth/users` | GET | Returns all users (sanitized — no passwords) | No |
| `/api/auth/login` | POST | Authenticates user, returns JWT + user data | No |

**Login Flow:**
1. Receives `email` and `password` in request body
2. Calls `authenticateUser(email, password)` from `auth.model.js`
3. Uses `bcrypt.compare()` to verify the hashed password
4. On success: issues a JWT token expiring in **8 hours** containing `{ email, role, studentId }`
5. Returns `{ message, user: { email, role, displayName, studentId }, token }`

### 5.3 Student & Prediction Routes (`backend/items.js` — 250 lines)

All endpoints under `/api` require a valid JWT via the `verifyToken` middleware.

| Endpoint | Method | Description | Allowed Roles |
|---|---|---|---|
| `/api/students` | GET | Returns all students | Any authenticated |
| `/api/students` | POST | Creates new student | Admin only |
| `/api/students/:studentId` | PUT | Updates student | Admin only |
| `/api/students/:studentId` | DELETE | Deletes student | Admin only |
| `/api/students/:studentId` | GET | Returns single student by ID | Any authenticated |
| `/api/students/:studentId/skill-gap` | GET | Returns skill gap data + AI insight | Any authenticated |
| `/api/predict/manual` | POST | Runs AI prediction on manual input | Admin only |

### 5.4 Middleware (`backend/middleware/authMiddleware.js` — 20 lines)
- `verifyToken` middleware extracts the JWT from `Authorization: Bearer <token>` header
- Verifies token using `process.env.JWT_SECRET`
- Attaches decoded user info to `req.user` (contains `email`, `role`, `studentId`)
- Returns 403 if no token, 401 if invalid/expired

### 5.5 Data Models

**User Model** (`backend/models/User.js`):
```javascript
{
  email:       String (required, unique),
  password:    String (required, bcrypt hashed),
  role:        String (enum: 'admin' | 'user', default: 'user'),
  displayName: String,
  studentId:   String (nullable)
}
```

**Student Model** (`backend/models/Student.js`):
```javascript
{
  ID_Pelajar:        String,
  Nama:              String,
  Kursus:            String (e.g. ITW, DFK, DGA, SLR, DCG, SED, PPU),
  Semester:          Number,
  Kehadiran_Pct:     String (attendance percentage),
  CGPA:              String,
  Sijil_Profesional: String (professional certification: Tiada, CompTIA, Cisco CCNA, AWS Cloud),
  PLO_1 to PLO_9:    String (Program Learning Outcome scores 0-100),
  Status_Pelajar:    String (Bermasalah / Sederhana / Cemerlang),
  academicHistory: [ { semester: Number, cgpa: String, attendance: String } ]
}
```

### 5.6 Core Business Logic (`backend/item.model.js` — 187 lines)

**`normaliseStudent(record)`** — Transforms raw MongoDB Student documents into a clean frontend-ready format:
- Computes `dropoutRisk` based on attendance, CGPA, and `Status_Pelajar`:
  - **Tinggi (High Risk)**: Attendance < 80% OR CGPA < 2.0
  - **Rendah (Low Risk)**: CGPA ≥ 3.5 OR Status_Pelajar === 'Cemerlang'
  - **Sederhana (Medium)**: Default
- Maps `Bermasalah → Tinggi`, `Sederhana → Sederhana`, `Cemerlang → Rendah` as a baseline
- Assigns a `certificationScore` based on the held certification
- Preserves `academicHistory` for trend charts on the profile page

**`buildMetrics(student)`** — Creates an array of 9 objects `{ label: 'PLO 1'..'PLO 9', value: number, target: 80 }`

**`buildInsight(metrics, student)`** — Generates an AI insight text:
- Identifies the weakest PLO skill
- If any PLO is 0%, warns that data is incomplete
- Describes how urgently the student needs improvement based on the gap size

**`getRealAIPrediction(features)`** — The bridge to the ML service:
- Sends a POST request to `http://127.0.0.1:8000/predict/risk` with all student features
- The ML service's prediction output uses labels `Bermasalah / Sederhana / Cemerlang`, which are mapped to the dashboard's internal labels `Tinggi / Sederhana / Rendah`
- **Fallback logic**: If the ML service is unreachable, a rule-based prediction is returned:
  - Attendance < 80% or CGPA < 2.0 → `Tinggi`
  - CGPA ≥ 3.5 → `Rendah`
  - Otherwise → `Sederhana`

**`getStudentSkillGapById(studentId)`** — The most important read endpoint:
1. Fetches the student from MongoDB
2. Calls `getRealAIPrediction(student)` to get the true AI-predicted risk (overwrites the stored risk)
3. Builds PLO metrics
4. Returns `{ student, chart: { labels, current, target }, insight: buildInsight(...) }`

### 5.7 Database Seeding (`backend/seed.js` — 92 lines)
- Reads the canonical student data from `./db/data_tvet_muktamad.json`
- **Clears existing data** before seeding (to avoid plain-text password conflicts)
- Hashes `password123` with bcrypt (salt rounds: 10) — every seeded user gets this password
- Creates Student records for each student in the JSON
- Creates User (login) records for each student: email format `{ID_Pelajar}@student.ikmb.edu.my`, role: `user`
- Adds a default **Admin** account (`admin@ikmb.edu.my`, role: `admin`)
- Adds a default **Test User** (`user@ikmb.edu.my`, role: `user`)

### 5.8 Environment Variables (`backend/.env.example`)
```
PORT=5001
MONGO_URI=mongodb://127.0.0.1:27017/ikmb-dashboard
JWT_SECRET=your_secret_key_here
```
In Docker Compose, the backend uses `MONGO_URI=mongodb://mongodb:27017/ikmb-dashboard` (Docker internal DNS).

---

## 6. ML Service (`ML/`)

### 6.1 API Server (`ML/ml.py` — 74 lines)
- A FastAPI application titled "TVETMARA AI Prediction API V3"
- Loads a pre-trained **RandomForestClassifier** model from `model_ai_risiko_lengkap_v3.pkl` using `joblib`
- Models V1, V2, and V3 are all bundled (V3 is the production model)

**Endpoint:**

| Endpoint | Method | Input | Output |
|---|---|---|---|
| `/predict/risk` | POST | `StudentFeatures` (CGPA, Attendance, PLO_1-9, Sijil) | `{ success, prediction, raw_output }` |

**Prediction Pipeline:**
1. Receives 14 input features via the Pydantic model `StudentFeatures`
2. Calculates two **engineered features**:
   - `PLO_Avg`: mean of all 9 PLO values
   - `PLO_Variance`: variance of all 9 PLO values
3. Constructs a pandas DataFrame with exactly the feature columns the model was trained on (using `feature_names_in_` for dynamic column ordering)
4. Maps the API field `Attendance` → the training column name `Avg_Subjek_Attendance` internally
5. Passes the feature vector to `risk_model.predict()` which returns a string: `"Bermasalah"`, `"Sederhana"`, or `"Cemerlang"`
6. The backend then maps these labels to the dashboard labels: `Bermasalah → Tinggi`, `Sederhana → Sederhana`, `Cemerlang → Rendah`

**Prediction Labels:**
| ML Output | Dashboard Label | Meaning |
|---|---|---|
| `Cemerlang` | **Rendah** | Low dropout risk — student is thriving |
| `Sederhana` | **Sederhana** | Medium risk — needs monitoring |
| `Bermasalah` | **Tinggi** | High risk — needs intervention |

### 6.2 Model Training (`ML/train_and_evaluate.py` — 62 lines)
- Loads real training data from `../backend/db/ml_training_data_real.csv`
- Feature engineering: adds `PLO_Avg` and `PLO_Variance`
- Uses `RandomForestClassifier` with `GridSearchCV` hyperparameter tuning (5-fold cross-validation, F1-weighted scoring)
- Hyperparameters searched: `n_estimators` [100,200,300], `max_depth` [None, 10, 20], `min_samples_split` [2,5,10], `class_weight` ['balanced', None]
- Prints classification report, accuracy, and confusion matrix
- Saves the best model as `model_ai_risiko_lengkap_v3.pkl`

### 6.3 ML Tests (`ML/test_ml.py` — 33 lines)
- **`test_health_check`**: Ensures the root endpoint returns status `"AI Server V3 is running"` with HTTP 200
- **`test_predict_risk_valid_data`**: Sends a strong student payload (CGPA 3.9, perfect attendance, 95% in all PLOs) and asserts the prediction is one of the three valid labels
- **`test_predict_risk_invalid_data`**: Sends an incomplete payload (missing PLO fields) and asserts HTTP 422 (Unprocessable Entity) due to Pydantic validation

### 6.4 ML Requirements (`ML/requirements.txt`)
```
fastapi
uvicorn
scikit-learn
joblib
pydantic
pandas
numpy
```

### 6.5 ML Docker (`ML/Containerfile`)
- Base image: `python:3.9-slim`
- Runs `pip install` from `requirements.txt`
- Copies the entire ML directory (including `.pkl` model files)
- Exposes port 8000
- Runs `uvicorn ml:app --host 0.0.0.0 --port 8000`

---

## 7. Database Design

### 7.1 MongoDB Collections

**`users` collection** (stores login credentials):
- Created by `seed.js` from `data_tvet_muktamad.json`
- Passwords are always stored bcrypt-hashed (never plain text)
- Each student gets a user entry at email `{studentId}@student.ikmb.edu.my`

**`students` collection** (stores academic data):
- Each document maps to a TVETMARA student
- Contains personal info, academic metrics, PLO scores, and academic history
- Indexed by `ID_Pelajar` (the unique student identifier)

### 7.2 Pre-built Seed Data
- `data_tvet_muktamad.json`: The canonical dataset with real student records (the cleaned/final version of the raw MDB extract). This is the primary source for `seed.js`.
- `data_tvet.json`: An earlier version of the dataset (kept for historical reference; `.gitignore`d).

---

## 8. Data Pipeline: From MDB to Dashboard

The project includes a complete ETL pipeline that transforms raw Microsoft Access (.mdb) files into a structured MongoDB database ready for the ML model:

### Step 1: Extract (`backend/db/ekstrak_mdb.py` / `sedut_mdb_tulen.py`)
- Uses `mdb-export` (from the `mdbtools` Linux package) to extract tables from the raw `Ekspot_Senat.mdb` file into CSV files:
  - `pelajar.csv` (student roster)
  - `Daftar_Subjek.csv` (enrollment/subject records)
  - `GPA.csv` (grade point history)
  - `Detail_Result.csv` (exam results with PLO codes)
  - `Anugerah.csv` (awards)

### Step 2: Prepare ML Data (`backend/db/prepare_ml_data.py` — 122 lines)
1. Merges all 5 CSV tables using `No_Pelajar` (student ID) as the join key
2. Calculates aggregate features from `Daftar_Subjek`: total credits, average subject attendance, average marks, failed courses, dropped courses
3. Calculates `PLO_Avg` and `PLO_Variance` from PLO scores
4. Determines the latest CGPA per student from the `GPA` table
5. Generates **realistic ground-truth labels** using a score-based heuristic (combining CGPA, attendance, PLO performance, failures) with added noise to mimic real-world data
6. Saves the processed dataset to `ml_training_data_real.csv` for model training

### Step 3: Build Academic History (`backend/db/extract_history.py` — 66 lines)
- Joins `GPA.csv` and `Daftar_Subjek.csv` by `No_Pelajar` and semester
- Filters out zero-attendance records (subjects not yet attended)
- For each student, builds a semester-by-semester history of CGPA and attendance
- Writes this `academicHistory` array back into `data_tvet_muktamad.json` so `seed.js` will import it into MongoDB

### Step 4: Seed to MongoDB (`npm run seed` in backend)
- `seed.js` reads `data_tvet_muktamad.json` (now with academic history embedded) and populates the `students` and `users` collections in MongoDB

### Step 5: Train ML Model (`ML/train_and_evaluate.py`)
- Reads `ml_training_data_real.csv`
- Trains a `RandomForestClassifier` with grid-searched hyperparameters
- Serializes the best model to `model_ai_risiko_lengkap_v3.pkl`

### Step 6: Serve Predictions (`ML/ml.py`)
- Loads `model_ai_risiko_lengkap_v3.pkl` at server start
- Accepts live student feature inputs from the Express backend
- Returns real-time dropout risk predictions

---

## 9. CI/CD Pipeline (`.github/workflows/ci.yml`)

The GitHub Actions workflow runs on every push or PR to `main`/`master` and consists of 4 sequential jobs:

### Job 1: Frontend Test & Build
- Sets up Node.js 20
- Installs root `package.json` dependencies
- Runs `npm test` (Vitest)
- Runs `npm run build` (Vite production build)

### Job 2: Backend Test
- Sets up Node.js 20
- Installs `backend/package.json` dependencies
- Runs `npm test` (Jest + Supertest)
  - `auth.test.js`: Mocked login success/failure tests
  - `items.test.js`: Security tests (403 without token, 401 with invalid token)

### Job 3: ML Service Test
- Sets up Python 3.9
- Installs ML requirements from `ML/requirements.txt`
- Runs `pytest test_ml.py` (FastAPI TestClient tests)

### Job 4: Docker Build (depends on all 3 passing)
- Builds the frontend Docker image from `Containerfile.frontend`
- Builds the backend Docker image from `backend/Containerfile.backend`
- Builds the ML Docker image from `ML/Containerfile`

---

## 10. Docker Deployment (`compose.yml`)

The project is fully containerized using Docker Compose (v3.8) with **4 services** on a shared `tvet_net` bridge network:

| Service | Container Name | Image | Port | Source |
|---|---|---|---|---|
| `mongodb` | `tvet_mongodb` | `mongo:latest` | 27017 | Docker Hub |
| `backend` | `tvet_backend` | Custom build | 5000 | `./backend/Containerfile.backend` |
| `ml-api` | `tvet_ml_api` | Custom build | 8000 | `./ML/Containerfile` |
| `frontend` | `tvet_frontend` | Custom build | 8080 | `./Containerfile.frontend` |

**Networking**:
- Frontend depends on Backend (`depends_on`)
- Backend depends on MongoDB (`depends_on`)
- All services communicate via service name DNS within the `tvet_net` bridge network
- Nginx inside the frontend container serves the React build and proxies `/api/` → `http://backend:5000/api/`
- MongoDB data is persisted via a Docker volume from `./mongodb_data:/data/db`

**Environment**:
- Backend `.env` file pins `PORT` and `JWT_SECRET`
- `compose.yml` overrides `MONGO_URI` to use the Docker internal URL (`mongodb://mongodb:27017/ikmb-dashboard`)
- Backend also receives `ML_API_URL=http://ml-api:8000` for communicating with the ML service

---

## 11. Testing Summary

| Layer | Technology | File(s) | Coverage |
|---|---|---|---|
| Frontend (component) | Vitest + React Testing Library | `src/__tests__/Login.test.jsx` | Login form rendering, failed login error display |
| Backend (API) | Jest + Supertest | `backend/__tests__/auth.test.js` | Successful login (mocked), wrong password (mocked) |
| Backend (security) | Jest + Supertest | `backend/__tests__/items.test.js` | Token enforcement (403 without token, 401 with bad token) |
| ML service | pytest + FastAPI TestClient | `ML/test_ml.py` | Health check, valid prediction, invalid input (422) |

> Note: Backend tests in `auth.test.js` mock `auth.model.js` functions, meaning they do not test the actual MongoDB integration. The `items.test.js` tests run against the real Express app but will attempt a MongoDB connection (controlled by `NODE_ENV` check in `server.js`).

---

## 12. Key Application Features & User Flows

### Admin/Staff Flow
1. **Login** at `/` with `admin@ikmb.edu.my` / `password123`
2. Redirected to `/staff-dashboard`
3. **Overview**: See aggregate statistics, PLO comparisons, high-risk list, and top performers
4. **AI Prediction**: Manually input student data and run an ML prediction
5. **Skills Gap**: View the current state of each PLO across the institute
6. **Pathways**: See recommended workshops/training to close skill gaps
7. **Manage Students**: Add, edit, delete, and search student records
8. **View Profile**: Click any student card to see detailed `/student-profile?id=...` with PLO radar, CGPA trends, AI insight, and prescriptive interventions

### Student Flow
1. **Login** at `/` with `{studentId}@student.ikmb.edu.my` / `password123`
2. Redirected to `/student-dashboard`
3. Views **only their own data** (frontend filters the API response on the client side based on `studentId` stored in JWT)
4. **Profil & Prestasi**: Sees their PLO radar chart, employability score, and AI insight
5. **Kerjaya**: Views personalized AI-matched career cards for their course
6. **Kursus**: Sees personalized course recommendations based on their weakest PLO

---

## 13. Course Codes Used in the Application

| Code | Full Course Name |
|---|---|
| ITW | Diploma Kompetensi Kimpalan (Welding) |
| DFK | Diploma Teknologi Komputer / Komputasi Awan (Cloud Computing) |
| DGA | Diploma Teknologi Automotif (Automotive) |
| SLR | Sijil Teknologi Kejuruteraan Mekanikal / Lukisan Rekabentuk (Design Drafting) |
| DCG | Diploma Kompetensi Elektrik (Industri) (Electrical Industrial) |
| SED | Sijil Elektrik Domestik (Domestic Electrical) |
| PPU | Diploma Penyejukan dan Penyamanan Udara (Air Conditioning & Refrigeration) |

---

## 14. PLO (Program Learning Outcomes)

The system analyzes **9 PLOs** for each student, each scored as a percentage (0-100). These represent key competencies expected of TVET graduates:

| PLO | Label | Example Pathway |
|---|---|---|
| PLO 1 | Komunikasi Efektif | Kursus Komunikasi Efektif |
| PLO 2 | Pengaturcaraan | Bengkel Pengaturcaraan |
| PLO 3 | Keselamatan Industri (OSH) | Latihan OSH |
| PLO 4 | Pengurusan Projek | Pengurusan Projek |
| PLO 5 | Inovasi Produk | Inovasi Produk |
| PLO 6 | Kemahiran Teknikal (Motor/Elektrik) | Kerosakan Motor |
| PLO 7 | Keusahawanan Digital | Keusahawanan Digital |
| PLO 8 | Etika & Kepimpinan | Etika & Kepimpinan |
| PLO 9 | Integriti Profesional | Integriti Profesional |

The institutional target for all PLOs is **80%**. Scores below this threshold trigger skills gap flags in the dashboard.

---

## 15. Analytics Layers Implemented

The project implements a complete four-layer analytics framework aligned with the data analytics maturity model:

| Layer | Type | Example in the App |
|---|---|---|
| **Descriptive** | "What happened?" | PLO average scores, attendance records, CGPA bar charts |
| **Diagnostic** | "Why did it happen?" | AI insight messages explaining the weakest skill and gap size |
| **Predictive** | "What will happen?" | ML-based dropout risk prediction (Rendah/Sederhana/Tinggi) |
| **Prescriptive** | "What should we do?" | Recommended workshops, career pathways, intervention cards in StudentProfile |

---

## 16. File Structure Reference

```
TVETMARA-Besut-Skills-Talent-Development-Dashboard/
|-- AGENTS.md                          # AI agent instructions (project tech stack reference)
|-- compose.yml                        # Docker Compose orchestration (4 services)
|-- nginx.conf                         # Nginx reverse proxy config for frontend container
|-- Containerfile.frontend             # Frontend Docker multi-stage build (Node → Nginx)
|-- .dockerignore                      # Docker build exclusions
|-- .gitignore                         # Git ignore rules (env, node_modules, dist, db files)
|-- index.html                         # HTML entry point with Phosphor Icons CDN
|-- package.json                       # Root package (React, Vite, Vitest, Chart.js)
|-- package-lock.json                  # Locked dependency tree
|-- vite.config.js                     # Vite + Vitest config (API proxy, test env)
|-- tailwind.config.js                 # Tailwind + Plus Jakarta Sans font
|-- postcss.config.js                  # PostCSS + Tailwind + Autoprefixer
|-- eslint.config.js                   # ESLint (React Hooks + Vite refresh rules)
|-- .github/workflows/ci.yml           # GitHub Actions CI/CD pipeline
|-- inspect_mdb_linux.py               # Utility to inspect .mdb tables on Linux
|-- logo-tvetmara.jpg                  # TVETMARA logo (served as public asset)
|
|-- src/                               # ⭐ FRONTEND SOURCE
|   |-- main.jsx                       # React entry point
|   |-- App.jsx                        # Router + ProtectedRoute logic
|   |-- App.css                        # Default Vite CSS (mostly unused)
|   |-- index.css                      # Global styles + Tailwind imports
|   |-- utils/
|   |   `-- auth.js                    # Auth helpers (localStorage, role mapping)
|   |-- pages/
|   |   |-- Login.jsx                  # Login page
|   |   |-- StaffDashboard.jsx         # Admin dashboard (5 tabs)
|   |   |-- StudentDashboard.jsx       # Student dashboard (3 tabs, self-only data)
|   |   `-- StudentProfile.jsx         # Detailed student profile + prescriptive analytics
|   |-- components/
|   |   |-- Sidebar.jsx                # Shared sidebar navigation component
|   |   |-- KpiCard.jsx                # Stat card with progress bar
|   |   |-- StudentModal.jsx           # Add/Edit student modal dialog
|   |   `-- JobCard.jsx                # Job recommendation card
|   `-- __tests__/
|       `-- Login.test.jsx             # Frontend unit test (Login component)
|
|-- backend/                           # ⭐ BACKEND SOURCE
|   |-- server.js                      # Express app entry + Swagger + MongoDB connect
|   |-- auth.js                        # Auth routes (login, get users)
|   |-- items.js                       # Student CRUD + AI prediction routes
|   |-- auth.model.js                  # User authentication logic (bcrypt, JWT)
|   |-- item.model.js                  # Student business logic (normalise, skill gap, AI)
|   |-- middleware/
|   |   `-- authMiddleware.js          # JWT token verification middleware
|   |-- models/
|   |   |-- User.js                    # Mongoose User schema
|   |   `-- Student.js                 # Mongoose Student schema
|   |-- seed.js                        # Database seeder (JSON → MongoDB + hashed passwords)
|   |-- babel.config.json              # Babel config for Jest (not used in prod)
|   |-- package.json                   # Backend deps (Express, JWT, bcrypt, mongoose, Swagger)
|   |-- package-lock.json
|   |-- .env                           # Environment variables (git-ignored)
|   |-- .env.example                   # Template for environment variables
|   |-- __tests__/
|   |   |-- auth.test.js              # Auth API tests (mocked)
|   |   `-- items.test.js             # Student API security tests
|   `-- db/                            # Data processing scripts + raw/processed datasets
|       |-- data_tvet_muktamad.json    # Cleaned student dataset (with academicHistory)
|       |-- data_tvet.json             # Earlier version of student dataset
|       |-- Ekspot_Senat.mdb           # Original raw Microsoft Access database file
|       |-- pelajar.csv               # Extracted student list from MDB
|       |-- Daftar_Subjek.csv         # Extracted enrollment records from MDB
|       |-- GPA.csv                   # Extracted GPA history from MDB
|       |-- Detail_Result.csv         # Extracted exam/PLO results from MDB
|       |-- Anugerah.csv              # Extracted awards from MDB
|       |-- Layak_Sijil.csv           # Certification eligibility data
|       |-- Tidak_Lengkap.csv         # Incomplete records data
|       |-- Detail_Result.csv         # Detailed result breakdown
|       |-- ml_training_data_real.csv # Final ML training dataset (output of prepare_ml_data.py)
|       |-- login_users.json          # Login user reference data
|       |-- prepare_ml_data.py        # ETL: MDB → merged CSV for ML training
|       |-- extract_history.py        # ETL: Builds academicHistory and updates JSON
|       |-- ekstrak_mdb.py            # MDB extraction helper
|       `-- sedut_mdb_tulen.py        # Direct raw MDB extraction script
|
|-- ML/                                # ⭐ ML SERVICE SOURCE (Python / FastAPI)
|   |-- ml.py                          # FastAPI server (predict/risk endpoint)
|   |-- train_and_evaluate.py          # Model training script (RandomForest + GridSearch)
|   |-- test_ml.py                     # ML API tests (pytest)
|   |-- requirements.txt               # Python dependencies
|   |-- Containerfile                  # ML Docker image (Python Slim + Uvicorn)
|   |-- model_ai_risiko_lengkap_v3.pkl # Production ML model (V3 — trained on real data)
|   |-- model_ai_risiko_lengkap_v2.pkl # Previous model version (V2)
|   `-- model_ai_tvet_besut.pkl       # Initial/baseline model (V1)
|
|-- mongodb_data/                      # Persistent MongoDB volume data
|-- dist/                              # Vite production build output (git-ignored)
|-- node_modules/                      # Root dependencies (git-ignored)
`-- backend/node_modules/              # Backend dependencies (git-ignored)
```

---

## 17. Environment Variables

| Variable | Where | Purpose | Default/Example |
|---|---|---|---|
| `PORT` | Backend `.env` | Express server port | `5001` |
| `MONGO_URI` | Backend `.env` | MongoDB connection string | `mongodb://127.0.0.1:27017/ikmb-dashboard` |
| `JWT_SECRET` | Backend `.env` | Secret key for signing JWTs | (must be set securely) |
| `PORT` | Root `.env` | Port number; also used by `vite.config.js` to proxy to backend | `5000` |

Both `PORT` and `JWT_SECRET` are sensitive and are **excluded from version control** via `.gitignore`.

---

## 18. Default Test Accounts

| Email | Password | Role | Access |
|---|---|---|---|
| `admin@ikmb.edu.my` | `password123` | admin | Staff Dashboard + Student Profile |
| `user@ikmb.edu.my` | `password123` | user | Student Dashboard (no profile access) |
| `{studentId}@student.ikmb.edu.my` | `password123` | user | Student Dashboard (own data only) |

All student accounts are created during database seeding with the same default password.

---

*This summary covers all source code files, configuration files, data pipeline scripts, and deployment configurations present in the project as of this document's creation.*
