import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDuration } from '../lib/format'
import { parseYoutubeId } from '../lib/youtube'
import { isStreamOnly } from '../data/catalog'
import {
  Video,
  Clapperboard,
  Plus,
  BookOpen,
  Clock,
  CloudDownload,
  CloudOff,
  ExternalLink,
  Info,
  Link2,
  CheckCircle2,
  CircleDashed,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const WORKFLOW_STEPS = [
  {
    icon: Video,
    title: '1 · Upload to YouTube',
    text: "Upload the lecture to your centre's channel. Unlisted works — the link is the key.",
  },
  {
    icon: Link2,
    title: '2 · Paste the link here',
    text: 'Add the URL below. It becomes a lesson immediately, no re-upload needed.',
  },
  {
    icon: BookOpen,
    title: '3 · Students watch',
    text: 'The lesson appears in the course and streams for every student.',
  },
  {
    icon: CloudDownload,
    title: '4 · Save offline',
    text: 'When a downloadable file is attached, students save it for offline viewing.',
  },
]

export function OwnerStudioPage() {
  const { tenant, courses, addLesson, createOwnerCourse } = useApp()

  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)
  const [newCourse, setNewCourse] = useState({ title: '', subject: '', teacher: '' })
  const [creatingCourse, setCreatingCourse] = useState(false)

  const totalLessons = useMemo(
    () => courses.reduce((sum, course) => sum + course.lessons.length, 0),
    [courses],
  )
  const downloadables = useMemo(
    () =>
      courses.reduce(
        (sum, course) => sum + course.lessons.filter((lesson) => !isStreamOnly(lesson)).length,
        0,
      ),
    [courses],
  )

  const handleAddLesson = async (event) => {
    event.preventDefault()
    if (submitting) return
    setMessage(null)

    if (!selectedCourseId) {
      setMessage({ tone: 'warn', text: 'Pick a course first.' })
      return
    }
    if (!parseYoutubeId(url)) {
      setMessage({
        tone: 'warn',
        text: 'Paste a YouTube link like https://youtu.be/XXXXXXXXXXX or a watch?v=… URL.',
      })
      return
    }

    setSubmitting(true)
    const result = await addLesson(selectedCourseId, { youtubeUrl: url, title })
    setSubmitting(false)
    if (result.ok) {
      setUrl('')
      setTitle('')
      setMessage({
        tone: 'done',
        text: `"${result.lesson.title}" is live for students. They can watch it now.${
          result.downloadable === false
            ? ' It streams only — attach the video file (or enable server-side YouTube resolution) to unlock offline downloads.'
            : ''
        }`,
      })
    } else {
      setMessage({ tone: 'error', text: result.message || 'The lesson could not be added.' })
    }
  }

  const handleCreateCourse = (event) => {
    event.preventDefault()
    if (creatingCourse) return
    setCreatingCourse(true)
    const result = createOwnerCourse(newCourse)
    setCreatingCourse(false)
    if (result.ok) {
      setSelectedCourseId(result.course.id)
      setNewCourse({ title: '', subject: '', teacher: '' })
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
          <Clapperboard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Owner Studio</h1>
          <p className="text-sm text-foreground-muted">
            Paste YouTube lecture links for {tenant.name}. Students get them instantly.
          </p>
        </div>
      </div>

      {/* The 4-step workflow, spelled out so the feature sells itself */}
      <Card>
        <CardContent className="pt-6">
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW_STEPS.map((step) => (
              <li key={step.title} className="rounded-xl border border-border bg-surface-hover p-4">
                <step.icon className="mb-2 h-5 w-5 text-primary" />
                <p className="font-medium text-foreground">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        {/* Add lesson form */}
        <Card>
          <CardHeader>
            <CardTitle>Add a lesson from a YouTube link</CardTitle>
            <CardDescription>
              Paste the URL of a video on your own channel. Duplicate videos in the same course are
              rejected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddLesson} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="owner-course">Course</Label>
                <select
                  id="owner-course"
                  value={selectedCourseId}
                  onChange={(event) => setSelectedCourseId(event.target.value)}
                  className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title} · {course.lessons.length} lessons
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="owner-url">YouTube URL</Label>
                <Input
                  id="owner-url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  autoComplete="off"
                />
                <div className="flex min-h-5 items-center gap-2 text-xs text-foreground-muted">
                  {url && parseYoutubeId(url) ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      video id {parseYoutubeId(url)}
                    </>
                  ) : url ? (
                    <>
                      <CircleDashed className="h-4 w-4 text-amber-500" />
                      waiting for a valid YouTube link…
                    </>
                  ) : (
                    'accepts watch, youtu.be, embed, shorts and live URLs'
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="owner-title">Lesson title (optional)</Label>
                <Input
                  id="owner-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="defaults to “Lesson N”"
                />
              </div>

              <Button type="submit" disabled={submitting} className="w-full gap-2">
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {submitting ? 'Adding…' : 'Add lesson'}
              </Button>

              {message && (
                <div
                  className={cn(
                    'rounded-lg border p-3 text-sm',
                    message.tone === 'done' && 'border-green-200 bg-green-50 text-green-800',
                    message.tone === 'warn' && 'border-amber-200 bg-amber-50 text-amber-800',
                    message.tone === 'error' && 'border-red-200 bg-red-50 text-red-800',
                  )}
                >
                  {message.text}
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* New course form */}
        <Card>
          <CardHeader>
            <CardTitle>New course</CardTitle>
            <CardDescription>
              A course groups lessons. Create one here, then paste its YouTube links.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nc-title">Title</Label>
                <Input
                  id="nc-title"
                  value={newCourse.title}
                  onChange={(event) => setNewCourse({ ...newCourse, title: event.target.value })}
                  placeholder="Grade 10 Science"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="nc-subject">Subject</Label>
                  <Input
                    id="nc-subject"
                    value={newCourse.subject}
                    onChange={(event) => setNewCourse({ ...newCourse, subject: event.target.value })}
                    placeholder="Science"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nc-teacher">Teacher</Label>
                  <Input
                    id="nc-teacher"
                    value={newCourse.teacher}
                    onChange={(event) => setNewCourse({ ...newCourse, teacher: event.target.value })}
                    placeholder="Ms. Sharma"
                  />
                </div>
              </div>
              <Button
                type="submit"
                variant="outline"
                disabled={creatingCourse}
                className="w-full gap-2"
              >
                <Plus className="h-4 w-4" />
                Create course
              </Button>
              <div className="rounded-lg bg-surface-hover p-3 text-xs leading-relaxed text-foreground-muted">
                <p className="mb-1 font-medium text-foreground">{tenant.name} at a glance</p>
                {courses.length} courses · {totalLessons} lessons · {downloadables} downloadable
                <br />
                Plan cap: {tenant.maxOfflineMb} MB offline per student.
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Course + lesson inventory */}
      <Card>
        <CardHeader>
          <CardTitle>Lessons by course</CardTitle>
          <CardDescription>
            Every lesson students can see, with its offline-download status on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[420px] pr-3">
            <div className="space-y-4">
              {courses.map((course) => (
                <div key={course.id} className="rounded-xl border border-border">
                  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{course.title}</p>
                      <p className="text-xs text-foreground-muted">
                        {course.subject}
                        {course.teacher ? ` · ${course.teacher}` : ''} · {course.lessons.length}{' '}
                        lessons
                      </p>
                    </div>
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/courses/${course.id}`}>Open course</Link>
                    </Button>
                  </div>
                  {course.lessons.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-foreground-muted">
                      No lessons yet — paste a YouTube link above.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {course.lessons.map((lesson) => {
                        const streamOnly = isStreamOnly(lesson)
                        return (
                          <div key={lesson.id} className="flex items-center gap-3 px-4 py-2.5">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">
                                {lesson.title}
                              </p>
                              <p className="flex items-center gap-1.5 text-xs text-foreground-muted">
                                <Clock className="h-3 w-3" />
                                {lesson.durationSec
                                  ? formatDuration(lesson.durationSec)
                                  : 'duration pending'}
                              </p>
                            </div>
                            {streamOnly ? (
                              <Badge
                                variant="outline"
                                className="gap-1 border-amber-300 text-amber-600"
                              >
                                <CloudOff className="h-3 w-3" />
                                stream-only
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="gap-1 border-green-300 text-green-600"
                              >
                                <CloudDownload className="h-3 w-3" />
                                downloadable
                              </Badge>
                            )}
                            <Link
                              to={`/watch/${course.id}/${lesson.id}`}
                              className="text-foreground-muted transition-colors hover:text-foreground"
                              aria-label={`Watch ${lesson.title}`}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/60">
        <CardContent className="flex gap-3 pt-6">
          <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div className="text-sm">
            <p className="font-medium text-amber-900">Why some lessons say “stream-only”</p>
            <p className="mt-1 leading-relaxed text-amber-800">
              A browser cannot save YouTube&apos;s stream directly — so offline saving works when
              the centre attaches its own video file for the lesson, or when the server resolves{' '}
              <span className="font-mono text-xs">its own YouTube uploads</span> with yt-dlp (
              <span className="font-mono text-xs">ENABLE_YTDLP=1</span>). Until then students watch
              online; the download button explains this instead of failing silently.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default OwnerStudioPage
