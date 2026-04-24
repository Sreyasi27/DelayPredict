import sqlite3
import os

def init_db():
    if not os.path.exists('database'):
        os.makedirs('database')

    conn = sqlite3.connect('database/db.sqlite3')
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS shipments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            distance REAL,
            weight REAL,
            traffic_score REAL,
            risk_percent REAL,
            status TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()