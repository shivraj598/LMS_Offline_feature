# LMS with offline video downloads

A small, real LMS for a tuition-centre SaaS, where the headline feature is
**"save this lesson on my device and watch it later without internet"** — like
YouTube Downloads: the video occupies device storage, never appears in the
device's files/gallery, is badged **Downloaded**, and plays with no network.

Built with React + Vite (no UI framework), a small Express API, real IndexedDB
storage, and a service worker so the app itself opens offline.

```
tuitioncentre1.lms.com   ->  tenant "tuitioncentre1" (Pro plan, 500 MB offline / student)
tuitioncentre2.lms.com   ->  tenant "tuitioncentre2" (Starter plan, 200 MB offline / student)
```

---

## 1. Quick start

```bash
npm install
npm run dev:all        # API on :8787 + Vite on :5173, prefixed logs
# open http://localhost:5173
```

Other scripts:

| script | what it does |
| --- | --- |
| `npm run dev:all` | API + web dev server together |
| `npm run dev` / `npm run dev:server` | just one of them |
| `npm test` | 33 unit + integration tests (`node:test`) |
| `npm run test:render` | renders every route with `react-dom/server` (smoke test) |
| `npm run test:all` | both of the above |
| `npm run build` / `npm run preview` | production build (service worker, offline app shell) |

**Tenant switching locally** (`?tenant=…`, because localhost has no subdomain):

- `http://localhost:5173/?tenant=tuitioncentre1` (default)
- `http://localhost:5173/?tenant=tuitioncentre2`

For a real subdomain test, add a hosts entry and open the tenant domain:

```
127.0.0.1 tuitioncentre1.lms.local
# then: http://tuitioncentre1.lms.local:5173
```

### Try the offline feature in 60 seconds

1. Open **Courses** → `Grade 12 Physics - Mechanics`.
2. Press **Download** on *Newton's Laws of Motion* (5 MB — watch the tray in the
   bottom-right: %, speed, pause/resume).
3. Press **Save all offline** on the course to queue the rest, including a 30 MB
   lesson that makes the chunked progress visible.
4. Toggle **Simulate offline** in the header (or turn off Wi-Fi) and press play:
   the downloaded lesson plays from local storage, YouTube-only lessons explain
   that they need internet.
5. Open **Downloads** for size, dates, offline posters and the storage meter.
   Remove a lesson to free space instantly.
6. Reload the page while a download is running — it comes back **paused** at the
   last whole chunk and finishes with **Resume**.
7. Settings → set **My limit** to 50 MB, then try the 30 MB lesson: it is refused
   *before* any bytes move, with an explanation.

---

## 2. How the offline feature works

```
┌─────────────────────── browser (app-private, per-origin storage) ───────────────────────┐
│  React app  ──►  download manager (one queue, 1 download at a time)                     │
│                     │  GET /api/tenant/:t/lessons/:id/source  ← entitlement + signed URL│
│                     │  GET  Range: bytes=<chunk>              ← 1 MiB window at a time  │
│                     ▼                                                                   │
│              IndexedDB  lms-offline                                                     │
│                 media : one record per lesson (status, bytes, poster, timestamps)        │
│                 chunks: the video bytes, 1 MiB per record (the resume unit)              │
│                 prefs : the student's own storage cap                                    │
│                     │                                                                   │
│  <video src=blob:…> ◄┘  reassembled on demand, plays offline                            │
│  service worker: precached app shell → the LMS opens with no internet                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                     ▲
                                     │ Express API (server/index.js)
                      resolves a lesson's downloadable URL, proxies bytes with Range + CORS
```

Why it behaves like YouTube Downloads:

- **Not on the device**: bytes live in the browser's private storage for the site
  (IndexedDB), so nothing shows up in Files/Downloads/Gallery, nothing can be
  shared or copied out, and "Remove" (or clearing site data) is how space is freed.
- **Downloaded badge**: lesson rows, course cards, the player, the sidebar and the
  library all show a `Downloaded` chip with the exact size and date read from
  storage.
- **Works with no internet**: the app shell is service-worker cached, the player
  plays a `blob:` URL built from the stored chunks, and offline thumbnails come
  from a poster frame captured out of the downloaded file.
- **Real download behaviour**: one queue, progress + speed, pause/resume that
  survives a reload, cancel, quota errors explained in plain words, and a
  per-tenant cap enforced before a download starts.

Storage schema (`src/lib/db.js`):

```
media  key: "tenantId::lessonId"
       { status, receivedBytes, totalBytes, chunkCount, mimeType, title, courseId,
         courseTitle, durationSec, youtubeUrl, sourceUrl, posterDataUrl,
         downloadedAt, lastAccessAt, error, code, via }
chunks key: "tenantId::lessonId::000123"    { mediaKey, index, bytes, blob }
prefs  key: "prefs"                         { capMb }
```

