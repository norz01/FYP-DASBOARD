import os
# Set dummy secret before importing ml (ml.py fail-closed boot exits if missing).
# CI injects real ML_API_SECRET via env; local fallback allows tests without it.
os.environ.setdefault("ML_API_SECRET", "ci-dummy-ml-secret-for-testing")

from fastapi.testclient import TestClient
from ml import app

client = TestClient(app)

# Fetch API key from env (injected by GitHub Actions), fallback dummy for local
API_KEY = os.getenv("ML_API_SECRET", "ci-dummy-ml-secret-for-testing")
HEADERS = {"X-API-Key": API_KEY}

def test_health_check():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "AI Server V4 is running"

def test_predict_risk_valid_data():
    payload = {
        "CGPA": 3.9,
        "Attendance": 100,
        "PLO_1": 95, "PLO_2": 95, "PLO_3": 95,
        "PLO_4": 95, "PLO_5": 95, "PLO_6": 95,
        "PLO_7": 95, "PLO_8": 95, "PLO_9": 95,
        "Sijil": "Tiada"
    }
    response = client.post("/predict/risk", json=payload, headers=HEADERS)
    assert response.status_code == 200
    assert response.json()["prediction"] in ["Cemerlang", "Sederhana", "Bermasalah"]

def test_predict_risk_invalid_data():
    # Missing PLO fields
    payload = {
        "CGPA": 3.0,
        "Attendance": 80,
        "Sijil": "Tiada"
    }
    response = client.post("/predict/risk", json=payload, headers=HEADERS)
    assert response.status_code == 422 # Unprocessable Entity