import os
import sys
from typing import List
from fastapi import FastAPI, HTTPException, UploadFile, File, Header
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np
import re
import csv
import subprocess
import tempfile
import io

# NV-4 FIX: Fail-closed boot if shared secret is missing
ML_API_SECRET = os.getenv("ML_API_SECRET")
if not ML_API_SECRET:
    print("🔴 FATAL: ML_API_SECRET is not set. ML Service refusing to start.")
    sys.exit(1)

app = FastAPI(title="TVETMARA AI Prediction API V4")
MODEL_PATH = "model_ai_risiko_lengkap_v4.pkl"
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB limit

try:
    risk_model = joblib.load(MODEL_PATH)
    print("✅ AI Model V4 Loaded Successfully!")
except Exception:
    print("❌ Error loading model")
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

class BatchPredictRequest(BaseModel):
    students: List[StudentFeatures]

def check_auth(x_api_key: str = Header(..., alias="X-API-Key")):
    if x_api_key != ML_API_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

@app.get("/")
def read_root():
    return {"status": "AI Server V4 is running"}

@app.post("/predict/risk")
def predict_risk(data: StudentFeatures, x_api_key: str = Header(..., alias="X-API-Key")):
    check_auth(x_api_key)
    if risk_model is None:
        raise HTTPException(status_code=500, detail="AI Model is not loaded")

    try:
        # Calculate Engineered Features
        plo_values = [data.PLO_1, data.PLO_2, data.PLO_3, data.PLO_4, data.PLO_5,
                      data.PLO_6, data.PLO_7, data.PLO_8, data.PLO_9]

        features = pd.DataFrame([{
            "CGPA": data.CGPA,
            "Avg_Subjek_Attendance": data.Attendance,
            "PLO_1": data.PLO_1, "PLO_2": data.PLO_2, "PLO_3": data.PLO_3,
            "PLO_4": data.PLO_4, "PLO_5": data.PLO_5, "PLO_6": data.PLO_6,
            "PLO_7": data.PLO_7, "PLO_8": data.PLO_8, "PLO_9": data.PLO_9,
            "PLO_Avg": float(np.mean(plo_values)),
            "PLO_Variance": float(np.var(plo_values))
        }])

        if hasattr(risk_model, 'feature_names_in_'):
            features = features[risk_model.feature_names_in_]

        prediction = risk_model.predict(features)[0]

        return {
            "success": True,
            "prediction": str(prediction),
            "raw_output": str(prediction)
        }

    except Exception:
        # NV-4 FIX: Generic error, no str(e) leakage
        raise HTTPException(status_code=400, detail="Prediction processing error")


@app.post("/predict/batch")
def predict_batch(payload: BatchPredictRequest, x_api_key: str = Header(..., alias="X-API-Key")):
    check_auth(x_api_key)
    if risk_model is None:
        raise HTTPException(status_code=500, detail="AI Model is not loaded")

    try:
        rows = []
        for s in payload.students:
            plo_values = [s.PLO_1, s.PLO_2, s.PLO_3, s.PLO_4, s.PLO_5,
                          s.PLO_6, s.PLO_7, s.PLO_8, s.PLO_9]

            rows.append({
                "CGPA": s.CGPA,
                "Avg_Subjek_Attendance": s.Attendance,
                "PLO_1": s.PLO_1, "PLO_2": s.PLO_2, "PLO_3": s.PLO_3,
                "PLO_4": s.PLO_4, "PLO_5": s.PLO_5, "PLO_6": s.PLO_6,
                "PLO_7": s.PLO_7, "PLO_8": s.PLO_8, "PLO_9": s.PLO_9,
                "PLO_Avg": float(np.mean(plo_values)),
                "PLO_Variance": float(np.var(plo_values)),
            })

        features = pd.DataFrame(rows)

        if hasattr(risk_model, 'feature_names_in_'):
            features = features[risk_model.feature_names_in_]

        predictions = risk_model.predict(features)

        return {"success": True, "predictions": [str(p) for p in predictions]}

    except Exception:
        raise HTTPException(status_code=400, detail="Batch prediction error")


# ============================================================
# ETL: MDB Processing (mdbtools)
# ============================================================

def get_table_data(db_path, table_name):
    try:
        # NV-4 FIX: 30s timeout prevents hung subprocess DoS
        result = subprocess.run(
            ['mdb-export', db_path, table_name],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, check=True, timeout=30
        )
        return list(csv.DictReader(io.StringIO(result.stdout)))
    except subprocess.TimeoutExpired:
        print(f"⏱️ Timeout expired for table '{table_name}'")
        return []
    except Exception:
        print(f"❌ Gagal mengekstrak jadual '{table_name}'.")
        return []

