import { useSyncExternalStore } from 'react';
import { isOffline, subscribeConnectivity } from '../lib/net.js';

function subscribe(callback) {
  const onOnline = () => callback();
  const onOffline = () => callback();
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  const unsubscribeStore = subscribeConnectivity(callback);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    unsubscribeStore();
  };
}

/** True when the app should behave as offline (real or simulated). */
export function useOffline() {
  return useSyncExternalStore(subscribe, isOffline, () => false);
}

/** True only when the browser reports a real connection (ignores simulation). */
export function useBrowserOnline() {
  return useSyncExternalStore(
    (callback) => {
      window.addEventListener('online', callback);
      window.addEventListener('offline', callback);
      return () => {
        window.removeEventListener('online', callback);
        window.removeEventListener('offline', callback);
      };
    },
    () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
    () => true,
  );
}
