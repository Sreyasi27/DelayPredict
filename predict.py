import pandas as pd
import pickle
import numpy as np
import sqlite3
import os

def save_to_history(distance, weight, traffic, risk, status):
    if not os.path.exists('database'):
        os.makedirs('database')
        
    conn = sqlite3.connect('database/db.sqlite3')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO shipments (distance, weight, traffic_score, risk_percent, status)
        VALUES (?, ?, ?, ?, ?)
    ''', (distance, weight, traffic, risk, status))
    conn.commit()
    conn.close()

def get_smart_prediction(distance, weather_s, traffic, weight, rating):
    try:
        with open('random_forest_delay_model.pkl', 'rb') as f:
            model = pickle.load(f)
    except FileNotFoundError:
        return {"error": "Model file not found!"}

    cols = [
        'origin', 'destination', 'vehicle_type', 'distance_km', 
        'weather_condition', 'weather_severity', 'traffic_density_score', 
        'weight_kg', 'carrier_rating'
    ]
    
    input_df = pd.DataFrame([[0, 0, 0, distance, 0, weather_s, traffic, weight, rating]], 
                            columns=cols)

    prediction = model.predict(input_df)[0]
    probability = model.predict_proba(input_df)[0][1]
    importances = model.feature_importances_

    return {
        "is_delayed": int(prediction),
        "risk_percent": round(probability * 100, 2),
        "status": "Delayed" if prediction == 1 else "On-Time",
        "importance_scores": importances.tolist()
    }

if __name__ == "__main__":
    # Testing the Values
    dist, wgt, traf = 250, 1500, 0.8
    test_stats = get_smart_prediction(dist, 2, traf, wgt, 3.5)
    
    if "error" in test_stats:
        print(f"Error: {test_stats['error']}")
    else:
        save_to_history(dist, wgt, traf, test_stats['risk_percent'], test_stats['status'])
        
        print("\n--- SMART SUPPLY CHAIN PREDICTION ---")
        print(f"Risk Level: {test_stats['risk_percent']}%")
        print(f"Prediction: {test_stats['status']}")
        print(f"Factor Weights: {test_stats['importance_scores']}")
        print("\n[SUCCESS] Shipment data saved to database/db.sqlite3")