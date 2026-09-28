import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp, courseOfflineSummary } from '../state/AppContext'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { formatBytes, formatDuration } from '../lib/format'
import {
  BookOpen,
  Download,
  Clock,
  Play,
  Search,
  Filter,
  ChevronDown,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const subjectColors = {
  Physics: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', icon: 'bg-blue-500' },
  Chemistry: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: 'bg-green-500' },
  Maths: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', icon: 'bg-purple-500' },
  Biology: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', icon: 'bg-orange-500' },
  default: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', icon: 'bg-slate-500' },
}

function CourseCard({ course, jobs, tenantId, onSaveAll, index }) {
  const summary = courseOfflineSummary(course, jobs, tenantId)
  const totalMinutes = Math.round(
    course.lessons.reduce((total, lesson) => total + (lesson.durationSec || 0), 0) / 60,
  )
  const colors = subjectColors[course.subject] || subjectColors.default
  const progressPercent = summary.total > 0 ? (summary.saved / summary.total) * 100 : 0

  return (
    <Card className={cn("card-hover overflow-hidden animate-slide-up", summary.complete && "border-primary/30")} style={{ animationDelay: `${index * 50}ms` }}>
      <div className="relative h-40 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%239C92AC%22 fill-opacity=%220.03%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
        <div className="absolute top-4 left-4">
          <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium", colors.bg, colors.text)}>
            {course.subject}
          </span>
        </div>
        <div className="absolute top-4 right-4">
          {summary.complete && (
            <Badge variant="secondary" className="gap-1.5">
              <CheckCircle2 className="h-3 w-3" />
              Offline Ready
            </Badge>
          )}
        </div>
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end px-4">
          <div className={cn("inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-white backdrop-blur-sm", summary.complete ? "bg-green-600/90" : "bg-primary/90")}>
            {summary.complete ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Offline Ready
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                {summary.saved}/{summary.total} Saved
              </>
            )}
          </div>
          <Link to={`/courses/${course.id}`}>
            <Button variant="ghost" size="sm" className="text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <CardHeader className="pb-3">
        <Link to={`/courses/${course.id}`} className="block">
          <h3 className="font-heading font-semibold text-lg text-foreground line-clamp-2 hover:text-primary transition-colors">
            {course.title}
          </h3>
        </Link>
        <p className="mt-2 text-sm text-foreground-muted line-clamp-2">{course.description}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 text-sm text-foreground-muted">
          <div className="flex items-center gap-1.5">
            <div className={cn("h-6 w-6 rounded-lg flex items-center justify-center", colors.icon)}>
              <BookOpen className="h-3.5 w-3.5" />
            </div>
            <span>{course.teacher}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>{totalMinutes} min</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Play className="h-3.5 w-3.5" />
            <span>{course.lessons.length} lessons</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground-muted">Offline Progress</span>
            <span className="font-medium text-foreground">{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-foreground-muted">
            {summary.saved} of {summary.total} lessons saved
            {summary.bytes > 0 && ` · ${formatBytes(summary.bytes)}`}
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <Link to={`/courses/${course.id}`}>
            <Button variant="outline" className="flex-1" size="sm">
              <span className="flex items-center justify-center gap-1.5">
                <BookOpen className="h-4 w-4" />
                View Course
              </span>
            </Button>
          </Link>
          {summary.complete ? (
            <Button variant="secondary" className="flex-1" size="sm" disabled>
              <span className="flex items-center justify-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Ready Offline
              </span>
            </Button>
          ) : (
            <Button onClick={() => onSaveAll(course)} className="flex-1" size="sm">
              <span className="flex items-center justify-center gap-1.5">
                <Download className="h-4 w-4" />
                Save All Offline
              </span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function CourseSkeleton({ index }) {
  return (
    <Card className="overflow-hidden animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
      <Skeleton className="h-40 w-full" />
      <CardHeader className="pb-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-2 w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </CardContent>
    </Card>
  )
}

export function CoursesPage() {
  const { tenant, courses, downloads, offline, saveCourseOffline } = useApp()
  const [searchQuery, setSearchQuery] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [sortBy, setSortBy] = useState('title')

  const subjects = [...new Set(courses.map(c => c.subject))]

  const filteredCourses = courses
    .filter(course => {
      const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.teacher.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesSubject = subjectFilter === 'all' || course.subject === subjectFilter
      return matchesSearch && matchesSubject
    })
    .sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title)
      if (sortBy === 'teacher') return a.teacher.localeCompare(b.teacher)
      if (sortBy === 'lessons') return b.lessons.length - a.lessons.length
      if (sortBy === 'duration') {
        const durationA = a.lessons.reduce((sum, l) => sum + (l.durationSec || 0), 0)
        const durationB = b.lessons.reduce((sum, l) => sum + (l.durationSec || 0), 0)
        return durationB - durationA
      }
      return 0
    })

  const totalLessons = courses.reduce((total, course) => total + course.lessons.length, 0)
  const totalDuration = courses.reduce((total, course) =>
    total + course.lessons.reduce((sum, lesson) => sum + (lesson.durationSec || 0), 0), 0
  )
  const totalHours = Math.round(totalDuration / 3600)

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{tenant.name} Courses</h1>
          <p className="page-subtitle">
            {courses.length} courses · {totalLessons} video lessons · {totalHours}h total · Watch online or save for offline
          </p>
        </div>
      </div>

      <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-primary/5 via-background to-secondary/5 border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Your Learning Library</p>
              <p className="font-semibold text-foreground">
                {courses.length} courses, {downloads.downloadedCount} saved offline ({formatBytes(downloads.downloadedBytes)})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {offline && (
              <Badge variant="secondary" className="gap-1.5">
                <CloudOff className="h-3 w-3" />
                Offline Mode
              </Badge>
            )}
            {downloads.queuedCount > 0 && (
              <Badge variant="default" className="gap-1.5 bg-primary/10 text-primary border-primary/20">
                <Download className="h-3 w-3" />
                {downloads.queuedCount} Downloading
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-foreground-muted" />
          <Input
            placeholder="Search courses, teachers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="w-[180px] sm:w-[200px]">
              <SelectValue placeholder="All Subjects" />
              <span className="ml-auto h-4 w-4 opacity-50"><ChevronDown /></span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map(subject => (
                <SelectItem key={subject} value={subject}>{subject}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px] sm:w-[180px]">
              <SelectValue placeholder="Sort" />
              <span className="ml-auto h-4 w-4 opacity-50"><ChevronDown /></span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title">Title (A-Z)</SelectItem>
              <SelectItem value="teacher">Teacher (A-Z)</SelectItem>
              <SelectItem value="lessons">Most Lessons</SelectItem>
              <SelectItem value="duration">Longest Duration</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredCourses.length === 0 ? (
        <Card className="py-16 text-center">
          <CardContent>
            <Search className="h-12 w-12 mx-auto text-foreground-muted mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No courses found</h3>
            <p className="text-foreground-muted">Try adjusting your search or filters</p>
            <Button variant="outline" className="mt-4" onClick={() => { setSearchQuery(''); setSubjectFilter('all'); }}>
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course, index) => (
            <CourseCard
              key={course.id}
              course={course}
              jobs={downloads.jobs}
              tenantId={tenant.id}
              onSaveAll={saveCourseOffline}
              index={index}
            />
          ))}
        </div>
      )}

      <div className="mt-12 rounded-2xl border border-border bg-surface p-6">
        <h3 className="text-lg font-heading font-semibold text-foreground mb-4">How Offline Viewing Works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-surface-hover">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <Play className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-foreground">Stream Online</p>
              <p className="text-sm text-foreground-muted">Lessons play from YouTube while you have internet</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-lg bg-surface-hover">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-foreground">Save Offline</p>
              <p className="text-sm text-foreground-muted">Tap Download to save videos to this device's private storage</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-lg bg-surface-hover">
            <div className="h-10 w-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-foreground">Watch Anywhere</p>
              <p className="text-sm text-foreground-muted">Downloaded lessons show a badge and play with no internet</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-lg bg-surface-hover">
            <div className="h-10 w-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-foreground">Private & Secure</p>
              <p className="text-sm text-foreground-muted">Files never appear in gallery, cannot be shared, auto-removed</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CoursesPage