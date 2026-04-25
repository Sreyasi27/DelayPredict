import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from app.utils.logger import get_logger
from app.ml.model import load_or_train
from app.services import firestore_service as db
from app.services.simulation import generate_shipments, start_simulation_loop
from app.api.routes import router

logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ────────────────────────────────────────────────────────────
    logger.info("=== Smart Supply Chain - Starting Up ===")

    # 1. Connect Firestore (graceful fallback to in-memory)
    db._init_firestore()

    # 2. Train / load ML model
    load_or_train()

    # 3. Generate initial shipments
    generate_shipments()

    # 4. Start background simulation loop (moves shipments every 15s)
    start_simulation_loop(interval=15)

    logger.info("=== Startup complete - ready to serve ===")
    yield

    # ── Shutdown ───────────────────────────────────────────────────────────
    from app.services.simulation import stop_simulation
    stop_simulation()
    logger.info("=== Shutdown complete ===")


app = FastAPI(
    title="Smart Supply Chain Optimization API",
    description="Real-time disruption prediction and dynamic rerouting for logistics.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────
_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:5173")
origins = [o.strip() for o in _origins_raw.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Router ─────────────────────────────────────────────────────────────────
app.include_router(router, prefix="/api/v1")


@app.get("/", tags=["root"])
def root():
    return {
        "service": "Smart Supply Chain Optimization API",
        "docs": "/docs",
        "health": "/api/v1/health",
    }
