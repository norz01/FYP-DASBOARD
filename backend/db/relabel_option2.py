import pandas as pd
from pathlib import Path
from datetime import datetime
import shutil

# ============================================================
# TVETMARA Besut - Option 2 Relabeling
# Bermasalah if:
# CGPA < 3.00
# OR score < 70
# OR failed subjects > 0
# OR dropped subjects > 0
# OR attendance < 80
# ============================================================

INPUT_CSV = Path("ml_training_data_real.csv")
OUTPUT_CSV = Path("ml_training_data_real.csv")

PLO_COLS = [f"PLO_{i}" for i in range(1, 10)]


def safe_float(value, default=0.0):
    """
    Safely convert value to float.
    Returns default if value is missing, NaN, or invalid.
    """
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


def is_valid_recorded_number(value):
    """
    Checks whether a value exists and is not empty/NaN.
    """
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
    cgpa_recorded = is_valid_recorded_number(raw_cgpa)
    cgpa = safe_float(raw_cgpa, 0.0)

    attendance = safe_float(row.get("Avg_Subjek_Attendance"), 80.0)
    total_failed = safe_float(row.get("Total_Failed"), 0.0)
    total_dropped = safe_float(row.get("Total_Dropped"), 0.0)
    gpa = safe_float(row.get("GPA"), 0.0)

    active_plos = []

    for col in PLO_COLS:
        value = safe_float(row.get(col), 0.0)
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

    # ------------------------------------------------------------
    # NEW BERMSALAH RULE - OR CONDITION
    # ------------------------------------------------------------
    is_bermasalah = (
        (cgpa_recorded and cgpa < 3.00) or
        score < 70.0 or
        total_failed > 0 or
        total_dropped > 0 or
        attendance < 80.0
    )

    if is_bermasalah:
        return "Bermasalah"

    # ------------------------------------------------------------
    # CEMERLANG RULE
    # ------------------------------------------------------------
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


def main():
    if not INPUT_CSV.exists():
        print(f"❌ File not found: {INPUT_CSV}")
        return

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = INPUT_CSV.with_name(
        f"{INPUT_CSV.stem}_before_option2_{timestamp}.csv"
    )

    shutil.copy2(INPUT_CSV, backup_path)
    print(f"💾 Backup saved: {backup_path}")

    df = pd.read_csv(INPUT_CSV)

    print("\nOld label distribution:")
    print(df["Status_Pelajar"].value_counts())

    df["Status_Pelajar"] = df.apply(generate_real_label, axis=1)

    print("\nNew label distribution:")
    print(df["Status_Pelajar"].value_counts())

    df.to_csv(OUTPUT_CSV, index=False)

    print(f"\n🚀 Saved updated labels to: {OUTPUT_CSV}")
    print(f"Total rows: {len(df)}")
    print(f"Unique students: {df['No_Pelajar'].nunique()}")


if __name__ == "__main__":
    main()
