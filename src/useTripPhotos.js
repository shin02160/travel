import { useEffect, useState } from 'react';

export function useTripPhotos(tripId) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      let value;
      try {
        const response = await fetch(`/api/trips/${tripId}?section=photos`, {
          signal: controller.signal, credentials: 'same-origin', cache: 'no-store',
        });
        if (response.status === 401) value = { needsPin: true };
        else if (response.ok) {
          const data = await response.json();
          if (!Array.isArray(data.photos)) throw new Error('Invalid photo response');
          value = { data };
        } else value = { error: true };
      } catch {
        value = { error: true };
      }
      if (!controller.signal.aborted) setResult({ tripId, revision, ...value });
    }
    void load();
    return () => controller.abort();
  }, [tripId, revision]);
  return {
    result: result?.tripId === tripId && result.revision === revision ? result : null,
    retry: () => setRevision(value => value + 1),
  };
}
