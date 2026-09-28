/**
 * Tiny hash router. Hash based on purpose: it needs no server rewrite rules, so
 * the same build works on tuitioncentre1.lms.com, tuitioncentre2.lms.com and on
 * a static host, and it keeps working when the app is opened offline.
 *
 * Pure functions only — the React binding lives in src/hooks/useHashRoute.js.
 */

export const ROUTES = {
  courses: '/',
  course: '/course',
  watch: '/watch',
  downloads: '/downloads',
  settings: '/settings',
};

const clean = (segments) => segments.filter(Boolean).map(decodeURIComponent);

export function parseHash(hash = '') {
  const raw = String(hash).replace(/^#/, '');
  const [pathPart] = raw.split('?');
  const segments = clean(pathPart.split('/'));

  if (!segments.length) return { name: 'courses', path: '/' };

  if (segments[0] === 'course' && segments[1]) {
    return { name: 'course', courseId: segments[1], path: pathPart };
  }
  if (segments[0] === 'watch' && segments[1] && segments[2]) {
    return { name: 'watch', courseId: segments[1], lessonId: segments[2], path: pathPart };
  }
  if (segments[0] === 'downloads') return { name: 'downloads', path: '/downloads' };
  if (segments[0] === 'settings') return { name: 'settings', path: '/settings' };

  return { name: 'notfound', path: pathPart };
}

export function courseHash(courseId) {
  return `#/course/${encodeURIComponent(courseId)}`;
}

export function watchHash(courseId, lessonId) {
  return `#/watch/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`;
}

export function downloadsHash() {
  return '#/downloads';
}

export function settingsHash() {
  return '#/settings';
}

export function coursesHash() {
  return '#/';
}
