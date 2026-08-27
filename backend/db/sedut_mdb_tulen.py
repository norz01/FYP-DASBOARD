import subprocess
import csv
import json
import io
import re
import os

# Automatically resolves the path relative to where this script is located
DB_PATH = os.path.join(os.path.dirname(__file__), "Ekspot_Senat.mdb")

def get_table_data(table_name):
    try:
        result = subprocess.run(['mdb-export', DB_PATH, table_name], stdout=subprocess.PIPE, text=True, check=True)
        return list(csv.DictReader(io.StringIO(result.stdout)))
    except:
        return []

def main():
    print("=== EKSTRAK MUKTAMAD: MENYEDUT KESEMUA DATA RELEVAN TVETMARA ===")
    students = {}

    # 1. DATA ASAS & CGPA + SEJARAH AKADEMIK PER SEMESTER (Dari GPA)
    for row in get_table_data('GPA'):
        no = row['No_Pelajar']
        try:
            sem = int(row['Sem_Pelajar'])
            cgpa = float(row['CGPA'])
        except (ValueError, TypeError):
            continue
        try:
            gpa = float(row['GPA'])          # GPA semester ini
        except (KeyError, ValueError, TypeError):
            gpa = cgpa                       # fallback jika lajur GPA tiada

        if no not in students:
            students[no] = {
                'ID_Pelajar': no,
                'Nama': 'Tiada Rekod',
                'Kursus': 'Tiada Rekod',
                'Semester': 0,
                'CGPA': '0.00',
                'Kehadiran_Pct': '0',
                'Anugerah': False,
                'Koko_Lulus': False,
                'Status_Pelajar': 'Pending AI',
                'Sijil_Profesional': 'Tiada',
                'PLO_Scores': {f"PLO_{i}": [] for i in range(1, 10)},
                '_sem_terkini': 0,
                '_history': {},              # BAHARU: sejarah per semester
            }

        s = students[no]

        # BAHARU: simpan SATU entri sejarah bagi setiap semester
        if sem not in s['_history']:
            s['_history'][sem] = {'gpa': gpa, 'cgpa': cgpa}

        # Semester terkini & CGPA terkini (untuk kad CGPA di atas)
        if sem > s['_sem_terkini']:
            s['_sem_terkini'] = sem
            s['Semester'] = sem
            s['CGPA'] = f"{cgpa:.2f}"

    # 2. NAMA & KURSUS (Dari pelajar)
    for row in get_table_data('pelajar'):
        no = row['No_Pelajar']
        if no in students:
            students[no]['Nama'] = row.get('Nama_Pelajar', 'Tiada Nama')
            students[no]['Kursus'] = row.get('Kod_Kursus_Pelajar', 'Tiada Kursus')

    # 3. KEHADIRAN (Dari Daftar_Subjek) — keseluruhan + per semester
    attendance_map = {}
    sem_attendance_map = {}
    for row in get_table_data('Daftar_Subjek'):
        no = row['No_Pelajar']
        if no in students and row.get('Kehadiran'):
            try:
                val = float(row['Kehadiran'])
            except (ValueError, TypeError):
                continue
            attendance_map.setdefault(no, []).append(val)
            # BAHARU: cuba kesan lajur semester jika wujud
            sem_raw = row.get('Sem_Pelajar') or row.get('Semester') or row.get('Kod_Semester')
            if sem_raw:
                m = re.search(r'(\d+)', str(sem_raw))
                if m:
                    sem_attendance_map.setdefault(no, {}).setdefault(int(m.group(1)), []).append(val)

    for no, list_hadir in attendance_map.items():
        students[no]['Kehadiran_Pct'] = f"{sum(list_hadir)/len(list_hadir):.0f}"
    for no in students:
        students[no]['_sem_attendance'] = sem_attendance_map.get(no, {})

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

        # BAHARU: bina academicHistory (GPA + kehadiran per semester)
        history = []
        sem_att = data.get('_sem_attendance', {})
        for sem in sorted(data.get('_history', {}).keys()):
            rec = data['_history'][sem]
            att_list = sem_att.get(sem)
            attendance = f"{sum(att_list)/len(att_list):.0f}" if att_list else data['Kehadiran_Pct']
            history.append({
                'semester': sem,
                'gpa': f"{rec['gpa']:.2f}",
                'cgpa': f"{rec['cgpa']:.2f}",
                'attendance': attendance,
            })
        data['academicHistory'] = history

        del data['PLO_Scores']
        del data['_sem_terkini']
        del data['_history']
        del data['_sem_attendance']
        final_list.append(data)

    output_path = 'data_tvet_muktamad.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(final_list, f, indent=4)

    print(f"\n=== SELESAI ===\nFail '{output_path}' telah dijana dengan data lengkap + academicHistory.")

if __name__ == "__main__":
    main()