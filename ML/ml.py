from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np

app = FastAPI(title="TVETMARA AI Prediction API V3")

MODEL_PATH = "model_ai_risiko_lengkap_v3.pkl"

try:
    risk_model = joblib.load(MODEL_PATH)
    print("✅ AI Model V3 Loaded Successfully!")
except Exception as e:
    print(f"❌ Error loading model: {e}")
    risk_model = None

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
    return {"status": "AI Server V3 is running"}

@app.post("/predict/risk")
def predict_risk(data: StudentFeatures):
    if risk_model is None:
        raise HTTPException(status_code=500, detail="AI Model is not loaded")

    try:
        # Calculate Engineered Features
        plo_values = [data.PLO_1, data.PLO_2, data.PLO_3, data.PLO_4, data.PLO_5, 
                      data.PLO_6, data.PLO_7, data.PLO_8, data.PLO_9]
        
        plo_avg = np.mean(plo_values)
        plo_variance = np.var(plo_values)

        # Construct DataFrame with EXACT features the model was trained on
        features = pd.DataFrame([{
            "CGPA": data.CGPA,
            "Avg_Subjek_Attendance": data.Attendance, # Maps to the real dataset column name
            "PLO_1": data.PLO_1, "PLO_2": data.PLO_2, "PLO_3": data.PLO_3,
            "PLO_4": data.PLO_4, "PLO_5": data.PLO_5, "PLO_6": data.PLO_6,
            "PLO_7": data.PLO_7, "PLO_8": data.PLO_8, "PLO_9": data.PLO_9,
            "PLO_Avg": plo_avg,
            "PLO_Variance": plo_variance
        }])

        # Ensure column order matches what the model expects
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