import { useState, useEffect, useRef } from 'react';
import { predictRisk } from '../services/api';

const REFRESH_INTERVAL = 15000; // poll every 15 seconds

/**
 * Fetches and auto-refreshes risk prediction for a given shipment ID.
 */
export function useRisk(shipmentId) {
  const [risk, setRisk] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!shipmentId) return;

    const fetch = async () => {
      setLoading(true);
      try {
        const data = await predictRisk(shipmentId);
        setRisk(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetch();
    intervalRef.current = setInterval(fetch, REFRESH_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [shipmentId]);

  const refresh = () => {
    if (!shipmentId) return;
    setLoading(true);
    predictRisk(shipmentId)
      .then((data) => { setRisk(data); setError(null); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  return { risk, loading, error, refresh };
}
