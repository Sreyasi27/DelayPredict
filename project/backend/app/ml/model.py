import os
import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

from app.utils.logger import get_logger

logger = get_logger(__name__)
MODEL_PATH = Path(__file__).parent / "model.pkl"
_model: RandomForestClassifier = None


def generate_synthetic_data(n_samples: int = 2000) -> pd.DataFrame:
    """Generate labeled training data for delay prediction."""
    rng = np.random.RandomState(42)

    distance = rng.uniform(150, 2000, n_samples)
    weather_severity = rng.uniform(0, 10, n_samples)
    traffic_congestion = rng.uniform(0, 10, n_samples)
    historical_delay_flag = rng.randint(0, 2, n_samples)

    # Weighted scoring → probabilistic label
    delay_score = (
        0.0003 * distance
        + 0.07 * weather_severity
        + 0.08 * traffic_congestion
        + 0.15 * historical_delay_flag
    )
    noise = rng.normal(0, 0.05, n_samples)
    delay_prob = np.clip(delay_score + noise, 0, 1)
    delayed = (delay_prob > 0.45).astype(int)

    return pd.DataFrame(
        {
            "distance": distance,
            "weather_severity": weather_severity,
            "traffic_congestion": traffic_congestion,
            "historical_delay_flag": historical_delay_flag,
            "delayed": delayed,
        }
    )


def train_model() -> RandomForestClassifier:
    """Train RandomForest on synthetic data and persist to disk."""
    logger.info("Training delay-prediction model on synthetic dataset …")
    df = generate_synthetic_data()

    X = df[["distance", "weather_severity", "traffic_congestion", "historical_delay_flag"]]
    y = df["delayed"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=8,
        random_state=42,
        class_weight="balanced",
    )
    clf.fit(X_train, y_train)

    report = classification_report(y_test, clf.predict(X_test))
    logger.info(f"Model evaluation:\n{report}")

    joblib.dump(clf, MODEL_PATH)
    logger.info(f"Model saved to {MODEL_PATH}")
    return clf


def load_or_train() -> RandomForestClassifier:
    """Load saved model if it exists, otherwise train a new one."""
    global _model
    if MODEL_PATH.exists():
        logger.info(f"Loading model from {MODEL_PATH}")
        _model = joblib.load(MODEL_PATH)
    else:
        _model = train_model()
    return _model


def predict(
    distance: float,
    weather_severity: float,
    traffic_congestion: float,
    historical_delay_flag: int = 0,
) -> float:
    """Return delay probability (0.0–1.0)."""
    global _model
    if _model is None:
        _model = load_or_train()

    features = np.array([[distance, weather_severity, traffic_congestion, historical_delay_flag]])
    proba = _model.predict_proba(features)[0]
    delay_idx = list(_model.classes_).index(1)
    return float(proba[delay_idx])


def get_model() -> RandomForestClassifier:
    return _model
