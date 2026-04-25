import os
from typing import Dict, Any, List, Optional
from app.utils.logger import get_logger

logger = get_logger(__name__)

_db = None
_firestore_available = False

# In-memory fallback store: shipment_id -> dict
_memory_store: Dict[str, Dict[str, Any]] = {}


def _init_firestore() -> None:
    global _db, _firestore_available
    path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")
    if not path or not os.path.exists(path):
        logger.warning(
            "FIREBASE_SERVICE_ACCOUNT_PATH not set / file not found. "
            "Using in-memory store (data lost on restart)."
        )
        return
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore as fs

        if not firebase_admin._apps:
            cred = credentials.Certificate(path)
            firebase_admin.initialize_app(cred)
        _db = fs.client()
        _firestore_available = True
        logger.info("Firestore connected ✓")
    except Exception as exc:
        logger.error(f"Firestore init error: {exc} — falling back to in-memory store")


def is_connected() -> bool:
    return _firestore_available


# ── Write / Update ─────────────────────────────────────────────────────────

def write_shipment(data: Dict[str, Any]) -> None:
    sid = data["id"]
    if _firestore_available:
        _db.collection("shipments").document(sid).set(data)
    else:
        _memory_store[sid] = data


def update_shipment_fields(sid: str, fields: Dict[str, Any]) -> None:
    if _firestore_available:
        _db.collection("shipments").document(sid).update(fields)
    else:
        if sid in _memory_store:
            _memory_store[sid].update(fields)


# ── Read ───────────────────────────────────────────────────────────────────

def get_all_shipments() -> List[Dict[str, Any]]:
    if _firestore_available:
        docs = _db.collection("shipments").stream()
        return [d.to_dict() for d in docs]
    return list(_memory_store.values())


def get_shipment(sid: str) -> Optional[Dict[str, Any]]:
    if _firestore_available:
        doc = _db.collection("shipments").document(sid).get()
        return doc.to_dict() if doc.exists else None
    return _memory_store.get(sid)


def delete_all_shipments() -> None:
    if _firestore_available:
        docs = _db.collection("shipments").stream()
        for d in docs:
            d.reference.delete()
    else:
        _memory_store.clear()


def shipment_count() -> int:
    if _firestore_available:
        return len(list(_db.collection("shipments").stream()))
    return len(_memory_store)
