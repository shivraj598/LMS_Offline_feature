/**
 * Tenant resolution + catalog access.
 *
 * In production the tenant is the subdomain: tuitioncentre1.lms.com. Locally you
 * can force one with ?tenant=tuitioncentre2 (handy because localhost has no
 * subdomain), and /etc/hosts can map tuitioncentre1.lms.local for a real test.
 *
 * The catalog is bundled JSON so the service worker precaches it: the student
 * can open the LMS and see their lessons with no internet at all.
 */
import catalog from '../../shared/catalog.json';

export const DEFAULT_TENANT_ID = 'tuitioncentre1';

export function resolveTenantId({ hostname = '', search = '' } = {}) {
  const params = new URLSearchParams(search || '');
  const override = params.get('tenant');
  if (override && catalog.tenants.some((tenant) => tenant.id === override)) return override;

  const host = String(hostname).split(':')[0].toLowerCase();
  const firstLabel = host.split('.')[0];
  const known = catalog.tenants.find((tenant) => tenant.id === firstLabel);
  if (known) return known.id;

  // Anything else (localhost, preview URLs, custom domains) falls back to the
  // default tenant; a real deployment would ask the API "which tenant is this?".
  return DEFAULT_TENANT_ID;
}

export function resolveTenantFromLocation() {
  if (typeof window === 'undefined') {
    return { tenantId: DEFAULT_TENANT_ID, hostname: '', search: '' };
  }
  const { hostname, search } = window.location;
  return { tenantId: resolveTenantId({ hostname, search }), hostname, search };
}

export function getTenant(tenantId) {
  return catalog.tenants.find((tenant) => tenant.id === tenantId) || catalog.tenants[0];
}

export function listCourses(tenantId) {
  return catalog.courses.filter((course) => course.tenantId === tenantId);
}

export function findCourse(tenantId, courseId) {
  return listCourses(tenantId).find((course) => course.id === courseId) || null;
}

export function findLesson(tenantId, courseId, lessonId) {
  const course = findCourse(tenantId, courseId);
  if (!course) return { course: null, lesson: null };
  return { course, lesson: course.lessons.find((lesson) => lesson.id === lessonId) || null };
}

export function lessonCount(tenantId) {
  return listCourses(tenantId).reduce((total, course) => total + course.lessons.length, 0);
}

/** Can this lesson ever be saved offline? (streaming-only lessons cannot.) */
export function isStreamOnly(lesson) {
  return !lesson?.sourceUrl;
}

export function allTenants() {
  return catalog.tenants;
}
