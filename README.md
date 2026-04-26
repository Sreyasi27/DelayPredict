# 🚀 SupplyAI — Smart Supply Chain Optimization System

> Real-time disruption prediction and dynamic rerouting powered by AI/ML.
> Built for hackathon demonstration — production-grade architecture.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Google Maps JS API + Recharts |
| Backend | Python 3.11 + FastAPI |
| Database | Firebase Firestore (with in-memory fallback) |
| ML | scikit-learn RandomForestClassifier |
| APIs | OpenWeatherMap API, Google Maps Directions API |

---

## 📁 Project Structure

```
project/
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── main.py              # FastAPI app factory + startup
│       ├── api/routes.py        # All 5 endpoints
│       ├── models/schemas.py    # Pydantic schemas
│       ├── ml/model.py          # RandomForest training + inference
│       ├── services/
│       │   ├── simulation.py    # Shipment generation + movement loop
│       │   ├── risk_engine.py   # ML + weather + traffic risk scoring
│       │   ├── route_optimizer.py # Dijkstra-based rerouting
│       │   ├── weather.py       # OpenWeatherMap API / mock
│       │   └── firestore_service.py # Firestore + in-memory store
│       └── utils/
│           ├── graph.py         # City graph + Dijkstra algorithm
│           └── logger.py        # Logging setup
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── .env.example
    └── src/
        ├── main.jsx             # React entry
        ├── App.jsx              # Router + Navbar
        ├── index.css            # Dark design system
        ├── services/
        │   ├── api.js           # Axios API client
        │   └── firebase.js      # Firestore SDK + fallback
        ├── hooks/
        │   ├── useShipments.js  # Live shipment data
        │   └── useRisk.js       # Risk polling hook
        ├── pages/
        │   ├── Dashboard.jsx    # Main dashboard
        │   └── ShipmentDetail.jsx # Per-shipment detail + optimize
        └── components/
            ├── MapView.jsx      # Google Maps + SVG fallback
            ├── ShipmentCard.jsx # Shipment list card
            ├── RiskIndicator.jsx # Risk badge + progress bar
            ├── RouteComparison.jsx # Original vs optimized routes
            └── AnalyticsPanel.jsx  # Recharts analytics
```

---

## ⚙️ Setup

### Prerequisites
- Python 3.10+
- Node.js 18+

---

### Step 1 — Clone / Open the project

```bash
cd project
```

---

### Step 2 — Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Create .env file
copy .env.example .env
```

Edit `backend/.env`:

```env
OPENWEATHERMAP_API_KEY=your_key_here   # or leave blank to use mock data
WEATHER_MODE=mock                       # change to "live" when you have the key
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json  # optional
CORS_ORIGINS=http://localhost:5173
```

> **No Firebase?** That's fine — the system uses an in-memory store automatically.
> Data will reset on server restart but everything works for demo purposes.

---

### Step 3 — Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
copy .env.example .env
```

Edit `frontend/.env`:

```env
VITE_GOOGLE_MAPS_API_KEY=your_key_here   # or leave blank for SVG map fallback
VITE_API_BASE_URL=http://localhost:8000

# Firebase (optional — leave defaults to use REST polling)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=...
# etc.
```

---

### Step 4 — Run the system

**Terminal 1 — Backend:**
```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/health` | Health check + model status |
| POST | `/api/v1/simulate-shipments` | Generate 5 new shipments |
| GET | `/api/v1/shipments` | Get all current shipments |
| GET | `/api/v1/shipments/{id}` | Get single shipment |
| GET | `/api/v1/predict-risk/{id}` | ML risk prediction for shipment |
| POST | `/api/v1/optimize-route` | Dijkstra route optimization |

Interactive docs: **http://localhost:8000/docs**

---

## 🔑 API Key Setup

### OpenWeatherMap (Free tier)
1. Sign up at https://openweathermap.org/api
2. Go to API Keys tab
3. Copy your key → `OPENWEATHERMAP_API_KEY` in `backend/.env`
4. Set `WEATHER_MODE=live`

### Google Maps
1. Go to https://console.cloud.google.com/
2. Create a project → Enable:
   - **Maps JavaScript API**
   - **Directions API**
3. Create an API key → `VITE_GOOGLE_MAPS_API_KEY` in `frontend/.env`

### Firebase (Optional)
1. Go to https://console.firebase.google.com/
2. Create project → Enable **Firestore** (Native mode)
3. **Backend key**: Project Settings → Service Accounts → Generate new private key → save as `backend/firebase-service-account.json`
4. **Frontend key**: Project Settings → Your Apps → Add Web App → copy config values to `frontend/.env`

---

## 🧠 ML Model

- **Algorithm**: RandomForestClassifier (100 trees, max_depth=8)
- **Training data**: 2000 synthetic samples generated at startup
- **Features**: distance, weather_severity, traffic_congestion, historical_delay_flag
- **Output**: delay probability (0–1)
- **Saved to**: `backend/app/ml/model.pkl` (reused on restart)

---

## 🗺️ Route Network

10 Indian cities connected by 17 weighted road corridors:
Delhi, Mumbai, Kolkata, Chennai, Hyderabad, Bengaluru, Pune, Ahmedabad, Jaipur, Lucknow

Route weights are dynamically adjusted based on:
- Weather severity per city (0–10)
- Traffic congestion score (0–10)

---

## 🚀 How it works

1. **Startup**: Backend trains ML model → generates 5 shipments → starts simulation loop
2. **Every 15s**: Simulation loop advances each shipment one city along its route → writes to Firestore (or memory)
3. **Frontend**: Subscribes to Firestore in real-time (or polls REST API every 8s as fallback)
4. **Risk prediction**: Click any shipment → backend fetches weather + traffic → runs ML model → returns probability + reasons
5. **Route optimization**: Click "Optimize Route" → backend runs Dijkstra with live disruption weights → returns original vs optimized route comparison

---

## 📦 Deployment (Optional)

### Backend → Google Cloud Run
```bash
cd backend
gcloud run deploy supply-chain-api \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars WEATHER_MODE=live,OPENWEATHERMAP_API_KEY=xxx
```

### Frontend → Firebase Hosting
```bash
cd frontend
npm run build
firebase deploy --only hosting
```
