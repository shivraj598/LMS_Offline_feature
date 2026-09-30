/**
 * Owner-side lesson management.
 *
 * The workflow this module exists for:
 *   1. the tuition centre uploads its lecture videos to YouTube (unlisted is fine)
 *   2. the owner pastes the YouTube URL into Owner Studio
 *   3. the lesson appears immediately for students as a streamable YouTube embed
 *   4. whether it can also be downloaded for offline viewing is decided by the
 *      API's /source endpoint — the centre's own video file, or their own
 *      YouTube upload resolved server-side with yt-dlp (ENABLE_YTDLP=1)
 *
 * In this build the catalog is bundled JSON (shared/catalog.json) so the app
 * shell works offline, so owner-added courses and lessons are persisted in the
 * browser (localStorage) and merged on top of it, and POSTed to the API where
 * it is reachable — which is where a real deployment would write its database.
 */
import { parseYoutubeId } from './youtube.js';
import { listCourses } from '../data/catalog.js';

const STORAGE_KEY = 'lms.owner.catalog.v1';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeAll(all) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* private mode / quota: added lessons still work for this session */
  }
}

function overridesFor(tenantId) {
  const all = readAll();
  return all[tenantId] || { courses: [], lessons: {} };
}

function persistOverrides(tenantId, next) {
  const all = readAll();
  all[tenantId] = next;
  writeAll(all);
}

function slugify(value) {
  return (
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'lesson'
  );
}

/** Courses for the tenant, with owner-added courses/lessons merged in. */
export function listCoursesWithOverrides(tenantId) {
  const overrides = overridesFor(tenantId);
  const courses = listCourses(tenantId).map((course) => {
    const added = overrides.lessons[course.id];
    return added?.length ? { ...course, lessons: [...course.lessons, ...added] } : course;
  });
  const addedCourses = (overrides.courses || []).map((course) => ({
    ...course,
    lessons: overrides.lessons[course.id] || [],
  }));
  return [...courses, ...addedCourses];
}

/**
 * Owner action: turn a YouTube URL into a lesson.
 * Returns { ok, lesson?, downloadable?, message? } — `downloadable` is what
 * the API reported (null when unreachable; the lesson streams either way).
 */
export async function addLessonFromYoutube(tenantId, courseId, { youtubeUrl, title } = {}) {
  const videoId = parseYoutubeId(youtubeUrl);
  if (!videoId) {
    return {
      ok: false,
      message:
        'That does not look like a YouTube link. Paste a URL like https://youtu.be/XXXXXXXXXXX or https://www.youtube.com/watch?v=…',
    };
  }

  const course = listCoursesWithOverrides(tenantId).find((item) => item.id === courseId);
  if (!course) return { ok: false, message: 'Pick a course for this lesson first.' };

  const duplicate = course.lessons.find((item) => parseYoutubeId(item.youtubeUrl) === videoId);
  if (duplicate) {
    return { ok: false, message: `"${duplicate.title}" already uses this video in ${course.title}.` };
  }

  const finalTitle = String(title || '').trim() || `Lesson ${course.lessons.length + 1}`;
  let id = `l-${slugify(finalTitle)}-${videoId.slice(0, 4).toLowerCase()}`;
  if (course.lessons.some((item) => item.id === id)) id = `${id}-${Date.now().toString(36)}`;

  const lesson = {
    id,
    title: finalTitle,
    topic: '',
    durationSec: 0,
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };

  const overrides = overridesFor(tenantId);
  persistOverrides(tenantId, {
    ...overrides,
    lessons: { ...overrides.lessons, [courseId]: [...(overrides.lessons[courseId] || []), lesson] },
  });

  // Best-effort sync to the API — the server is where a real deployment
  // persists lessons and where yt-dlp resolution gets enabled.
  let downloadable = null;
  try {
    const response = await fetch(
      `/api/tenant/${encodeURIComponent(tenantId)}/courses/${encodeURIComponent(courseId)}/lessons`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(lesson),
      },
    );
    if (response.ok) {
      const data = await response.json().catch(() => null);
      downloadable = typeof data?.downloadable === 'boolean' ? data.downloadable : null;
    }
  } catch {
    /* offline or API down: the local copy stands until sync works */
  }

  return { ok: true, lesson, courseId, downloadable };
}

/** Owner action: create an empty course to attach lessons to. */
export function createCourse(tenantId, { title, subject, teacher } = {}) {
  const finalTitle = String(title || '').trim();
  if (!finalTitle) return { ok: false, message: 'Give the course a title first.' };

  const overrides = overridesFor(tenantId);
  const courses = overrides.courses || [];
  let id = `c-${slugify(finalTitle)}`;
  if (
    courses.some((course) => course.id === id) ||
    listCourses(tenantId).some((course) => course.id === id)
  ) {
    id = `${id}-${Date.now().toString(36)}`;
  }

  const course = {
    id,
    tenantId,
    title: finalTitle,
    subject: String(subject || '').trim() || 'General',
    teacher: String(teacher || '').trim() || '',
    description: '',
    lessons: [],
  };
  persistOverrides(tenantId, { ...overrides, courses: [...courses, course] });
  return { ok: true, course };
}
