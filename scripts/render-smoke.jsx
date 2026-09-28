/**
 * Render smoke test.
 *
 * Node cannot import .jsx directly and jsdom would be a heavy dependency, so we
 * let Vite build this entry as an SSR bundle and then run it:
 *
 *   npx vite build --ssr scripts/render-smoke.jsx --outDir tmp-smoke
 *   node tmp-smoke/render-smoke.js
 *
 * It renders the whole app shell for every route with react-dom/server and
 * checks the strings a student must see. This catches render-time crashes in
 * components that unit tests cannot reach (offline pages, player, downloads).
 */
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../src/App.jsx';

// Minimal browser surface used during render (effects do not run in SSR).
globalThis.window = {
  location: { hostname: 'tuitioncentre1.lms.com', search: '', hash: '#/' },
  addEventListener() {},
  removeEventListener() {},
};
// Node 22 ships a read-only `navigator`, so replace the property descriptor.
Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true },
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, 'localStorage', {
  value: { getItem: () => null, setItem: () => {} },
  configurable: true,
  writable: true,
});

const ROUTES = [
  { hash: '#/', expect: ['Tuition Centre 1', 'Grade 12 Physics - Mechanics', 'Download'] },
  { hash: '#/course/c-physics-12', expect: ['Newton&#x27;s Laws of Motion', 'Save all offline'] },
  { hash: '#/watch/c-physics-12/l-newton-laws', expect: ['Lessons in this course', 'youtube-nocookie.com/embed'] },
  { hash: '#/downloads', expect: ['Offline library', 'Where these files live'] },
  { hash: '#/settings', expect: ['Offline storage limit', 'Why not just download the file?'] },
  { hash: '#/nope', expect: ['Page not found'] },
];

let failures = 0;

for (const route of ROUTES) {
  window.location.hash = route.hash;
  let html = '';
  try {
    html = renderToStaticMarkup(<App />);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${route.hash} -> crashed: ${error.message}`);
    continue;
  }

  const missing = route.expect.filter((needle) => !html.includes(needle));
  if (missing.length) {
    failures += 1;
    console.error(`FAIL ${route.hash} -> missing ${JSON.stringify(missing)}`);
  } else {
    console.log(`ok   ${route.hash} (${html.length} bytes)`);
  }

  if (/undefined|NaN/.test(html)) {
    failures += 1;
    console.error(`FAIL ${route.hash} -> output contains undefined/NaN`);
  }
}

// A second tenant must resolve through its own subdomain.
window.location.hash = '#/';
window.location.hostname = 'tuitioncentre2.lms.com';
const otherTenant = renderToStaticMarkup(<App />);
if (otherTenant.includes('Tuition Centre 2') && !otherTenant.includes('Grade 12 Physics - Mechanics')) {
  console.log('ok   tenant resolution via subdomain (tuitioncentre2)');
} else {
  failures += 1;
  console.error('FAIL tenant resolution via subdomain');
}

if (failures) {
  console.error(`\n${failures} render smoke check(s) failed`);
  process.exit(1);
}
console.log('\nall render smoke checks passed');
