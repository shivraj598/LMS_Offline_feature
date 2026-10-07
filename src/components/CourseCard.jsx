import { Link } from 'react-router-dom'
import { useApp, courseOfflineSummary } from '../state/AppContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { formatBytes } from '../lib/format'
import { subjectStyle } from '../lib/subjects'
import { BookOpen, Clock, Play, Download, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CourseCard({ course, index = 0 }) {
  const { tenant, downloads, saveCourseOffline } = useApp()
  const summary = courseOfflineSummary(course, downloads.jobs, tenant.id)
  const totalMinutes = Math.round(
    course.lessons.reduce((total, lesson) => total + (lesson.durationSec || 0), 0) / 60,
  )
  const style = subjectStyle(course.subject)
  const progressPercent = summary.total > 0 ? (summary.saved / summary.total) * 100 : 0

  return (
    <Card
      className={cn(
        'card-hover flex flex-col overflow-hidden animate-slide-up',
        summary.complete && 'border-accent/40',
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className={cn('relative h-36 shrink-0 overflow-hidden', style.panel)}>
        <span
          aria-hidden="true"
          className="absolute -bottom-5 right-2 font-display text-[7rem] font-bold leading-none text-foreground/10"
        >
          {course.subject.charAt(0)}
        </span>
        <span
          className={cn(
            'absolute left-4 top-4 inline-flex rounded-full px-2.5 py-1 text-xs font-bold',
            style.chip,
          )}
        >
          {course.subject}
        </span>
        <span
          className={cn(
            'absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-white',
            summary.complete ? 'bg-accent-hover' : 'bg-primary',
          )}
        >
          {summary.complete ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Offline ready
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              {summary.saved}/{summary.total} saved
            </>
          )}
        </span>
      </div>

      <CardContent className="flex flex-1 flex-col gap-4 pt-5">
        <div>
          <Link to={`/courses/${course.id}`}>
            <h3 className="font-heading text-lg font-semibold leading-snug text-foreground transition-colors hover:text-primary">
              {course.title}
            </h3>
          </Link>
          <p className="mt-1.5 line-clamp-2 text-sm text-foreground-muted">{course.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-foreground-muted">
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            {course.teacher}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {totalMinutes} min
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            {course.lessons.length} lessons
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground-muted">Offline progress</span>
            <span className="font-semibold text-foreground">{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-foreground-muted">
            {summary.saved} of {summary.total} lessons saved
            {summary.bytes > 0 && ` · ${formatBytes(summary.bytes)}`}
          </p>
        </div>

        <div className="mt-auto flex gap-2 pt-1">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link to={`/courses/${course.id}`}>
              <BookOpen className="h-4 w-4" />
              View course
            </Link>
          </Button>
          {summary.complete ? (
            <Button variant="secondary" size="sm" className="flex-1" disabled>
              <CheckCircle2 className="h-4 w-4" />
              Ready offline
            </Button>
          ) : (
            <Button size="sm" className="flex-1" onClick={() => saveCourseOffline(course)}>
              <Download className="h-4 w-4" />
              Save all offline
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default CourseCard
