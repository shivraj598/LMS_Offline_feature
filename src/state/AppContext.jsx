import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import * as downloads from '../lib/downloadManager.js';
import { JOB_STATUS } from '../lib/downloadManager.js';
import { getTenant, listCourses, resolveTenantFromLocation } from '../data/catalog.js';
import { isForcedOffline, setForcedOffline } from '../lib/net.js';
import { refreshStorage, requestPersistentStorage } from '../lib/storage.js';
import { useOffline } from '../hooks/useOnline.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const origin = useMemo(() => resolveTenantFromLocation(), []);
  const tenantId = origin.tenantId;
  const tenant = useMemo(() => getTenant(tenantId), [tenantId]);
  const courses = useMemo(() => listCourses(tenantId), [tenantId]);

  const snapshot = useSyncExternalStore(
    downloads.subscribe,
    downloads.getSnapshot,
    downloads.getSnapshot,
  );
  const offline = useOffline();

  const [notices, setNotices] = useState([]);
  const [simulateOffline, setSimulateOfflineState] = useState(() => isForcedOffline());
  const noticeSeq = useRef(0);

  const pushNotice = useCallback((notice) => {
    noticeSeq.current += 1;
    const id = noticeSeq.current;
    setNotices((current) => [...current, { id, ...notice }]);
    const timeout = notice.timeout ?? 7000;
    if (timeout > 0) {
      setTimeout(() => setNotices((current) => current.filter((item) => item.id !== id)), timeout);
    }
    return id;
  }, []);

  const dismissNotice = useCallback((id) => {
    setNotices((current) => current.filter((item) => item.id !== id));
  }, []);

  // Point the download manager at this tenant and load what is already saved.
  useEffect(() => {
    downloads.configure({ tenantId, capMb: tenant.maxOfflineMb });
    downloads.hydrate().catch((error) =>
      pushNotice({ tone: 'error', message: error?.message || 'Could not read offline storage.' }),
    );
    refreshStorage();
  }, [tenantId, tenant.maxOfflineMb, pushNotice]);

  // When the connection comes back, finish whatever was waiting for it.
  useEffect(() => {
    if (offline) return;
    for (const job of Object.values(snapshot.jobs)) {
      if (job?.code === 'offline' && job.status === JOB_STATUS.PAUSED) downloads.resume(job.key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline]);

  const setSimulatedOffline = useCallback(
    (value) => {
      setForcedOffline(value);
      setSimulateOfflineState(value);
      pushNotice({
        tone: value ? 'warn' : 'info',
        message: value
          ? 'Offline mode simulated: downloads pause and only saved lessons can play.'
          : 'Back online: streaming and downloads are available again.',
      });
    },
    [pushNotice],
  );

  const downloadLesson = useCallback(
    async (lesson, course, options = {}) => {
      const result = await downloads.enqueue(lesson, {
        tenantId,
        courseId: course?.id,
        courseTitle: course?.title,
        subject: course?.subject,
      });
      if (options.silent) return result;
      if (result.ok) {
        pushNotice({ tone: 'info', message: `Saving "${lesson.title}" for offline viewing…` });
        return result;
      }
      const messages = {
        'already-downloaded': `"${lesson.title}" is already saved on this device.`,
        'in-progress': `"${lesson.title}" is already downloading.`,
      };
      pushNotice({
        tone: 'error',
        message: result.message || messages[result.reason] || 'This lesson could not be saved offline.',
      });
      return result;
    },
    [tenantId, pushNotice],
  );

  const saveCourseOffline = useCallback(
    async (course) => {
      const results = await downloads.enqueueMany(course.lessons, {
        tenantId,
        courseId: course.id,
        courseTitle: course.title,
        subject: course.subject,
      });
      const queued = results.filter((result) => result.ok).length;
      const already = results.filter((result) => result.reason === 'already-downloaded').length;
      const blocked = results.filter(
        (result) => !result.ok && !['already-downloaded', 'in-progress'].includes(result.reason),
      );
      pushNotice({
        tone: blocked.length ? 'warn' : 'info',
        message: [
          queued ? `${queued} lesson${queued === 1 ? '' : 's'} queued for download.` : null,
          already ? `${already} already saved.` : null,
          blocked.length
            ? `${blocked.length} could not be queued (${blocked[0].message || blocked[0].reason}).`
            : null,
        ]
          .filter(Boolean)
          .join(' '),
      });
      return results;
    },
    [tenantId, pushNotice],
  );

  const removeDownload = useCallback(
    async (key, title) => {
      await downloads.remove(key);
      pushNotice({
        tone: 'info',
        message: `Removed ${title ? `"${title}"` : 'the lesson'} from this device. Storage freed.`,
      });
    },
    [pushNotice],
  );

  const clearAllDownloads = useCallback(async () => {
    const count = await downloads.clearAll();
    pushNotice({
      tone: 'info',
      message: `${count} offline lesson${count === 1 ? '' : 's'} removed from this device.`,
    });
  }, [pushNotice]);

  const verifyDownloads = useCallback(async () => {
    const results = await downloads.verifyAll();
    const broken = results.filter((result) => !result.ok).length;
    pushNotice({
      tone: broken ? 'warn' : 'info',
      message: broken
        ? `${broken} offline lesson${broken === 1 ? '' : 's'} lost some parts. Tap resume to repair them.`
        : 'All offline lessons are complete and playable.',
    });
    return results;
  }, [pushNotice]);

  const askPersistentStorage = useCallback(async () => {
    const granted = await requestPersistentStorage();
    pushNotice({
      tone: granted ? 'info' : 'warn',
      message: granted
        ? 'Your downloads are now protected from being cleared automatically.'
        : 'The browser refused persistent storage for this site. Downloads may be cleared when the device runs low on space.',
    });
    return granted;
  }, [pushNotice]);

  const value = useMemo(
    () => ({
      tenantId,
      tenant,
      courses,
      hostname: origin.hostname,
      offline,
      simulateOffline,
      setSimulatedOffline,
      downloads: snapshot,
      notices,
      pushNotice,
      dismissNotice,
      downloadLesson,
      saveCourseOffline,
      removeDownload,
      clearAllDownloads,
      verifyDownloads,
      askPersistentStorage,
      jobFor: (lesson) => snapshot.jobs[downloads.keyForLesson(tenantId, lesson.id)] || null,
    }),
    [
      tenantId,
      tenant,
      courses,
      origin.hostname,
      offline,
      simulateOffline,
      setSimulatedOffline,
      snapshot,
      notices,
      pushNotice,
      dismissNotice,
      downloadLesson,
      saveCourseOffline,
      removeDownload,
      clearAllDownloads,
      verifyDownloads,
      askPersistentStorage,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside <AppProvider>');
  return context;
}

export function statusLabel(job) {
  if (!job) return { tone: 'idle', text: 'Not saved' };
  switch (job.status) {
    case JOB_STATUS.DOWNLOADED:
      return { tone: 'done', text: 'Downloaded' };
    case JOB_STATUS.DOWNLOADING:
      return { tone: 'busy', text: `Downloading ${Math.floor(job.percent)}%` };
    case JOB_STATUS.QUEUED:
      return { tone: 'busy', text: 'Queued' };
    case JOB_STATUS.FINALISING:
      return { tone: 'busy', text: 'Finishing…' };
    case JOB_STATUS.PAUSED:
      return { tone: 'paused', text: 'Paused' };
    case JOB_STATUS.ERROR:
      return { tone: 'error', text: 'Failed' };
    default:
      return { tone: 'idle', text: 'Not saved' };
  }
}

/** "3 of 4 lessons saved offline (12 MB)" for course cards and headers. */
export function courseOfflineSummary(course, jobs, tenantId) {
  let saved = 0;
  let bytes = 0;
  let inProgress = 0;
  for (const lesson of course.lessons) {
    const job = jobs[downloads.keyForLesson(tenantId, lesson.id)];
    if (job?.status === JOB_STATUS.DOWNLOADED) {
      saved += 1;
      bytes += job.receivedBytes || 0;
    } else if (job?.status === JOB_STATUS.DOWNLOADING || job?.status === JOB_STATUS.QUEUED) {
      inProgress += 1;
    }
  }
  return { saved, total: course.lessons.length, bytes, inProgress, complete: saved === course.lessons.length };
}

