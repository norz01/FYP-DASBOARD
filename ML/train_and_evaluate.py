import pandas as pd
import joblib
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
import numpy as np

# 1. Load Real Data
DATA_PATH = '../backend/db/ml_training_data_real.csv'
df = pd.read_csv(DATA_PATH)

# 2. Preprocess Data
df['CGPA'] = pd.to_numeric(df['CGPA'], errors='coerce')
df['CGPA'] = df['CGPA'].fillna(df['CGPA'].median())

plo_cols = [f'PLO_{i}' for i in range(1, 10)]
for col in plo_cols:
    df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

# 3. Feature Engineering
df['PLO_Avg'] = df[plo_cols].mean(axis=1)
df['PLO_Variance'] = df[plo_cols].var(axis=1)

# 4. Prepare X and y
features = ['CGPA', 'Avg_Subjek_Attendance'] + plo_cols + ['PLO_Avg', 'PLO_Variance']
X = df[features]
y = df['Status_Pelajar']

# Stratify helps split the 5 Cemerlang and 27 Bermasalah evenly
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

# 5. Hyperparameter Tuning
print("🔧 Starting Hyperparameter Tuning on Real Data...")
param_grid = {
    'n_estimators': [100, 200, 300],
    'max_depth': [None, 10, 20],
    'min_samples_split': [2, 5, 10],
    'class_weight': ['balanced', None] 
}

rf = RandomForestClassifier(random_state=42)
grid_search = GridSearchCV(rf, param_grid, cv=5, scoring='f1_weighted', n_jobs=-1)
grid_search.fit(X_train, y_train)

best_model = grid_search.best_estimator_

# 6. Evaluation
print("\n✅ Model Training Complete on Real Data!")
print(f"Best Parameters: {grid_search.best_params_}\n")

y_pred = best_model.predict(X_test)

print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}\n")
print("Classification Report:")
print(classification_report(y_test, y_pred, zero_division=0))
print("Confusion Matrix:")
print(confusion_matrix(y_test, y_pred))

# 7. Save the v3 Model
MODEL_V3_PATH = 'model_ai_risiko_lengkap_v3.pkl'
joblib.dump(best_model, MODEL_V3_PATH)
print(f"\n🚀 Saved improved real-data model as {MODEL_V3_PATH}")