from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib  # NEW: We use joblib instead of pickle
import pandas as pd
import os

# Initialize FastAPI app
app = FastAPI(title="TVETMARA AI Prediction API")

# Load the AI Model
# Adjust the path if necessary depending on where you run the script
MODEL_PATH = "model_ai_risiko_lengkap_v2.pkl"

try:
    # NEW: joblib loads it directly without needing 'with open(...)'
    risk_model = joblib.load(MODEL_PATH)
    print("✅ AI Model Loaded Successfully!")
except Exception as e:
    print(f"❌ Error loading model: {e}")
    risk_model = None

# Define the exact data structure Node.js will send us
class StudentFeatures(BaseModel):
    CGPA: float
    Attendance: float
    PLO_1: float
    PLO_2: float
    PLO_3: float
    PLO_4: float
    PLO_5: float
    PLO_6: float
    PLO_7: float
    PLO_8: float
    PLO_9: float
    Sijil: str

@app.get("/")
def read_root():
    return {"status": "AI Server is running"}

@app.post("/predict/risk")
def predict_risk(data: StudentFeatures):
    if risk_model is None:
        raise HTTPException(status_code=500, detail="AI Model is not loaded")

    try:
        sijil_mapping = {
            "Tiada": 0,
            "CompTIA": 1,
            "Cisco CCNA": 2,
            "AWS Cloud": 3
        }
        
        sijil_encoded = sijil_mapping.get(data.Sijil, 0)

        features = pd.DataFrame([{
            "CGPA": data.CGPA,
            "Kehadiran_Pct": data.Attendance,
            "PLO_1": data.PLO_1,
            "PLO_2": data.PLO_2,
            "PLO_3": data.PLO_3,
            "PLO_4": data.PLO_4,
            "PLO_5": data.PLO_5,
            "PLO_6": data.PLO_6,
            "PLO_7": data.PLO_7,
            "PLO_8": data.PLO_8,
            "PLO_9": data.PLO_9,
            "Sijil_Num": sijil_encoded
        }])

        if hasattr(risk_model, 'feature_names_in_'):
            features = features[risk_model.feature_names_in_]

        prediction = risk_model.predict(features)[0]
        
        return {
            "success": True,
            "prediction": str(prediction),
            "raw_output": str(prediction)
        }

    except Exception as e:
        print(f"❌ EXACT ML ERROR: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Prediction error: {str(e)}")