def inspect_mdb(db_path):
    print("\n=== INSPEKSI STRUKTUR FAIL MDB BAHARU ===")
    try:
        # Dapatkan senarai semua jadual dalam fail MDB
        result = subprocess.run(['mdb-tables', '-1', db_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True, timeout=15)
        tables = result.stdout.strip().split('\n')
        print(f"📋 Jadual tersedia: {tables}")

        # Intip setiap jadual untuk dapatkan nama lajur (column headers)
        for table in tables:
            if not table: continue
            res = subprocess.run(['mdb-export', db_path, table], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True, timeout=30)
            reader = csv.reader(io.StringIO(res.stdout))
            try:
                headers = next(reader)
                first_row = next(reader)
                print(f"\n[Jadual: {table}]")
                print(f"-> Nama Lajur: {headers}")
                print(f"-> Contoh Data: {first_row}")
            except StopIteration:
                print(f"\n[Jadual: {table}] - Tiada data (kosong)")
    except Exception:
        print("❌ Ralat semasa inspeksi.")
    print("========================================\n")

def process_mdb_data(db_path):
    inspect_mdb(db_path)  # Panggil fungsi inspeksi
    print("🔄 Memulakan proses ETL fail MDB...")
    students = {}
    history_map = {}

    # 1. GPA & CGPA
    gpa_data = get_table_data(db_path, 'GPA')
    print(f"📊 Jumlah baris dalam jadual GPA: {len(gpa_data)}")
    for row in gpa_data:
        no = row.get('No_Pelajar')
        if not no: continue
        try:
            sem = int(row.get('Sem_Pelajar', 0))
            cgpa = float(row.get('CGPA', 0.0))
        except: continue

        if no not in students or sem > students[no]['_sem_terkini']:
            students[no] = {
                'ID_Pelajar': no, 'Nama': 'Tiada Rekod', 'Kursus': 'Tiada Rekod', 'Semester': sem,
                'CGPA': f"{cgpa:.2f}", 'Kehadiran_Pct': '0', 'Anugerah': False, 'Koko_Lulus': False,
                'Status_Pelajar': 'Pending AI', 'Sijil_Profesional': 'Tiada',
                'No_KP': '', 'No_Telefon': '', 'Alamat': '',  # TAMBAH INI
                'PLO_Scores': {f"PLO_{i}": [] for i in range(1, 10)}, '_sem_terkini': sem
            }

        # TAMBAHAN: Rekod sejarah GPA setiap semester untuk academicHistory
        try:
            gpa_sem = float(row.get('GPA', 0.0))
        except:
            gpa_sem = 0.0
        history_map.setdefault(no, []).append({
            'semester': sem,
            'gpa': gpa_sem,
            'cgpa': cgpa,
        })

    print(f"👥 Jumlah pelajar unik ditemui selepas GPA: {len(students)}")

    # 2. Nama, Kursus & Maklumat Peribadi
    pelajar_data = get_table_data(db_path, 'Pelajar')
    print(f"📝 Jumlah baris dalam jadual Pelajar: {len(pelajar_data)}")
    for row in pelajar_data:
        no = row.get('No_Pelajar')
        if no in students:
            students[no]['Nama'] = row.get('Nama_Pelajar', 'Tiada Nama')
            raw_kursus = row.get('Kod_Kursus_Pelajar', 'Tiada Kursus') or 'Tiada Kursus'
            students[no]['Kursus'] = raw_kursus.strip().replace('*', '').strip()
            students[no]['No_KP'] = row.get('NoKP_Pelajar', '')
            students[no]['No_Telefon'] = row.get('No_Telefon', '')

            # Gabungkan Alamat, Poskod, dan Bandar
            alamat = row.get('Alamat_Pelajar', '').strip()
            poskod = row.get('Poskod_Pelajar', '').strip()
            bandar = row.get('Bandar_Pelajar', '').strip()
            full_alamat = f"{alamat}, {poskod} {bandar}".strip(', ').strip()
            students[no]['Alamat'] = full_alamat if full_alamat else 'Tiada Alamat'

    # 3. Kehadiran
    daftar_data = get_table_data(db_path, 'Daftar_Subjek')
    print(f"📅 Jumlah baris dalam jadual Daftar_Subjek: {len(daftar_data)}")
    attendance_map = {}
    attendance_sem_map = {}  # ✅ FIX: kehadiran per (pelajar, semester)
    for row in daftar_data:
        no = row.get('No_Pelajar')
        if no in students and row.get('Kehadiran'):
            try:
                val = float(row['Kehadiran'])
            except:
                continue
            attendance_map.setdefault(no, []).append(val)

            # ✅ FIX: kumpul kehadiran mengikut semester
            # (Daftar_Subjek MEMPUNYAI lajur Sem_Pelajar, sama seperti extract_history.py)
            if val > 0:  # tapis subjek yang belum direkodkan kehadirannya
                try:
                    sem = int(float(row.get('Sem_Pelajar', 0)))
                    attendance_sem_map.setdefault((no, sem), []).append(val)
                except:
                    continue

    for no, list_hadir in attendance_map.items():
        avg_hadir = sum(list_hadir) / len(list_hadir)
        students[no]['Kehadiran_Pct'] = f"{avg_hadir:.0f}"

    # ✅ FIX: padankan kehadiran ke SETIAP entri academicHistory, bukan semester akhir sahaja
    for (no, sem), list_hadir in attendance_sem_map.items():
        if no in history_map:
            avg_hadir = sum(list_hadir) / len(list_hadir)
            for entry in history_map[no]:
                if entry['semester'] == sem:
                    entry['attendance'] = avg_hadir

    # 4. PLO Scores
    detail_data = get_table_data(db_path, 'Detail_Result')
    print(f"📈 Jumlah baris dalam jadual Detail_Result: {len(detail_data)}")

    # 4a. AUTO-EXCLUSION: subjects whose Kod_Ujian references LO > 9 use an
    # internal CLO numbering scheme (NOT the 9 programme PLOs).
    # Example: DUA20102 has LO11 -> its LO7/LO8 must NOT count as PLO 7/8.
    excluded_subjects = set()
    for row in detail_data:
        m = re.search(r'LO(\d+)', row.get('Kod_Ujian', ''))
        if m and int(m.group(1)) > 9:
            excluded_subjects.add(row.get('Kod_Subjek', ''))
    if excluded_subjects:
        print(f"⚠️ Subjek dikecualikan daripada pemetaan PLO (skema CLO dalaman): {sorted(excluded_subjects)}")

    for row in detail_data:
        no = row.get('No_Pelajar')
        if no in students and row.get('Kod_Subjek', '') not in excluded_subjects:
            match = re.search(r'LO(\d+)', row.get('Kod_Ujian', ''))
            if match:
                idx = int(match.group(1))
                if 1 <= idx <= 9:
                    try: students[no]['PLO_Scores'][f"PLO_{idx}"].append(float(row['Markah']))
                    except: continue

    # 5. Anugerah
    anugerah_data = get_table_data(db_path, 'Anugerah')
    print(f"🏆 Jumlah baris dalam jadual Anugerah: {len(anugerah_data)}")
    for row in anugerah_data:
        no = row.get('No_Pelajar')
        if no in students:
            students[no]['Anugerah'] = True

    # 6. Koko
    koko_data = get_table_data(db_path, 'Pelajar_Koko_Detail')
    print(f"🏅 Jumlah baris dalam jadual Pelajar_Koko_Detail: {len(koko_data)}")
    for row in koko_data:
        no = row.get('No_Pelajar')
        if no in students and row.get('Result') == 'LULUS':
            students[no]['Koko_Lulus'] = True

    # Finalisasi
    final_list = []
    for no, data in students.items():
        for i in range(1, 10):
            key = f"PLO_{i}"
            list_markah = data['PLO_Scores'][key]
            data[key] = f"{sum(list_markah)/len(list_markah):.0f}" if list_markah else "0"
        del data['PLO_Scores']
        del data['_sem_terkini']

        # TAMBAHAN: Masukkan array academicHistory ke dalam data pelajar
        if no in history_map:
            # Susun ikut semester
            sorted_history = sorted(history_map[no], key=lambda x: x['semester'])
            data['academicHistory'] = sorted_history
        else:
            data['academicHistory'] = []

        final_list.append(data)

    print(f"✅ SELESAI! Jumlah rekod pelajar untuk dihantar ke MongoDB: {len(final_list)}")
    return final_list


@app.post("/etl/process-mdb")
async def etl_process_mdb(
    file: UploadFile = File(...),
    x_api_key: str = Header(..., alias="X-API-Key")
):
    check_auth(x_api_key)

    if not file.filename or not file.filename.lower().endswith('.mdb'):
        raise HTTPException(status_code=400, detail="Invalid file format")

    # NV-4 FIX: Read and enforce size limit before writing to disk
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mdb") as temp_file:
        temp_file.write(content)
        temp_file_path = temp_file.name

    try:
        data = process_mdb_data(temp_file_path)
        return {"success": True, "data": data}
    except Exception:
        # NV-4 FIX: Generic error response
        raise HTTPException(status_code=500, detail="Internal processing error")
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
