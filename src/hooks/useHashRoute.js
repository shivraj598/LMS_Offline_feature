import { useCallback, useEffect, useState } from 'react';
import { parseHash } from '../lib/router.js';

/** Reactive hash route: { name, path, courseId?, lessonId? }. */
export function useHashRoute() {
  const [route, setRoute] = useState(() =>
    parseHash(typeof window === 'undefined' ? '' : window.location.hash),
  );

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    onChange();
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((hash) => {
    window.location.hash = hash;
  }, []);

  return { route, navigate };
}
