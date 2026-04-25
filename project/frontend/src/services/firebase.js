import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Guard against double-init in dev HMR
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let db = null;
let firebaseAvailable = false;

try {
  if (firebaseConfig.projectId && firebaseConfig.projectId !== 'your-firebase-project-id') {
    db = getFirestore(app);
    firebaseAvailable = true;
  }
} catch (err) {
  console.warn('[Firebase] Init failed — using REST polling fallback:', err.message);
}

/**
 * Subscribe to real-time shipment updates via Firestore.
 * Returns an unsubscribe function.
 * Falls back to a no-op if Firebase is unavailable.
 */
export function subscribeToShipments(callback) {
  if (!firebaseAvailable || !db) {
    console.info('[Firebase] Not configured — using REST polling');
    return () => {};
  }
  return onSnapshot(collection(db, 'shipments'), (snapshot) => {
    const shipments = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(shipments);
  });
}

/**
 * Subscribe to a single shipment document.
 */
export function subscribeToShipment(id, callback) {
  if (!firebaseAvailable || !db) return () => {};
  return onSnapshot(doc(db, 'shipments', id), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
  });
}

export { firebaseAvailable };