Chunked, resumable downloads (`src/lib/downloadManager.js`, `src/lib/chunkPlan.js`):

- 1 MiB chunks requested as `Range: bytes=start-end`. Only **whole** chunks are
  committed, so a resume is always byte-aligned (a partially received tail is
  deliberately dropped and re-fetched — re-downloading 1 MiB is cheap, mixing two
  ranges into one file would corrupt it).
- Progress is persisted every ~1.5 s, so a killed tab or a crash resumes at the
  last committed chunk instead of starting over.
- A server that ignores `Range` (200 instead of 206) is detected: the partial is
  thrown away and the download restarts cleanly.
- A 45 s stall watchdog aborts and parks the job as paused, keeping the progress.
- `QuotaExceededError` becomes "remove a downloaded lesson to free space", and the
  plan cap + device quota are both checked *before* the first request.

---

## 3. The YouTube part (read this before judging the feature)

A **browser cannot download a YouTube video**. Not a limitation of this code:
YouTube's media endpoints send no CORS headers for cross-origin reads, the
streams are signed/ciphered per player session, and downloading content you do
not own violates YouTube's Terms of Service. So this LMS is honest about it and
supports two kinds of lesson:

| lesson has | online | offline |
| --- | --- | --- |
| only `youtubeUrl` | plays in the YouTube iframe | **not downloadable** — the UI explains why |
| `sourceUrl` (the centre's own file) | plays embedded *or* from the file | **downloadable + plays offline** |

That is why the seed catalog mixes both, and why the API answers with an
explicit reason instead of failing silently:

```jsonc
// GET /api/tenant/tuitioncentre1/lessons/l-newton-laws/source
{ "downloadable": true, "url": "/api/media/proxy?url=…", "mimeType": "video/mp4",
  "sizeBytes": 5229245, "via": "api", "expiresAt": 1790531608097 }

// streaming-only lesson
HTTP 404 { "downloadable": false, "reason": "This lesson is streaming-only for now. …" }
```

Three ways a real tuition centre gets downloadable lessons, in order of good
practice:

1. **Their own asset store** (S3 / R2 / Bunny / Cloudflare Stream MP4) — the API
   returns a short-lived signed URL. This is what `sourceUrl` + the signed URL
   path models. Best quality control and cheapest bandwidth.
2. **Their own YouTube upload, resolved server-side with `yt-dlp`** — allowed for
   content *they own*, and the server (not the browser) is the right place for it:
   ```bash
   ENABLE_YTDLP=1 YTDLP_PATH=/opt/homebrew/bin/yt-dlp npm run dev:all
   ```
   The API then returns a direct MP4 URL which is proxied and chunk-downloaded
   exactly like case 1. Keep this behind the entitlement check and log it.
3. **Streaming only** — for third-party YouTube content, leave `sourceUrl` empty.
   Students watch online; the offline button politely refuses.

The demo catalog points `sourceUrl` at small public test clips
(`test-videos.co.uk`, `mdn.github.io`) so the whole flow works out of the box.
**Replace them with the tenant's own files** in `shared/catalog.json`.

### API endpoints (`server/index.js`)

| endpoint | purpose |
| --- | --- |
| `GET /api/health` | liveness + which hosts/tenants the API knows |
| `GET /api/tenant/:tenantId/catalog` | that tenant's courses (parity with the bundled catalog) |
| `GET /api/tenant/:tenantId/lessons/:lessonId/source` | **the download contract**: entitlement check, sign/serve a downloadable URL |
| `GET /api/media/proxy?url=…` | byte-range streaming proxy (adds CORS + `accept-ranges`, forwards `Range`/206) |
| `HEAD /api/media/proxy?url=…` | size probe |

Env knobs: `PORT`, `HOST`, `ENABLE_YTDLP`, `YTDLP_PATH`,
`ALLOWED_MEDIA_HOSTS=cdn.example.com,…` (host allow-list for the proxy — empty
means "allow anything", which is fine locally and **must be set in production**).

---

## 4. Project layout

```
shared/catalog.json          tenants + courses + lessons (one source of truth:
                             bundled into the app shell AND served by the API)
src/lib/
  db.js  idb.js              IndexedDB schema + promise wrapper
  chunkPlan.js               pure chunk/range/resume maths (unit tested)
  downloadManager.js         queue, chunked Range downloads, pause/resume, budget
  sourceResolver.js          lesson -> downloadable URL (API, then asset fallback)
  media.js                   chunks -> blob URL, offline poster-frame capture
  storage.js                 quota estimate, persist(), cap/budget checks
  net.js                     offline-aware fetch + simulated-offline switch
  youtube.js  router.js  format.js     small pure helpers
src/components/              Header, LessonRow, DownloadButton, DownloadedBadge,
                             LessonPlayer, DownloadTray, StorageMeter, Notices, …
src/pages/                   Courses, Course, Watch, Downloads, Settings
src/state/AppContext.jsx     tenant + catalog + one download store for the app
server/index.js              the LMS API (entitlement, source resolution, Range proxy)
scripts/dev-all.mjs          run API + Vite together with prefixed logs
scripts/render-smoke.jsx     renders every route in Node (SSR smoke test)
tests/                       unit tests, integration test, fake-indexeddb shim
```

---

## 5. Testing

```bash
npm run test:all     # 33 tests + 7 route renders
```

What is covered:

- **Unit** (`tests/offline-logic.test.mjs`): chunk maths (chunk count, range
  windows, clamped last request, restart when Range is unsupported, never NaN),
  `Content-Range` parsing, byte/size/duration formatting, YouTube URL parsing,
  the storage budget rules, and the hash router.
- **Integration** (`tests/download-manager.integration.test.mjs`): the real
  download manager against a real Express server, with IndexedDB from
  `tests/helpers/fake-idb.mjs`. It asserts byte-for-byte SHA-256 equality with
  the source file, exactly 4 chunks (3 × 1 MiB + a ragged tail), that a paused
  download keeps chunk-aligned bytes and resumes in ≤ 3 requests, that a
  range-ignoring server is handled without corruption, that a streaming-only
  lesson stores nothing and explains itself, that the plan cap blocks before any
  network traffic, that removing/clearing frees every chunk, and the
  API-unreachable fallback path.
- **Render smoke** (`npm run test:render`): builds `scripts/render-smoke.jsx`
  with Vite and renders every route (courses, course, watch, downloads, settings,
  404, second tenant) to catch render-time crashes.

Two bugs were found and fixed by that suite, worth knowing about:

1. the queue counted the just-queued job as "running", so with concurrency 1
   nothing ever started;
2. a network failure was classified as "offline" before reaching the
   asset-URL fallback.

Manual checklist that needs a real browser (IndexedDB + service worker):

- [ ] devtools → Application → IndexedDB → `lms-offline` → `media`/`chunks`
      (nothing appears in the Downloads folder — that is the point)
- [ ] `npm run build && npm run preview`, load once, then devtools → Network →
      Offline, hard-reload: the app still opens (service worker) and downloaded
      lessons still play
- [ ] Application → Storage → quota/usage grows when a lesson is downloaded

---

## 6. Production checklist for this feature

- **Entitlement + signing**: `/source` already re-checks per start and returns
  `expiresAt`. In production also verify enrolment/course access and issue a real
  signed URL (S3/R2 presign), not a public asset URL.
- **Host allow-list**: set `ALLOWED_MEDIA_HOSTS` so the proxy cannot be used as an
  open relay.
- **Per-plan offline limits**: `maxOfflineMb` comes from the tenant record today;
  move it to the subscription model and return it with the catalog.
- **Storage eviction**: `navigator.storage.persist()` is offered in the UI, but for
  a large catalogue add LRU eviction (`lastAccessAt` is already tracked).
- **Content protection**: app-private storage stops casual copying, not a
  determined user with devtools (the chunks are readable via IndexedDB). If the
  tuition centre needs real protection, wrap playback in
  Widevine/FairPlay DRM (or a native/Electron shell with an encrypted store).
- **Multiple devices & limits**: downloads are per device, per browser. The plan
  cap is enforced client-side from the tenant value; a server-side download
  ledger is needed if you want to bill or limit across devices.
- **Incognito/private windows** clear storage on close — tell students in the UI.
- **Background sync**: a service-worker `BackgroundSync` retry for interrupted
  downloads is a natural next step (the queue already survives reloads).
- **Observability**: log downloads server-side (the API already logs each
  resolution) to see offline adoption per tenant.

## 7. Honest limitations

- YouTube/iframe lessons cannot be saved offline. Period. See section 3.
- Storage is per browser + per origin: a student who clears site data loses the
  downloads (the Downloads screen has a "Check files" action to detect this).
- Downloads are sequential (1 at a time) on purpose; `concurrency` in
  `src/lib/downloadManager.js` can be raised, at the cost of bandwidth fairness.
- The service worker precaches the app shell; media is **not** copied into the
  SW cache, because IndexedDB gives the resumable, user-managed behaviour we want.
- The seed data uses small public test clips as stand-ins for real lessons.



