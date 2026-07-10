import subprocess
import csv
import json
import io
import re

DB_PATH = "/home/norz/projek/fyp/TVETMARA-Besut-Skills-Talent-Development-Dashboard/db/Ekspot_Senat.mdb"

def get_table_data(table_name):
    try:
        result = subprocess.run(['mdb-export', DB_PATH, table_name], stdout=subprocess.PIPE, text=True, check=True)
        return list(csv.DictReader(io.StringIO(result.stdout)))
    except:
        return []

def main():
    print("=== EKSTRAK MUKTAMAD: MENYEDUT KESEMUA DATA RELEVAN TVETMARA ===")
    students = {}

    # 1. DATA ASAS & CGPA (Dari GPA)
    for row in get_table_data('GPA'):
        no = row['No_Pelajar']
        sem = int(row['Sem_Pelajar'])
        cgpa = float(row['CGPA'])
        
        if no not in students or sem > students[no]['_sem_terkini']:
            students[no] = {
                'ID_Pelajar': no,
                'Nama': 'Tiada Rekod',
                'Kursus': 'Tiada Rekod',
                'Semester': sem,              # DATA TAMBAHAN
                'CGPA': f"{cgpa:.2f}",
                'Kehadiran_Pct': '0',
                'Anugerah': False,            # DATA TAMBAHAN
                'Koko_Lulus': False,          # DATA TAMBAHAN
                'Status_Pelajar': 'Pending AI',
                'Sijil_Profesional': 'Tiada',
                'PLO_Scores': {f"PLO_{i}": [] for i in range(1, 10)},
                '_sem_terkini': sem
            }

    # 2. NAMA & KURSUS (Dari pelajar)
    for row in get_table_data('pelajar'):
        no = row['No_Pelajar']
        if no in students:
            students[no]['Nama'] = row.get('Nama_Pelajar', 'Tiada Nama')
            students[no]['Kursus'] = row.get('Kod_Kursus_Pelajar', 'Tiada Kursus')

    # 3. KEHADIRAN (Dari Daftar_Subjek)
    attendance_map = {}
    for row in get_table_data('Daftar_Subjek'):
        no = row['No_Pelajar']
        if no in students and row['Kehadiran']:
            try: attendance_map.setdefault(no, []).append(float(row['Kehadiran']))
            except: continue
    
    for no, list_hadir in attendance_map.items():
        students[no]['Kehadiran_Pct'] = f"{sum(list_hadir)/len(list_hadir):.0f}"

    # 4. MARKAH PLO (Dari Detail_Result)
    for row in get_table_data('Detail_Result'):
        no = row['No_Pelajar']
        if no in students:
            match = re.search(r'LO(\d+)', row['Kod_Ujian'])
            if match:
                idx = int(match.group(1))
                if 1 <= idx <= 9:
                    try: students[no]['PLO_Scores'][f"PLO_{idx}"].append(float(row['Markah']))
                    except: continue

    # 5. SEMAK ANUGERAH (Dari Anugerah)
    print("-> Menyemak rekod Anugerah...")
    for row in get_table_data('Anugerah'):
        no = row['No_Pelajar']
        if no in students:
            students[no]['Anugerah'] = True

    # 6. SEMAK KOKO (Dari Pelajar_Koko_Detail)
    print("-> Menyemak rekod Kokurikulum...")
    for row in get_table_data('Pelajar_Koko_Detail'):
        no = row['No_Pelajar']
        if no in students and row['Result'] == 'LULUS':
            students[no]['Koko_Lulus'] = True

    # --- FINALISASI ---
    final_list = []
    for no, data in students.items():
        for i in range(1, 10):
            key = f"PLO_{i}"
            list_markah = data['PLO_Scores'][key]
            data[key] = f"{sum(list_markah)/len(list_markah):.0f}" if list_markah else "0"
        
        del data['PLO_Scores']
        del data['_sem_terkini']
        final_list.append(data)

    output_path = 'data_tvet_muktamad.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(final_list, f, indent=4)
    
    print(f"\n=== SELESAI ===\nFail '{output_path}' telah dijana dengan data lengkap.")

if __name__ == "__main__":
    main()