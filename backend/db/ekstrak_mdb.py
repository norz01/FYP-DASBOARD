import pyodbc
import pandas as pd
import json

# 1. Sambung ke fail MDB (Pastikan path betul)
db_path = r'/home/norz/projek/fyp/TVETMARA-Besut-Skills-Talent-Development-Dashboard/db/Ekspot_Senat.mdb'
conn_str = (r'DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};'
            rf'DBQ={db_path};')

try:
    conn = pyodbc.connect(conn_str)
    cursor = conn.cursor()
    
    # 2. Lihat senarai table yang ada dalam MDB tu
    tables = [table.table_name for table in cursor.tables(tableType='TABLE')]
    print(f"Table yang dijumpai: {tables}")
    
    # 3. Katakan table nama 'Pelajar', kita ambil semua data
    table_name = tables[0] # Ambil table pertama
    query = f"SELECT * FROM {table_name}"
    
    # 4. Convert ke Pandas DataFrame dan Export ke JSON
    df = pd.read_sql(query, conn)
    
    # Save sebagai JSON (orient='records' jadikan ia format array JSON biasa)
    df.to_json('data_pelajar_baru.json', orient='records', indent=4)
    print("Berjaya ekstrak ke data_pelajar_baru.json!")
    
except Exception as e:
    print(f"Ralat: {e}")