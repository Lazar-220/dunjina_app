import { useEffect, useState } from 'react';

export type Persistence = 'unknown' | 'persistent' | 'not-guaranteed';

/** Asks the browser to keep this site's data even under storage pressure, and reports the answer. */
export function useStoragePersistence(): Persistence {
  const [persistence, setPersistence] = useState<Persistence>('unknown');

  useEffect(() => {
    if (!('storage' in navigator) || typeof navigator.storage.persist !== 'function') return;
    let cancelled = false;
    navigator.storage
      .persist()
      .then((granted) => {
        if (!cancelled) setPersistence(granted ? 'persistent' : 'not-guaranteed');
      })
      .catch(() => {
        if (!cancelled) setPersistence('not-guaranteed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return persistence;
}
