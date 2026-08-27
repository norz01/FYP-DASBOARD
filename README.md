# TVETMARA Besut Skills & Talent Development Dashboard

> **Papan Pemuka Pintar** (Smart Dashboard) — a Final Year Project (FYP) for
> Institut Kemahiran MARA Besut (IKMB), a Malaysian TVET college under MARA.

A full-stack web application that helps IKMB staff and students **monitor** academic
performance, **predict** dropout risk with machine learning, and **develop** skills
through personalized learning pathways. The UI is in **Bahasa Melayu**.

---

## 🎯 What It Does

The dashboard implements a four-stage analytics maturity model:

| Stage | Question | Feature |
|---|---|---|
| **Descriptive** | What happened? | CGPA, attendance %, and PLO skill charts |
| **Diagnostic** | Why? | AI insight messages naming the weakest skill + gap size |
| **Predictive** | What will happen? | ML dropout-risk classification |
| **Prescriptive** | What to do? | Workshop / course / intervention recommendations |

- **Monitor** — track CGPA, attendance %, and 9 PLO (Programme Learning Outcome) scores.
- **Predict** — a Random Forest classifier (scikit-learn) labels each student
  `Cemerlang` (excellent), `Sederhana` (moderate), or `Bermasalah` (at-risk).
- **Develop** — skills-gap analysis vs an **80%** institutional target, learning
  pathways, and career recommendations per course.

**Data source:** real student records exported from the institute's legacy Microsoft
Access database (`Ekspot_Senat.mdb`), converted to MongoDB documents via a Python ETL.

---

## 🏗️ Architecture

Four services orchestrated by Docker Compose on one bridge network (`tvet_net`):

| Service | Tech stack | Port | Role |
|---|---|---|---|
| `frontend` | React 19, Vite 7, Tailwind CSS 3, Chart.js, Nginx | 8080 → 80 | SPA UI |
| `backend` | Node 20, Express 5, Mongoose, JWT | 5000 | REST API + file uploads |
| `ml-api` | Python 3.9, FastAPI, scikit-learn, mdbtools | 8000 | AI prediction + MDB ETL |
| `mongodb` | `mongo:latest` | 27017 | Data store (`ikmb-dashboard`) |

```
FRONTEND (React + Nginx)  ──/api,/uploads──▶  BACKEND (Express)  ──▶  ML API (FastAPI)
                                                     │
                                                     ▼
                                                MongoDB (Mongoose)
```

---

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Compose (or Podman + podman-compose)
- For local (non-Docker) development: Node.js 20+, Python 3.9+, MongoDB, and `mdbtools`
  (`sudo dnf install mdbtools` on Fedora).

### Run with Docker Compose
```bash
docker compose up --build
```
Then open **http://localhost:8080**.

> The database is seeded either by uploading an `.mdb` file via the **Pengurusan Data**
> tab in the admin dashboard, or by running `npm run seed` inside the backend container.

---

## 👤 Default Accounts

All accounts use the password **`password123`**.

| Email | Role |
|---|---|
| `admin@ikmb.edu.my` | Admin / Staff |
| `user@ikmb.edu.my` | Student (generic) |
| `<ID>@student.ikmb.edu.my` | Individual student |

---

## 🧪 Testing

| Layer | Command | Framework |
|---|---|---|
| Frontend | `npm test` | Vitest + Testing Library |
| Backend | `cd backend && npm test` | Jest + Supertest |
| ML | `cd ML && pytest test_ml.py` | pytest + TestClient |

---

## 📁 Project Structure

```
├── src/                  # React frontend (pages, components, utils)
├── backend/              # Express API (routes, models, seed, db/)
│   └── db/               # Ekspot_Senat.mdb + ETL scripts + JSON/CSV data
├── ML/                   # FastAPI ML microservice + trained models (*.pkl)
├── public/               # static assets
├── compose.yml           # 4-service orchestration
├── Containerfile.frontend
├── nginx.conf
└── .github/workflows/ci.yml
```

---

## 📖 Domain Glossary

- **PLO** — Programme Learning Outcome. 9 skill scores (0–100%), target **80%** each.
- **Status** — `Cemerlang` (low risk), `Sederhana` (moderate), `Bermasalah` (high risk).
- **Course codes** — ITW (welding), DFK (cloud computing), DGA (automotive),
  SLR (mechanical drafting), DCG (industrial electrical), SED (domestic electrical),
  PPU (HVAC).
- **Certifications** — Tiada, CompTIA, Cisco CCNA, AWS Cloud.
- **MARA / IKMB / TVET** — MARA (Majlis Amanah Rakyat), IKMB (Institut Kemahiran MARA
  Besut), TVET (Technical & Vocational Education & Training).