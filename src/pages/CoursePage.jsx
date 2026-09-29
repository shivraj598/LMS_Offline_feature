import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useApp, courseOfflineSummary } from '../state/AppContext'
import { JOB_STATUS } from '../lib/downloadManager'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatBytes, formatDuration } from '../lib/format'
import {
  ArrowLeft,
  BookOpen,
  Download,
  Clock,
  Play,
  CheckCircle2,
  ChevronRight,
  Zap,
  CloudOff,
  MoreHorizontal,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu'

const subjectColors = {
  Physics: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', icon: 'bg-blue-500' },
  Chemistry: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: 'bg-green-500' },
  Maths: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', icon: 'bg-purple-500' },
  Biology: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', icon: 'bg-orange-500' },
  default: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', icon: 'bg-slate-500' },
}

function LessonRow({ lesson, course, index, isActive, onClick }) {
  const { jobFor } = useApp()
  const job = jobFor(lesson)
  const downloaded = job?.status === JOB_STATUS.DOWNLOADED
  const colors = subjectColors[lesson.topic] || subjectColors.default

  return (
    <div
      onClick={() => onClick(lesson)}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 cursor-pointer",
        "hover:bg-surface-hover hover:border-primary/30 border border-transparent",
        downloaded && "bg-green-50 border-green-100",
        isActive && "bg-primary/5 border-primary/20",
        "group"
      )}
    >
            <div className={cn(
              "relative h-16 w-28 shrink-0 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0",
              downloaded && "bg-green-50"
            )}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10 h-full w-full flex items-center justify-center">
                <Play className={cn("h-8 w-8 text-foreground-muted group-hover:text-primary transition-colors", downloaded && "text-green-500")} />
              </div>
              {downloaded && (
                <div className="absolute top-2 left-2">
                  <Badge variant="secondary" className="gap-1 px-2 py-0.5">
                    <CheckCircle2 className="h-3 w-3" />
                  </Badge>
                </div>
              )}
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                {formatDuration(lesson.durationSec)}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", colors.bg, colors.text)}>
                  {lesson.topic}
                </span>
                {downloaded && (
                  <Badge variant="secondary" className="gap-1 px-2 py-0.5">
                    <CheckCircle2 className="h-3 w-3" />
                    Saved
                  </Badge>
                )}
              </div>
              <h4 className={cn("font-medium text-foreground line-clamp-1", isActive && "text-primary")}>
                {index + 1}. {lesson.title}
              </h4>
              <div className="flex items-center gap-3 mt-1 text-xs text-foreground-muted">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(lesson.durationSec)}
                </span>
                {downloaded && job?.receivedBytes && (
                  <span className="flex items-center gap-1 text-green-600">
                    <Download className="h-3 w-3" />
                    {formatBytes(job.receivedBytes)}
                  </span>
                )}
                {!downloaded && (lesson.sourceUrl || lesson.youtubeUrl) && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <CloudOff className="h-3 w-3" />
                    Downloadable
                  </span>
                )}
                {!downloaded && !lesson.sourceUrl && !lesson.youtubeUrl && (
                  <span className="flex items-center gap-1">
                    <Play className="h-3 w-3" />
                    No video attached
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Lesson options">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link to={`/watch/${course.id}/${lesson.id}`}>
                      <Play className="h-4 w-4 mr-2" />
                      Watch Lesson
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {!downloaded && (lesson.sourceUrl || lesson.youtubeUrl) && (
                    <DropdownMenuItem className="text-primary focus:text-primary">
                      <Download className="h-4 w-4 mr-2" />
                      Download for Offline
                    </DropdownMenuItem>
                  )}
                  {downloaded && (
                    <DropdownMenuItem className="text-destructive focus:text-destructive">
                      <CloudOff className="h-4 w-4 mr-2" />
                      Remove Download
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={`/watch/${course.id}/${lesson.id}`}>
                      <Zap className="h-4 w-4 mr-2" />
                      Open Lesson
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
    </div>
  )
}

export function CoursePage() {
  const { courseId } = useParams()
  const { tenant, courses, downloads, offline, saveCourseOffline, simulateOffline } = useApp()
  const [activeLessonId, setActiveLessonId] = useState(null)

  const course = courses.find((item) => item.id === courseId)

  if (!course) {
    return (
      <div className="animate-fade-in max-w-2xl mx-auto text-center py-16">
        <BookOpen className="h-16 w-16 mx-auto text-foreground-muted mb-4" />
        <h1 className="text-2xl font-heading font-bold text-foreground mb-2">Course Not Found</h1>
        <p className="text-foreground-muted mb-6">This course may have been removed or you don't have access.</p>
        <Link to="/courses">
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Courses
          </Button>
        </Link>
      </div>
    )
  }

  const summary = courseOfflineSummary(course, downloads.jobs, tenant.id)
  const totalMinutes = Math.round(
    course.lessons.reduce((total, lesson) => total + (lesson.durationSec || 0), 0) / 60,
  )

  const handleLessonClick = (lesson) => {
    setActiveLessonId(lesson.id)
    window.location.href = `/watch/${course.id}/${lesson.id}`
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <Link to="/courses" className="flex items-center gap-2 text-foreground-muted hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
          <span>All Courses</span>
        </Link>
        <Separator className="h-5 w-px bg-border flex-shrink-0 sm:hidden" />
        <div className="flex items-center gap-2">
          <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium", subjectColors[course.subject]?.bg, subjectColors[course.subject]?.text)}>
            {course.subject}
          </span>
          {summary.complete && (
            <Badge variant="secondary" className="gap-1.5">
              <CheckCircle2 className="h-3 w-3" />
              Offline Ready
            </Badge>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Card className="overflow-hidden">
            <div className="relative h-48 sm:h-56 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%239C92AC%22 fill-opacity=%220.03%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
              <div className="absolute inset-0 p-6 flex flex-col justify-end">
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("px-3 py-1 rounded-full text-sm font-medium", subjectColors[course.subject]?.bg, subjectColors[course.subject]?.text)}>
                    {course.subject}
                  </span>
                  {summary.complete && (
                    <Badge variant="secondary" className="gap-1.5">
                      <CheckCircle2 className="h-3 w-3" />
                      Fully Offline
                    </Badge>
                  )}
                </div>
                <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground">{course.title}</h1>
                <p className="text-foreground-muted mt-1">{course.teacher} · {course.lessons.length} lessons · {totalMinutes} min total</p>
              </div>
            </div>
            <CardContent className="p-6">
              <p className="text-foreground-muted mb-6">{course.description}</p>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 p-4 rounded-xl bg-surface-hover border border-border">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Download className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Offline Progress</p>
                    <p className="text-sm text-foreground-muted">
                      {summary.saved} of {summary.total} lessons saved
                      {summary.bytes > 0 && ` · ${formatBytes(summary.bytes)}`}
                    </p>
                  </div>
                </div>
                <div className="flex-1 sm:w-48">
                  <Progress value={(summary.saved / summary.total) * 100} className="h-2 mb-1" />
                  <p className="text-xs text-foreground-muted text-right">{Math.round((summary.saved / summary.total) * 100)}% Complete</p>
                </div>
                <div className="flex gap-2">
                  {summary.complete ? (
                    <Button variant="secondary" disabled>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Fully Offline
                    </Button>
                  ) : (
                    <Button onClick={() => saveCourseOffline(course)} className="flex-1 sm:flex-none">
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
                  <Clock className="h-4 w-4" />
                  <span>{totalMinutes} min total</span>
                  <span>·</span>
                  <Play className="h-4 w-4" />
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
                      isActive={activeLessonId === lesson.id}
                      onClick={handleLessonClick}
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
                      <CheckCircle2 className="h-3 w-3" />
                      Offline Ready
                    </>
                  ) : (
                    <>
                      <Download className="h-3 w-3" />
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
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Teacher</p>
                    <p className="font-medium text-foreground">{course.teacher}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-hover">
                  <div className="h-10 w-10 rounded-lg bg-blue/10 text-blue-600 flex items-center justify-center">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Total Duration</p>
                    <p className="font-medium text-foreground">{totalMinutes} minutes</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-hover">
                  <div className="h-10 w-10 rounded-lg bg-purple/10 text-purple-600 flex items-center justify-center">
                    <Play className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Lessons</p>
                    <p className="font-medium text-foreground">{course.lessons.length} videos</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-hover">
                  <div className="h-10 w-10 rounded-lg bg-green/10 text-green-600 flex items-center justify-center">
                    <Download className="h-5 w-5" />
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
                  <Button
                    variant="ghost"
                    className="justify-start gap-3 text-foreground-muted hover:text-foreground"
                    onClick={() => window.location.href = '/downloads'}
                  >
                    <CloudOff className="h-4 w-4" />
                    <span>Manage Downloads</span>
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-medium text-foreground">How It Works</h4>
                <ul className="space-y-2 text-sm text-foreground-muted">
                  <li className="flex items-start gap-2">
                    <Zap className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                    <span>Stream from YouTube when online</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Download className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                    <span>Download saves to private app storage</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CloudOff className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />
                    <span>Watch offline anytime, no internet needed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
                    <span>Files auto-deleted when removed from app</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default CoursePage