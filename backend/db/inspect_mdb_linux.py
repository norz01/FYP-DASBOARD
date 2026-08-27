#!/usr/bin/env python3
"""
inspect_mdb_linux.py
Standalone MDB schema dump utility.
Prints all tables, their columns, and 3 sample rows using mdbtools.
Uses Python's csv module to correctly handle quoted fields containing
embedded commas and newlines (e.g. student addresses).
"""

import csv
import io
import os
import subprocess
import sys

# Path to the MDB file (same directory as this script)
MDB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Ekspot_Senat.mdb")


def get_tables():
    """Return list of all table names in the MDB file."""
    result = subprocess.run(["mdb-tables", MDB_PATH], capture_output=True, text=True, check=True)
    return result.stdout.strip().split()


def get_rows(table):
    """Return all rows of a table as a list of lists.
    Row 0 is the header (column names); rows 1+ are data."""
    result = subprocess.run(["mdb-export", MDB_PATH, table], capture_output=True, text=True, check=True)
    reader = csv.reader(io.StringIO(result.stdout))
    return list(reader)


def main():
    if not os.path.exists(MDB_PATH):
        print(f"[ERROR] MDB file not found at: {MDB_PATH}")
        sys.exit(1)

    print(f"=== Inspecting MDB: {MDB_PATH} ===\n")

    try:
        tables = get_tables()
    except FileNotFoundError:
        print("[ERROR] 'mdb-tables' not found. Install it with: sudo dnf install mdbtools")
        sys.exit(1)

    if not tables:
        print("[ERROR] No tables found.")
        sys.exit(1)

    print(f"Found {len(tables)} tables:\n{', '.join(tables)}\n")

    for table in tables:
        print(f"\n{'=' * 60}")
        print(f"TABLE: {table}")
        print("=" * 60)

        try:
            rows = get_rows(table)
        except subprocess.CalledProcessError as e:
            print(f"[ERROR] Could not export table: {e}")
            continue

        if not rows:
            print("  (no rows)")
            continue

        header = rows[0]
        data = rows[1:]
        print(f"Columns ({len(header)}): {', '.join(header)}")
        print(f"Total data rows: {len(data)}")

        if data:
            print("\nSample rows (up to 3):")
            for i, row in enumerate(data[:3], start=1):
                print(f"  [{i}] {row}")


if __name__ == "__main__":
    main()