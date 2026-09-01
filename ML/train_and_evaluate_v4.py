import pandas as pd
import joblib
import numpy as np

from sklearn.model_selection import (
    train_test_split,
    GridSearchCV,
    GroupShuffleSplit
)
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    classification_report,
    accuracy_score,
    confusion_matrix
)

# ============================================================
# TVETMARA Besut - Model Training V4
# Uses updated 3-semester real data
# Uses group-aware split if same student appears multiple times
# ============================================================

DATA_PATH = "../backend/db/ml_training_data_real.csv"
MODEL_V4_PATH = "model_ai_risiko_lengkap_v4.pkl"

# 1. Load data
print("📂 Loading training data...")
df = pd.read_csv(DATA_PATH, dtype={"No_Pelajar": str})

print(f"Total training rows: {len(df)}")

# 2. Preprocess data
df["CGPA"] = pd.to_numeric(df["CGPA"], errors="coerce")
df["CGPA"] = df["CGPA"].fillna(df["CGPA"].median())

df["Avg_Subjek_Attendance"] = pd.to_numeric(
    df["Avg_Subjek_Attendance"],
    errors="coerce"
).fillna(80)

plo_cols = [f"PLO_{i}" for i in range(1, 10)]

for col in plo_cols:
    df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

# 3. Feature engineering
df["PLO_Avg"] = df[plo_cols].mean(axis=1)
df["PLO_Variance"] = df[plo_cols].var(axis=1)

# 4. Prepare X and y
features = (
    ["CGPA", "Avg_Subjek_Attendance"] +
    plo_cols +
    ["PLO_Avg", "PLO_Variance"]
)

X = df[features]
y = df["Status_Pelajar"]

# Optional group column
groups = None
if "No_Pelajar" in df.columns:
    groups = df["No_Pelajar"].astype(str)

print("\n📊 Full label distribution:")
print(y.value_counts())

# 5. Train/test split
# If the same student appears multiple times, use GroupShuffleSplit.
if groups is not None and groups.duplicated().any() and groups.nunique() > 3:
    print("\n👥 Multiple snapshots per student detected.")
    print("   Using GroupShuffleSplit to prevent student-level data leakage.")

    gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_idx, test_idx = next(gss.split(X, y, groups))

    X_train = X.iloc[train_idx]
    X_test = X.iloc[test_idx]
    y_train = y.iloc[train_idx]
    y_test = y.iloc[test_idx]
    groups_train = groups.iloc[train_idx]
    groups_test = groups.iloc[test_idx]

    print(f"Training students  : {groups_train.nunique()}")
    print(f"Testing students   : {groups_test.nunique()}")

else:
    print("\n🧩 No repeated students detected. Using normal train/test split.")

    if y.value_counts().min() < 2:
        print("⚠️ A class has fewer than 2 samples. Disabling stratification.")
        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=0.2,
            random_state=42
        )
    else:
        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=0.2,
            random_state=42,
            stratify=y
        )

print("\n🏋️ Training label distribution:")
print(y_train.value_counts())

print("\n🧪 Testing label distribution:")
print(y_test.value_counts())

# 6. Choose safe cross-validation size
min_class_count = y_train.value_counts().min()

if min_class_count >= 5:
    cv_folds = 5
elif min_class_count >= 2:
    cv_folds = 3
else:
    cv_folds = 2
    print("⚠️ Very small minority class detected. Using cv=2 to avoid fold issues.")

print(f"\n🔧 Starting hyperparameter tuning with cv={cv_folds}...")

param_grid = {
    "n_estimators": [100, 200, 300],
    "max_depth": [None, 10, 20],
    "min_samples_split": [2, 5, 10],
    "class_weight": ["balanced", None]
}

rf = RandomForestClassifier(random_state=42)

grid_search = GridSearchCV(
    estimator=rf,
    param_grid=param_grid,
    cv=cv_folds,
    scoring="f1_weighted",
    n_jobs=-1
)

grid_search.fit(X_train, y_train)

best_model = grid_search.best_estimator_

# 7. Evaluation
print("\n✅ Model training complete!")
print(f"Best parameters: {grid_search.best_params_}\n")

y_pred = best_model.predict(X_test)

print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}\n")

print("Classification Report:")
print(classification_report(y_test, y_pred, zero_division=0))

print("Confusion Matrix:")
print(confusion_matrix(y_test, y_pred))

# 8. Save model
joblib.dump(best_model, MODEL_V4_PATH)

print(f"\n🚀 Saved new model as: {MODEL_V4_PATH}")
print("\nNext step: update ML/ml.py to load model_ai_risiko_lengkap_v4.pkl")