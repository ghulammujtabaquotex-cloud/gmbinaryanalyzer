import { useEffect, useRef } from 'react';

const WORKER_SCRIPT = `
let intervalId;
self.onmessage = function(e) {
    if (e.data === 'start') {
        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(() => {
            self.postMessage('tick');
        }, 1000);
    } else if (e.data === 'stop') {
        if (intervalId) clearInterval(intervalId);
    }
};
`;

export const useWorkerTimer = (callback: () => void, isEnabled: boolean) => {
  const workerRef = useRef<Worker | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    workerRef.current = worker;

    worker.onmessage = () => {
      callbackRef.current();
    };

    worker.postMessage('start');

    return () => {
      worker.postMessage('stop');
      worker.terminate();
    };
  }, [isEnabled]);
};
