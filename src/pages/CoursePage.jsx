import { useParams, Link, useNavigate } from 'react-router-dom'
import { useApp, courseOfflineSummary } from '../state/AppContext'
import { JOB_STATUS } from '../lib/downloadManager'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatBytes, formatDuration } from '../lib/format'
import { subjectStyle } from '../lib/subjects'
import {
  ArrowLeft,
  BookOpen,
  Download,
  Clock,
  Play,
  CheckCircle2,
  CloudOff,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

function LessonRow({ lesson, course, index, onWatch }) {
  const { jobFor, downloadLesson, removeDownload } = useApp()
  const job = jobFor(lesson)
  const downloaded = job?.status === JOB_STATUS.DOWNLOADED
  const active = [JOB_STATUS.QUEUED, JOB_STATUS.DOWNLOADING, JOB_STATUS.FINALISING].includes(
    job?.status,
  )
  const hasVideo = Boolean(lesson.sourceUrl || lesson.youtubeUrl)
  const colors = subjectStyle(course.subject)

  return (
    <div
      onClick={() => onWatch(lesson)}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 cursor-pointer',
        'hover:bg-surface-hover hover:border-primary/30 border border-transparent',
        downloaded && 'bg-accent/10 border-accent/20',
        'group',
      )}
    >
      <div className="relative h-16 w-28 shrink-0 rounded-lg overflow-hidden bg-surface-active flex-shrink-0">
        <div className="absolute inset-0 flex items-center justify-center">
          <Play
            className={cn(
              'h-8 w-8 text-foreground-muted group-hover:text-primary transition-colors',
              downloaded && 'text-accent-hover',
            )}
            aria-hidden="true"
          />
        </div>
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
          {formatDuration(lesson.durationSec)}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', colors.chip)}>
            {lesson.topic}
          </span>
          {downloaded && (
            <Badge variant="secondary" className="gap-1 px-2 py-0.5">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              Saved
            </Badge>
          )}
        </div>
        <h4 className="font-medium text-foreground line-clamp-1">
          <Link
            to={`/watch/${course.id}/${lesson.id}`}
            className="hover:text-primary transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {index + 1}. {lesson.title}
          </Link>
        </h4>
        <div className="flex items-center gap-3 mt-1 text-xs text-foreground-muted">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {formatDuration(lesson.durationSec)}
          </span>
          {downloaded && job?.receivedBytes ? (
            <span className="flex items-center gap-1 text-accent-hover">
              <Download className="h-3 w-3" aria-hidden="true" />
              {formatBytes(job.receivedBytes)}
            </span>
          ) : (
            hasVideo && (
              <span className="flex items-center gap-1">
                <CloudOff className="h-3 w-3" aria-hidden="true" />
                Downloadable
              </span>
            )
          )}
          {!hasVideo && (
            <span className="flex items-center gap-1">
              <Play className="h-3 w-3" aria-hidden="true" />
              No video attached
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
              aria-label={`Options for ${lesson.title}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Lesson options</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link to={`/watch/${course.id}/${lesson.id}`}>
                <Play className="h-4 w-4 mr-2" />
                Watch Lesson
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {!downloaded && hasVideo && (
              <DropdownMenuItem
                className="text-primary focus:text-primary"
                disabled={active}
                onSelect={() => downloadLesson(lesson, course)}
              >
                <Download className="h-4 w-4 mr-2" />
                {active ? 'Downloading…' : 'Download for Offline'}
              </DropdownMenuItem>
            )}
            {downloaded && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => removeDownload(job.key, job.title)}
              >
                <CloudOff className="h-4 w-4 mr-2" />
                Remove Download
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export function CoursePage() {
  const { courseId } = useParams()
  const { tenant, courses, downloads, offline, saveCourseOffline } = useApp()
  const navigate = useNavigate()

  const course = courses.find((item) => item.id === courseId)

  if (!course) {
    return (
      <div className="animate-fade-in max-w-2xl mx-auto text-center py-16">
        <BookOpen className="h-16 w-16 mx-auto text-foreground-muted mb-4" />
        <h1 className="text-2xl font-heading font-bold text-foreground mb-2">Course Not Found</h1>
        <p className="text-foreground-muted mb-6">
          This course may have been removed or you don't have access.
        </p>
        <Button asChild>
          <Link to="/courses">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Courses
          </Link>
        </Button>
      </div>
    )
  }

  const summary = courseOfflineSummary(course, downloads.jobs, tenant.id)
  const style = subjectStyle(course.subject)
  const totalMinutes = Math.round(
    course.lessons.reduce((total, lesson) => total + (lesson.durationSec || 0), 0) / 60,
  )
  const progressPercent = summary.total > 0 ? (summary.saved / summary.total) * 100 : 0

  const handleWatch = (lesson) => {
    navigate(`/watch/${course.id}/${lesson.id}`)
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <Link
          to="/courses"
          className="inline-flex items-center gap-2 text-foreground-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>All Courses</span>
        </Link>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Card className="overflow-hidden">
            <div className={cn('relative h-48 sm:h-56', style.panel)}>
              <span
                aria-hidden="true"
                className="absolute -bottom-8 right-4 font-display text-[10rem] font-bold leading-none text-foreground/10"
              >
                {course.subject.charAt(0)}
              </span>
              <div className="absolute inset-0 p-6 flex flex-col justify-end">
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn('px-3 py-1 rounded-full text-sm font-medium', style.chip)}>
                    {course.subject}
                  </span>
                  {summary.complete && (
                    <Badge className="gap-1.5 bg-accent text-white hover:bg-accent">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      Offline Ready
                    </Badge>
                  )}
                </div>
                <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground">
                  {course.title}
                </h1>
                <p className="text-foreground-muted mt-1">
                  {course.teacher} · {course.lessons.length} lessons · {totalMinutes} min total
                </p>
              </div>
            </div>
            <CardContent className="p-6">
              <p className="text-foreground-muted mb-6">{course.description}</p>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-surface-hover border border-border">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Download className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Offline progress</p>
                    <p className="text-sm text-foreground-muted">
                      {summary.saved} of {summary.total} lessons saved
                      {summary.bytes > 0 && ` · ${formatBytes(summary.bytes)}`}
                    </p>
                  </div>
                </div>
                <div className="flex-1 sm:w-48">
                  <Progress value={progressPercent} className="h-2 mb-1" />
                  <p className="text-xs text-foreground-muted text-right">
                    {Math.round(progressPercent)}% saved
                  </p>
                </div>
                <div className="flex gap-2">
                  {summary.complete ? (
                    <Button variant="secondary" disabled>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Fully Offline
                    </Button>
                  ) : (
                    <Button
                      onClick={() => saveCourseOffline(course)}
                      className="flex-1 sm:flex-none"
                      disabled={offline}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Save All Offline
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Course Content</CardTitle>
                <div className="flex items-center gap-2 text-sm text-foreground-muted">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  <span>{totalMinutes} min total</span>
                  <span aria-hidden="true">·</span>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  <span>{course.lessons.length} lessons</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="h-[500px]">
                <div className="space-y-1">
                  {course.lessons.map((lesson, index) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      course={course}
                      index={index}
                      onWatch={handleWatch}
                    />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="sticky top-24">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                Course Info
                <Badge variant={summary.complete ? 'secondary' : 'outline'} className="gap-1.5">
                  {summary.complete ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      Offline Ready
                    </>
                  ) : (
                    <>
                      <Download className="h-3 w-3" aria-hidden="true" />
                      {summary.saved}/{summary.total} Saved
                    </>
                  )}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-hover">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <BookOpen className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Teacher</p>
                    <p className="font-medium text-foreground">{course.teacher}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-hover">
                  <div className="h-10 w-10 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
                    <Clock className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Total Duration</p>
                    <p className="font-medium text-foreground">{totalMinutes} minutes</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-hover">
                  <div className="h-10 w-10 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
                    <Play className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Lessons</p>
                    <p className="font-medium text-foreground">{course.lessons.length} videos</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-hover">
                  <div className="h-10 w-10 rounded-lg bg-accent/10 text-accent-hover flex items-center justify-center">
                    <Download className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Offline Storage</p>
                    <p className="font-medium text-foreground">
                      {summary.bytes > 0 ? formatBytes(summary.bytes) : '0 B'}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-medium text-foreground">Quick Actions</h4>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="justify-start gap-3"
                    onClick={() => saveCourseOffline(course)}
                    disabled={summary.complete || offline}
                  >
                    <Download className="h-4 w-4" />
                    <span>{summary.complete ? 'Fully Offline' : 'Save All Offline'}</span>
                  </Button>
                  <Button variant="ghost" className="justify-start gap-3" asChild>
                    <Link to="/downloads">
                      <CloudOff className="h-4 w-4" />
                      <span>Manage Downloads</span>
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default CoursePage
