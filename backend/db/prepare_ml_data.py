import subprocess
import pandas as pd
import os
import re
import numpy as np

MDB_PATH = 'Ekspot_Senat.mdb'

# 1. Extract tables to CSV using mdb-tools
tables_to_extract = ['pelajar', 'Daftar_Subjek', 'GPA', 'Detail_Result', 'Anugerah']

print("🔄 Extracting tables from MDB file...")
for table in tables_to_extract:
    csv_file = f"{table}.csv"
    if not os.path.exists(csv_file):
        try:
            subprocess.run(['mdb-export', MDB_PATH, table], stdout=open(csv_file, 'w'), check=True)
            print(f"  ✅ Extracted {table} -> {csv_file}")
        except subprocess.CalledProcessError:
            print(f"  ❌ Failed to extract {table}")
    else:
        print(f"  ⏩ {csv_file} already exists, skipping extraction.")

# 2. Load into Pandas DataFrames
print("\n📊 Processing Data...")
df_pelajar = pd.read_csv('pelajar.csv')
df_subjek = pd.read_csv('Daftar_Subjek.csv')
df_gpa = pd.read_csv('GPA.csv')
df_detail = pd.read_csv('Detail_Result.csv')
df_anugerah = pd.read_csv('Anugerah.csv')

# 3. Extract PLO Scores from Detail_Result
print("🎯 Extracting PLO Scores from Detail_Result...")
df_detail['Markah'] = pd.to_numeric(df_detail['Markah'], errors='coerce')
df_detail['PLO_Num'] = df_detail['Kod_Ujian'].astype(str).str.extract(r'LO(\d+)')
df_plo = df_detail.dropna(subset=['PLO_Num', 'Markah']).copy()
df_plo['PLO_Num'] = df_plo['PLO_Num'].astype(int)
df_plo = df_plo[(df_plo['PLO_Num'] >= 1) & (df_plo['PLO_Num'] <= 9)]

plo_pivot = df_plo.pivot_table(index='No_Pelajar', columns='PLO_Num', values='Markah', aggfunc='mean')
plo_pivot.columns = [f'PLO_{int(col)}' for col in plo_pivot.columns]
plo_pivot = plo_pivot.reset_index()

# 4. Feature Engineering from Daftar_Subjek
df_subjek['Kehadiran'] = pd.to_numeric(df_subjek['Kehadiran'], errors='coerce').fillna(0)
df_subjek['Markah_Purata'] = pd.to_numeric(df_subjek['Markah_Purata'], errors='coerce').fillna(0)
df_subjek['Kredit'] = pd.to_numeric(df_subjek['Kredit'], errors='coerce').fillna(0)
df_subjek['Gugur'] = df_subjek['Gugur'].astype(bool)
df_subjek['Koko'] = df_subjek['Koko'].astype(bool)
df_subjek['Gred'] = df_subjek['Gred'].astype(str)

subjek_agg = df_subjek.groupby('No_Pelajar').agg(
    Total_Credit_Taken=('Kredit', 'sum'),
    Avg_Subjek_Attendance=('Kehadiran', 'mean'),
    Avg_Subjek_Marks=('Markah_Purata', 'mean'),
    Total_Dropped=('Gugur', 'sum'),
    Total_Failed=('Gred', lambda x: (x == 'F').sum()),
    Total_Koko=('Koko', 'sum')
).reset_index()

# 5. Get latest CGPA/GPA from GPA table (has records for ALL students)
df_gpa['CGPA'] = pd.to_numeric(df_gpa['CGPA'], errors='coerce')
df_gpa['GPA'] = pd.to_numeric(df_gpa['GPA'], errors='coerce')
latest_academic = df_gpa.sort_values('Sem_Pelajar', ascending=False).drop_duplicates('No_Pelajar')
latest_academic = latest_academic[['No_Pelajar', 'CGPA', 'GPA']]

# Get Awards from Anugerah table
df_anugerah['Has_Award'] = True
df_anugerah = df_anugerah[['No_Pelajar', 'Has_Award']]

# 6. Merge everything
df_final = df_pelajar[['No_Pelajar', 'Kod_Kursus_Pelajar', 'Semester_Pelajar', 'Jantina', 'Kod_Negeri_Pelajar']].merge(latest_academic, on='No_Pelajar', how='left')
df_final = df_final.merge(df_anugerah, on='No_Pelajar', how='left')
df_final = df_final.merge(subjek_agg, on='No_Pelajar', how='left')
df_final = df_final.merge(plo_pivot, on='No_Pelajar', how='left') 

# Fill NaNs
df_final['Total_Credit_Taken'] = df_final['Total_Credit_Taken'].fillna(0)
df_final['Total_Dropped'] = df_final['Total_Dropped'].fillna(0)
df_final['Total_Failed'] = df_final['Total_Failed'].fillna(0)
df_final['Total_Koko'] = df_final['Total_Koko'].fillna(0)
df_final['Avg_Subjek_Attendance'] = df_final['Avg_Subjek_Attendance'].fillna(80)
df_final['Avg_Subjek_Marks'] = df_final['Avg_Subjek_Marks'].fillna(50)
df_final['Has_Award'] = df_final['Has_Award'].fillna(False)

plo_cols = [f'PLO_{i}' for i in range(1, 10)]
for col in plo_cols:
    if col not in df_final.columns:
        df_final[col] = 0
    df_final[col] = df_final[col].fillna(0)

# 7. Generate Realistic Ground Truth Labels
def generate_real_label(row):
    active_plos = [row[col] for col in plo_cols if row[col] > 0]
    is_cemerlang = (
        pd.notna(row['CGPA']) and row['CGPA'] >= 3.75 and row['Avg_Subjek_Attendance'] >= 80 and len(active_plos) > 0 and all(p >= 80 for p in active_plos)
    )
    if is_cemerlang:
        return "Cemerlang"
    academic_score = row['CGPA'] if pd.notna(row['CGPA']) and row['CGPA'] > 0 else row['GPA']
    academic_score = academic_score if pd.notna(academic_score) and academic_score > 0 else 2.0
    plo_avg = row[plo_cols].mean()
    score = (academic_score / 4.0 * 50) + (row['Avg_Subjek_Attendance'] * 0.25) + (plo_avg * 0.25)
    score -= (row['Total_Failed'] * 5)
    score -= (row['Total_Dropped'] * 3)
    noise = np.random.normal(0, 5)
    final_score = score + noise
    if final_score < 70:
        return "Bermasalah"
    else:
        return "Sederhana"
df_final['Status_Pelajar'] = df_final.apply(generate_real_label, axis=1)

# Save the final dataset
output_csv = 'ml_training_data_real.csv'
df_final.to_csv(output_csv, index=False)
print(f"\n🚀 SUCCESS! Real training data saved to {output_csv}")
print(f"Total records: {len(df_final)}")
print("\nLabel Distribution:")
print(df_final['Status_Pelajar'].value_counts())
print("\nSample Data:")
print(df_final.head())