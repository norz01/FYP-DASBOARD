import subprocess
import os

MDB_PATH = "db/Ekspot_Senat.mdb"

if not os.path.exists(MDB_PATH):
    print(f"Error: Could not find {MDB_PATH}. Please check the path.")
    exit()

print("="*50)
print(f"INSPECTING: {MDB_PATH}")
print("="*50)

# 1. Get all tables using mdb-tables
try:
    result = subprocess.run(["mdb-tables", "-1", MDB_PATH], capture_output=True, text=True, check=True)
    tables = result.stdout.strip().split('\n')
    
    print("\nTABLES FOUND IN DATABASE:")
    for name in tables:
        if name:
            print(f" - {name}")
            
    print("\n" + "="*50)
    print("SCHEMA AND SAMPLE DATA FOR EACH TABLE")
    print("="*50)
    
    # 2. Inspect each table
    for table in tables:
        if not table:
            continue
            
        print(f"\n--- TABLE: {table} ---")
        
        # Get first 4 rows of CSV data (Header + 3 rows)
        try:
            export_result = subprocess.run(["mdb-export", MDB_PATH, table], capture_output=True, text=True, check=True)
            lines = export_result.stdout.strip().split('\n')
            
            if lines:
                print("Columns:", lines[0]) # The first line is the header/columns
                print("Sample Data (First 3 rows):")
                for line in lines[1:4]:
                    print(line)
            else:
                print("Table is empty.")
                
        except subprocess.CalledProcessError as e:
            print(f"Could not export table: {e.stderr}")

except FileNotFoundError:
    print("Error: 'mdb-tables' command not found. Did you run 'sudo dnf install mdbtools'?")
except Exception as e:
    print(f"An unexpected error occurred: {e}")
