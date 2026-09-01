import subprocess
import pandas as pd
import numpy as np
import os
import shutil
from pathlib import Path
from datetime import datetime

# ============================================================
# TVETMARA Besut - Multi-MDB Training Data Extractor
# Extracts from JJ2025.mdb, JD2025.mdb, JJ2026.mdb
# Applies new rule-based Status_Pelajar labels
# ============================================================

MDB_FILES = [
    "JJ2025.mdb",
    "JD2025.mdb",
    "JJ2026.mdb"
]

REQUIRED_TABLES = [
    "pelajar",
    "Daftar_Subjek",
    "GPA",
    "Detail_Result",
    "Anugerah"
]

EXTRACT_ROOT = Path("mdb_extracted")
OUTPUT_CSV = Path("ml_training_data_real.csv")

PLO_COLS = [f"PLO_{i}" for i in range(1, 10)]


# ------------------------------------------------------------
# Utility helpers
# ------------------------------------------------------------

def run_command(cmd):
    print(f"   $ {' '.join(cmd)}")
    subprocess.run(cmd, check=True)


def get_actual_table_names(mdb_path):
    """
    Uses mdb-tables to list all tables inside the MDB file.
    """
    try:
        output = subprocess.check_output(
            ["mdb-tables", "-1", str(mdb_path)],
            text=True,
            stderr=subprocess.DEVNULL
        )
        tables = [line.strip() for line in output.splitlines() if line.strip()]
        return tables
    except Exception as e:
        print(f"  ⚠️ Could not list tables from {mdb_path}: {e}")
        return []


def find_table_case_insensitive(table_list, wanted_table):
    """
    MDB table names may differ by case.
    Example: Pelajar vs pelajar.
    """
    for table in table_list:
        if table.lower() == wanted_table.lower():
            return table
    return None


def safe_read_csv(path):
    """
    Reads CSV safely. Returns empty DataFrame if file is empty or missing.
    """
    path = Path(path)

    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame()

    try:
        df = pd.read_csv(path)
    except pd.errors.EmptyDataError:
        return pd.DataFrame()

    if not df.empty and "No_Pelajar" in df.columns:
        df["No_Pelajar"] = df["No_Pelajar"].astype(str).str.strip()

    return df


def to_bool_series(series):
    """
    Converts different boolean-like values into proper True/False.
    Handles: 1, 0, True, False, 'TRUE', 'FALSE', 'YA', 'TIDAK', etc.
    """
    def convert(value):
        if pd.isna(value):
            return False

        if isinstance(value, (bool, np.bool_)):
            return bool(value)

        s = str(value).strip().lower()

        if s in ["0", "false", "no", "n", "tidak", "f", "nan", ""]:
            return False

        if s in ["1", "true", "y", "yes", "ya", "t", "gugur", "lulus"]:
            return True

        try:
            return float(s) != 0.0
        except:
            return False

    return series.map(convert)


# ------------------------------------------------------------
# Extraction step
# ------------------------------------------------------------

