# 🎓 TVETMARA Besut Skills Talent Development Dashboard

A Smart Skills & Talent Development Dashboard for TVETMARA Institut Kemahiran Mara Besut (IKMB). This Final Year Project (FYP) leverages **Artificial Intelligence (Machine Learning)** to monitor, predict, and develop student talent. It enables administrators to manage student data, view AI-driven dropout risk predictions, perform skills gap analysis, and recommend personalized learning pathways and career matches.

Built with a hybrid **MERN stack + Python FastAPI** architecture, the system implements a complete 4-layer analytics framework: Descriptive, Diagnostic, Predictive, and Prescriptive.

---

## ✨ Key Features

### For Administrators (Staff / Penyelaras)
- **Overview Dashboard**: KPIs for active students, average employability, and high-risk counts. Visual comparison of PLO averages vs. 80% institutional targets.
- **AI Manual Prediction**: Input custom student metrics to generate immediate ML-based dropout risk predictions.
- **Skills Gap Analysis**: Institutional-wide view of all 9 Program Learning Outcomes (PLOs) categorized as *Selamat*, *Perlu Peningkatan*, or *Kritikal*.
- **Learning Pathways**: Auto-generated course and workshop recommendations mapped to the weakest PLOs.
- **Student Management (CRUD)**: Securely add, edit, delete, and search student records.
- **Detailed Student Profiles**: View semester-by-semester CGPA/attendance trends, PLO radar charts, AI insights, and prescriptive intervention plans.

### For Students
- **Profil & Prestasi**: Personalized dashboard showing employability score, risk status, PLO radar chart vs. target, and AI-generated diagnostic insights.
- **Padanan Kerjaya (AI)**: AI-matched career recommendations based on the student's enrolled course.
- **Kursus Cadangan**: Personalized course recommendations targeting the student's weakest skills.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React.js 19, Vite 7, Tailwind CSS 3, Chart.js (react-chartjs-2), React Router DOM 7, Phosphor Icons |
| **Backend** | Node.js, Express.js 5, MongoDB, Mongoose 9, JWT (jsonwebtoken), bcryptjs, Swagger UI |
| **ML Service** | Python, FastAPI, scikit-learn (RandomForestClassifier), pandas, numpy, joblib, Uvicorn |
| **DevOps** | Docker Compose, Nginx, GitHub Actions (CI/CD) |

---

## 🏗️ System Architecture

The system is split into three independent microservices communicating over HTTP, orchestrated via Docker Compose:

```text
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

## 📊 Analytics Maturity Model Implementation

This project fulfills the four layers of data analytics:

1. **Descriptive ("What happened?")**: PLO average scores, attendance records, CGPA bar charts.
2. **Diagnostic ("Why did it happen?")**: AI insight messages explaining the weakest skill and the gap size.
3. **Predictive ("What will happen?")**: ML-based dropout risk classification (`Rendah / Sederhana / Tinggi`).
4. **Prescriptive ("What should we do?")**: Recommended workshops, career pathways, and targeted intervention cards.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v20 or later)
- Python (v3.9 or later)
- MongoDB (running locally or via Docker)
- `mdbtools` (only required if re-running the ETL pipeline on raw `.mdb` files)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/TVETMARA-Besut-Skills-Talent-Development-Dashboard.git
cd TVETMARA-Besut-Skills-Talent-Development-Dashboard
```

### 2. Setup Backend & Database
```bash
cd backend
npm install
```
Create a `.env` file in the `backend/` directory based on `.env.example`:
```env
PORT=5001
MONGO_URI=mongodb://127.0.0.1:27017/ikmb-dashboard
JWT_SECRET=your_super_secret_key
```
Seed the database with canonical TVETMARA data:
```bash
npm run seed
```
Start the backend server:
```bash
npm start
```

### 3. Setup ML Service
Open a new terminal and navigate to the ML directory:
```bash
cd ML
pip install -r requirements.txt
```
Start the FastAPI ML server:
```bash
uvicorn ml:app --host 0.0.0.0 --port 8000
```

### 4. Setup Frontend
Open a new terminal in the root directory:
```bash
npm install
npm run dev
```
The application should now be running at `http://localhost:5173` (or the port specified by Vite).

---

## 🐳 Docker Deployment (Recommended)

To run the entire stack (Frontend, Backend, ML, MongoDB) simultaneously:

1. Ensure Docker and Docker Compose are installed.
2. From the root directory, run:
   ```bash
   docker-compose up --build -d
   ```
3. Access the application at `http://localhost:8080`.

---

## 🔑 Default Test Accounts

All seeded accounts use the password: **`password123`**

| Email | Role | Access Level |
| :--- | :--- | :--- |
| `admin@ikmb.edu.my` | Admin | Staff Dashboard, Student Profile, CRUD |
| `user@ikmb.edu.my` | User | Student Dashboard |
| `{studentId}@student.ikmb.edu.my` | User | Student Dashboard (Own Data Only) |

---

## 🧪 Testing

The project includes comprehensive testing across all layers. To run tests:

**Frontend (Vitest + React Testing Library):**
```bash
npm test
```

**Backend (Jest + Supertest):**
```bash
cd backend
npm test
```

**ML Service (Pytest + FastAPI TestClient):**
```bash
cd ML
pytest
```

---

## 📂 Data Pipeline (ETL & Model Training)

The project includes a complete ETL pipeline transforming raw Microsoft Access data into ML-ready datasets:

1. **Extract**: `ekstrak_mdb.py` exports tables from `Ekspot_Senat.mdb` to CSVs.
2. **Transform**: `prepare_ml_data.py` merges tables, calculates `PLO_Avg` and `PLO_Variance`, and generates ground-truth labels.
3. **History**: `extract_history.py` builds semester-by-semester academic history.
4. **Load**: `seed.js` populates MongoDB with cleaned JSON data.
5. **Train**: `train_and_evaluate.py` trains the `RandomForestClassifier` via GridSearchCV and saves the `.pkl` model.

---

## 📚 Domain Knowledge

### Program Learning Outcomes (PLOs)
The system evaluates 9 PLOs with an institutional target of **80%**.
1. Komunikasi Efektif
2. Pengaturcaraan
3. Keselamatan Industri (OSH)
4. Pengurusan Projek
5. Inovasi Produk
6. Kemahiran Teknikal (Motor/Elektrik)
7. Keusahawanan Digital
8. Etika & Kepimpinan
9. Integriti Profesional

### Course Codes
| Code | Course |
| :--- | :--- |
| ITW | Diploma Kompetensi Kimpalan (Welding) |
| DFK | Diploma Teknologi Komputer / Komputasi Awan |
| DGA | Diploma Teknologi Automotif |
| SLR | Sijil Teknologi Kejuruteraan Mekanikal / Lukisan Rekabentuk |
| DCG | Diploma Kompetensi Elektrik (Industri) |
| SED | Sijil Elektrik Domestik |
| PPU | Diploma Penyejukan dan Penyamanan Udara |

---

## 📄 License

This project was developed as a Final Year Project. © 2024 TVETMARA Besut.
```