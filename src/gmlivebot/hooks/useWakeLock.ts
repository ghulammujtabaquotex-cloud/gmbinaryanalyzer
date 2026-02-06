import { useState, useEffect, useCallback } from 'react';

export const useWakeLock = (enabled: boolean = true) => {
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

  const requestLock = useCallback(async () => {
    if (!enabled) return;
    try {
      if ('wakeLock' in navigator) {
        const lock = await navigator.wakeLock.request('screen');
        setWakeLock(lock);
        console.log("Wake Lock Active: Screen will stay on.");

        lock.addEventListener('release', () => {
          console.log('Wake Lock Released');
          setWakeLock(null);
        });
      }
    } catch (err) {
      console.warn("Wake Lock failed (battery saver or unsupported):", err);
    }
  }, [enabled]);

  const releaseLock = useCallback(async () => {
    if (wakeLock) {
      try {
        await wakeLock.release();
        setWakeLock(null);
      } catch {
        // ignore
      }
    }
  }, [wakeLock]);

  useEffect(() => {
    if (enabled) {
      requestLock();
    } else {
      releaseLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled && !wakeLock) {
        requestLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseLock();
    };
  }, [enabled, requestLock, releaseLock]);

  return { isLocked: !!wakeLock };
};
