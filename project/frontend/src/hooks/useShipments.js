import { useState, useEffect, useRef } from 'react';
import { subscribeToShipments, firebaseAvailable } from '../services/firebase';
import { getShipments } from '../services/api';

const POLL_INTERVAL = 8000; // ms — used when Firestore is not available

/**
 * Returns live shipments array.
 * Uses Firestore real-time listener if configured,
 * otherwise falls back to polling the REST API.
 */
export function useShipments() {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    if (firebaseAvailable) {
      // ── Firestore real-time path ───────────────────────────────────────
      const unsub = subscribeToShipments((data) => {
        setShipments(data);
        setLoading(false);
        setError(null);
      });
      return () => unsub();
    } else {
      // ── REST polling fallback ──────────────────────────────────────────
      const fetchAll = async () => {
        try {
          const data = await getShipments();
          setShipments(data || []);
          setError(null);
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };

      fetchAll();
      pollRef.current = setInterval(fetchAll, POLL_INTERVAL);
      return () => clearInterval(pollRef.current);
    }
  }, []);

  return { shipments, loading, error };
}
