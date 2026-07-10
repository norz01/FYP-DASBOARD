import pytest
from fastapi.testclient import TestClient
from ml import app

client = TestClient(app)

def test_health_check():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "AI Server V3 is running"

def test_predict_risk_valid_data():
    payload = {
        "CGPA": 3.9,
        "Attendance": 100,
        "PLO_1": 95, "PLO_2": 95, "PLO_3": 95,
        "PLO_4": 95, "PLO_5": 95, "PLO_6": 95,
        "PLO_7": 95, "PLO_8": 95, "PLO_9": 95,
        "Sijil": "Tiada"
    }
    response = client.post("/predict/risk", json=payload)
    assert response.status_code == 200
    assert response.json()["prediction"] in ["Cemerlang", "Sederhana", "Bermasalah"]

def test_predict_risk_invalid_data():
    # Missing PLO fields
    payload = {
        "CGPA": 3.0,
        "Attendance": 80,
        "Sijil": "Tiada"
    }
    response = client.post("/predict/risk", json=payload)
    assert response.status_code == 422 # Unprocessable Entity