import subprocess
import pandas as pd
import json
import os

MDB_PATH = 'Ekspot_Senat.mdb'
JSON_PATH = 'data_tvet_muktamad.json'

# 1. Extract tables if they don't exist
for table in ['GPA', 'Daftar_Subjek']:
    csv_file = f"{table}.csv"
    if not os.path.exists(csv_file):
        subprocess.run(['mdb-export', MDB_PATH, table], stdout=open(csv_file, 'w'), check=True)

# 2. Load Data
df_gpa = pd.read_csv('GPA.csv', dtype={'No_Pelajar': str})
df_subjek = pd.read_csv('Daftar_Subjek.csv', dtype={'No_Pelajar': str})

# Clean any hidden quotes or spaces in the ID column
df_gpa['No_Pelajar'] = df_gpa['No_Pelajar'].str.strip().str.replace('"', '')
df_subjek['No_Pelajar'] = df_subjek['No_Pelajar'].str.strip().str.replace('"', '')

# 3. Process CGPA per Semester
df_gpa['CGPA'] = pd.to_numeric(df_gpa['CGPA'], errors='coerce')
df_gpa = df_gpa.dropna(subset=['CGPA', 'Sem_Pelajar'])
gpa_history = df_gpa.sort_values('Sem_Pelajar').drop_duplicates(['No_Pelajar', 'Sem_Pelajar'], keep='last')

# 4. Process Attendance per Semester
df_subjek['Kehadiran'] = pd.to_numeric(df_subjek['Kehadiran'], errors='coerce')
df_subjek = df_subjek.dropna(subset=['Kehadiran', 'Sem_Pelajar'])

# 🔥 PENYELESAIAN: Tapis keluar nilai 0 (subjek yang belum direkodkan kehadirannya)
df_subjek = df_subjek[df_subjek['Kehadiran'] > 0]

attendance_history = df_subjek.groupby(['No_Pelajar', 'Sem_Pelajar'])['Kehadiran'].mean().reset_index()

# 5. Merge History
history_df = pd.merge(gpa_history[['No_Pelajar', 'Sem_Pelajar', 'CGPA']], attendance_history, on=['No_Pelajar', 'Sem_Pelajar'], how='left')
# Jika tiada rekod kehadiran langsung, kita anggap 100 (assume perfect if no data)
history_df['Kehadiran'] = history_df['Kehadiran'].fillna(100)

# Group by student
history_dict = {}
for student_id, group in history_df.groupby('No_Pelajar'):
    history_dict[str(student_id)] = [
        {"semester": int(row['Sem_Pelajar']), "cgpa": round(row['CGPA'], 2), "attendance": round(row['Kehadiran'])}
        for _, row in group.iterrows()
    ]

# 6. Update JSON
with open(JSON_PATH, 'r', encoding='utf-8') as f:
    students = json.load(f)

updated_count = 0
for student in students:
    student_id = student['ID_Pelajar']
    if student_id in history_dict:
        student['academicHistory'] = history_dict[student_id]
        updated_count += 1
    else:
        student['academicHistory'] = []

with open(JSON_PATH, 'w', encoding='utf-8') as f:
    json.dump(students, f, indent=4)

print(f"✅ Successfully updated {updated_count} students with academic history in data_tvet_muktamad.json!")