def extract_tables_from_mdb(mdb_path, output_dir):
    """
    Extracts required tables from one MDB file into CSV files.
    """
    mdb_path = Path(mdb_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n📦 Extracting tables from {mdb_path.name}...")

    available_tables = get_actual_table_names(mdb_path)

    for required_table in REQUIRED_TABLES:
        csv_path = output_dir / f"{required_table}.csv"

        if csv_path.exists():
            print(f"  ⏩ {csv_path.name} already exists, skipping extraction.")
            continue

        actual_table = find_table_case_insensitive(available_tables, required_table)

        if actual_table is None:
            print(f"  ⚠️ Table '{required_table}' not found in {mdb_path.name}. Creating empty CSV.")
            csv_path.write_text("")
            continue

        try:
            with open(csv_path, "w", encoding="utf-8") as f:
                subprocess.run(
                    ["mdb-export", str(mdb_path), actual_table],
                    stdout=f,
                    check=True
                )
            print(f"  ✅ Extracted {actual_table} -> {csv_path}")
        except subprocess.CalledProcessError:
            print(f"  ❌ Failed to extract {actual_table}")
            csv_path.write_text("")


# ------------------------------------------------------------
# Process one MDB extraction folder
# ------------------------------------------------------------

def process_one_mdb(mdb_path, source_name):
    mdb_path = Path(mdb_path)
    extract_dir = EXTRACT_ROOT / source_name

    extract_tables_from_mdb(mdb_path, extract_dir)

    print(f"\n📊 Processing {source_name}...")

    # ------------------------------------------------------------
    # 1. Read pelajar table
    # ------------------------------------------------------------
    df_pelajar = safe_read_csv(extract_dir / "pelajar.csv")

    if df_pelajar.empty:
        print(f"⚠️ No usable 'pelajar' data found in {source_name}. Skipping this MDB.")
        return pd.DataFrame()

    required_pelajar_cols = [
        "No_Pelajar",
        "Kod_Kursus_Pelajar",
        "Semester_Pelajar",
        "Jantina",
        "Kod_Negeri_Pelajar"
    ]

    for col in required_pelajar_cols:
        if col not in df_pelajar.columns:
            if col == "Semester_Pelajar":
                df_pelajar[col] = 1
            else:
                df_pelajar[col] = ""

    df_pelajar = df_pelajar[required_pelajar_cols].copy()
    df_pelajar["Semester_Pelajar"] = pd.to_numeric(
        df_pelajar["Semester_Pelajar"],
        errors="coerce"
    ).fillna(1).astype(int)

    df_pelajar = df_pelajar.drop_duplicates(subset=["No_Pelajar"], keep="last")

    # ------------------------------------------------------------
    # 2. PLO scores from Detail_Result
    # ------------------------------------------------------------
    df_detail = safe_read_csv(extract_dir / "Detail_Result.csv")

    plo_pivot = pd.DataFrame(columns=["No_Pelajar"] + PLO_COLS)

    if not df_detail.empty and all(col in df_detail.columns for col in ["No_Pelajar", "Kod_Ujian", "Markah"]):
        print("🎯 Extracting PLO scores from Detail_Result...")

        df_detail["Markah"] = pd.to_numeric(df_detail["Markah"], errors="coerce")
        df_detail["PLO_Num"] = pd.to_numeric(
            df_detail["Kod_Ujian"].astype(str).str.extract(r"LO(\d+)", expand=False),
            errors="coerce"
        )

        # NEW: auto-exclude subjects with LO > 9 (internal CLO scheme, e.g. DUA20102)
        excluded_subjects = set(df_detail.loc[df_detail["PLO_Num"] > 9, "Kod_Subjek"].dropna().unique())
        if excluded_subjects:
            print(f"⚠️ Subjek dikecualikan daripada PLO (LO>9): {sorted(excluded_subjects)}")

        df_plo = df_detail.dropna(subset=["PLO_Num", "Markah"]).copy()
        df_plo = df_plo[~df_plo["Kod_Subjek"].isin(excluded_subjects)]
        df_plo["PLO_Num"] = df_plo["PLO_Num"].astype(int)
        df_plo = df_plo[(df_plo["PLO_Num"] >= 1) & (df_plo["PLO_Num"] <= 9)]

        if not df_plo.empty:
            plo_pivot = df_plo.pivot_table(
                index="No_Pelajar",
                columns="PLO_Num",
                values="Markah",
                aggfunc="mean"
            ).reset_index()

            plo_pivot = plo_pivot.rename(
                columns={
                    col: f"PLO_{int(col)}"
                    for col in plo_pivot.columns
                    if col != "No_Pelajar"
                }
            )

            for col in PLO_COLS:
                if col not in plo_pivot.columns:
                    plo_pivot[col] = 0.0

            plo_pivot = plo_pivot[["No_Pelajar"] + PLO_COLS]
    else:
        print("⚠️ Detail_Result table missing required columns. PLO scores will be set to 0.")

    # ------------------------------------------------------------
    # 3. Subject-level features from Daftar_Subjek
    # ------------------------------------------------------------
    df_subjek = safe_read_csv(extract_dir / "Daftar_Subjek.csv")

    subjek_agg = pd.DataFrame(
        columns=[
            "No_Pelajar",
            "Total_Credit_Taken",
            "Avg_Subjek_Attendance",
            "Avg_Subjek_Marks",
            "Total_Dropped",
            "Total_Failed",
            "Total_Koko"
        ]
    )

    if not df_subjek.empty and "No_Pelajar" in df_subjek.columns:
        print("🧮 Aggregating Daftar_Subjek features...")

        if "Kehadiran" not in df_subjek.columns:
            df_subjek["Kehadiran"] = 0

        if "Markah_Purata" not in df_subjek.columns:
            df_subjek["Markah_Purata"] = 0

        if "Kredit" not in df_subjek.columns:
            df_subjek["Kredit"] = 0

        if "Gugur" not in df_subjek.columns:
            df_subjek["Gugur"] = 0

        if "Koko" not in df_subjek.columns:
            df_subjek["Koko"] = 0

        if "Gred" not in df_subjek.columns:
            df_subjek["Gred"] = ""

        df_subjek["Kehadiran"] = pd.to_numeric(df_subjek["Kehadiran"], errors="coerce").fillna(0)
        df_subjek["Markah_Purata"] = pd.to_numeric(df_subjek["Markah_Purata"], errors="coerce").fillna(0)
        df_subjek["Kredit"] = pd.to_numeric(df_subjek["Kredit"], errors="coerce").fillna(0)

        df_subjek["Gugur_bool"] = to_bool_series(df_subjek["Gugur"])
        df_subjek["Koko_bool"] = to_bool_series(df_subjek["Koko"])

        subjek_agg = df_subjek.groupby("No_Pelajar").agg(
            Total_Credit_Taken=("Kredit", "sum"),
            Avg_Subjek_Attendance=("Kehadiran", "mean"),
            Avg_Subjek_Marks=("Markah_Purata", "mean"),
            Total_Dropped=("Gugur_bool", "sum"),
            Total_Failed=("Gred", lambda x: (x.astype(str).str.strip().str.upper() == "F").sum()),
            Total_Koko=("Koko_bool", "sum")
        ).reset_index()

    # ------------------------------------------------------------
    # 4. Latest CGPA/GPA from GPA table
    # ------------------------------------------------------------
    df_gpa = safe_read_csv(extract_dir / "GPA.csv")

    latest_academic = pd.DataFrame(columns=["No_Pelajar", "CGPA", "GPA"])

    if not df_gpa.empty and "No_Pelajar" in df_gpa.columns:
        print("🎓 Getting latest CGPA/GPA...")

        df_gpa["CGPA"] = pd.to_numeric(df_gpa["CGPA"], errors="coerce")
        df_gpa["GPA"] = pd.to_numeric(df_gpa["GPA"], errors="coerce")

        if "Sem_Pelajar" in df_gpa.columns:
            df_gpa["Sem_Pelajar"] = pd.to_numeric(df_gpa["Sem_Pelajar"], errors="coerce").fillna(0)
        else:
            df_gpa["Sem_Pelajar"] = 0

        latest_academic = (
            df_gpa.sort_values("Sem_Pelajar", ascending=True)
            .drop_duplicates("No_Pelajar", keep="last")[["No_Pelajar", "CGPA", "GPA"]]
        )

    # ------------------------------------------------------------
    # 5. Award flag from Anugerah table
    # ------------------------------------------------------------
    df_anugerah = safe_read_csv(extract_dir / "Anugerah.csv")

    if not df_anugerah.empty and "No_Pelajar" in df_anugerah.columns:
        df_anugerah = df_anugerah[["No_Pelajar"]].drop_duplicates()
        df_anugerah["Has_Award"] = True
    else:
        df_anugerah = pd.DataFrame(columns=["No_Pelajar", "Has_Award"])

    # ------------------------------------------------------------
    # 6. Merge everything
    # ------------------------------------------------------------
    df_final = df_pelajar.merge(latest_academic, on="No_Pelajar", how="left")
    df_final = df_final.merge(df_anugerah, on="No_Pelajar", how="left")
    df_final = df_final.merge(subjek_agg, on="No_Pelajar", how="left")
    df_final = df_final.merge(plo_pivot, on="No_Pelajar", how="left")

    # Fill missing numeric values
    df_final["Total_Credit_Taken"] = pd.to_numeric(df_final["Total_Credit_Taken"], errors="coerce").fillna(0)
    df_final["Total_Dropped"] = pd.to_numeric(df_final["Total_Dropped"], errors="coerce").fillna(0)
    df_final["Total_Failed"] = pd.to_numeric(df_final["Total_Failed"], errors="coerce").fillna(0)
    df_final["Total_Koko"] = pd.to_numeric(df_final["Total_Koko"], errors="coerce").fillna(0)

    df_final["Avg_Subjek_Attendance"] = pd.to_numeric(
        df_final["Avg_Subjek_Attendance"],
        errors="coerce"
    ).fillna(80)

    df_final["Avg_Subjek_Marks"] = pd.to_numeric(
        df_final["Avg_Subjek_Marks"],
        errors="coerce"
    ).fillna(50)

    df_final["Has_Award"] = df_final["Has_Award"].fillna(False).astype(bool)

    for col in PLO_COLS:
        if col not in df_final.columns:
            df_final[col] = 0.0
        df_final[col] = pd.to_numeric(df_final[col], errors="coerce").fillna(0.0)

    df_final["Source_File"] = source_name

    # Remove accidental duplicates from the same source file
    df_final = df_final.drop_duplicates(subset=["No_Pelajar", "Source_File"], keep="last")

    print(f"✅ Finished processing {source_name}. Records: {len(df_final)}")

    return df_final


# ------------------------------------------------------------
# NEW RULE-BASED LABEL GENERATOR - OPTION 2
# Bermasalah if:
# CGPA < 3.00
# OR score < 70
# OR failed subjects > 0
# OR dropped subjects > 0
# OR attendance < 80
# ------------------------------------------------------------

def _safe_float(value, default=0.0):
    if value is None:
        return default

    try:
        if pd.isna(value):
            return default
    except Exception:
        pass

    try:
        return float(value)
    except Exception:
        return default


def _is_valid_recorded_number(value):
    if value is None:
        return False

    try:
        if pd.isna(value):
            return False
    except Exception:
        pass

    return str(value).strip() != ""


def generate_real_label(row):
    raw_cgpa = row.get("CGPA")
    cgpa_recorded = _is_valid_recorded_number(raw_cgpa)
    cgpa = _safe_float(raw_cgpa, 0.0)

    attendance = _safe_float(row.get("Avg_Subjek_Attendance"), 80.0)
    total_failed = _safe_float(row.get("Total_Failed"), 0.0)
    total_dropped = _safe_float(row.get("Total_Dropped"), 0.0)
    gpa = _safe_float(row.get("GPA"), 0.0)

    active_plos = []

    for col in PLO_COLS:
        value = _safe_float(row.get(col), 0.0)
        if value > 0:
            active_plos.append(value)

    plo_avg = sum(active_plos) / len(active_plos) if active_plos else 0.0

    academic_score = cgpa if cgpa > 0 else (gpa if gpa > 0 else 2.0)

    score = (
        (academic_score / 4.0 * 50.0) +
        (attendance * 0.25) +
        (plo_avg * 0.25)
    )

    score -= total_failed * 5.0
    score -= total_dropped * 3.0

    is_bermasalah = (
        (cgpa_recorded and cgpa < 3.00) or
        score < 70.0 or
        total_failed > 0 or
        total_dropped > 0 or
        attendance < 80.0
    )

    if is_bermasalah:
        return "Bermasalah"

    is_cemerlang = (
        cgpa_recorded and
        cgpa >= 3.90 and
        attendance >= 80.0 and
        len(active_plos) > 0 and
        all(value >= 80.0 for value in active_plos)
    )

    if is_cemerlang:
        return "Cemerlang"

    return "Sederhana"


# ------------------------------------------------------------
# Main execution
# ------------------------------------------------------------

def main():
    all_frames = []

    for mdb_file in MDB_FILES:
        mdb_path = Path(mdb_file)

        if not mdb_path.exists():
            print(f"\n❌ File not found: {mdb_file}")
            continue

        source_name = mdb_path.stem
        df_one = process_one_mdb(mdb_path, source_name)

        if not df_one.empty:
            all_frames.append(df_one)

    if not all_frames:
        print("\n❌ No data extracted from any MDB file.")
        return

    df_final = pd.concat(all_frames, ignore_index=True)

    print("\n🏷️ Generating new ground-truth labels...")
    df_final["Status_Pelajar"] = df_final.apply(generate_real_label, axis=1)

    # Backup old CSV if it exists
    if OUTPUT_CSV.exists():
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = OUTPUT_CSV.with_name(f"{OUTPUT_CSV.stem}_backup_{timestamp}.csv")
        shutil.copy2(OUTPUT_CSV, backup_path)
        print(f"\n💾 Old training CSV backed up to: {backup_path}")

    df_final.to_csv(OUTPUT_CSV, index=False)

    print("\n" + "=" * 60)
    print("🚀 SUCCESS! Combined 3-semester training data saved.")
    print("=" * 60)
    print(f"Output file       : {OUTPUT_CSV}")
    print(f"Total rows        : {len(df_final)}")
    print(f"Unique students   : {df_final['No_Pelajar'].nunique()}")
    print(f"Duplicate students: {len(df_final) - df_final['No_Pelajar'].nunique()}")

    print("\nLabel distribution:")
    print(df_final["Status_Pelajar"].value_counts())

    print("\nSource distribution:")
    print(df_final["Source_File"].value_counts())

    if df_final["No_Pelajar"].duplicated().any():
        print("\n⚠️ Notice: Some students appear in multiple MDB files.")
        print("   This is okay, but training should use a group-aware split.")
        print("   Use the updated train_and_evaluate_v4.py provided below.")


if __name__ == "__main__":
    main()