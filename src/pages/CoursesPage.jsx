import { useState } from 'react'
import { useApp } from '../state/AppContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CourseCard } from '../components/CourseCard'
import { Search, Download, CloudOff } from 'lucide-react'

export function CoursesPage() {
  const { tenant, courses, downloads, offline } = useApp()
  const [searchQuery, setSearchQuery] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [sortBy, setSortBy] = useState('title')

  const subjects = [...new Set(courses.map((c) => c.subject))]

  const filteredCourses = courses
    .filter((course) => {
      const matchesSearch =
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
  const totalDuration = courses.reduce(
    (total, course) =>
      total + course.lessons.reduce((sum, lesson) => sum + (lesson.durationSec || 0), 0),
    0,
  )
  const totalHours = Math.round(totalDuration / 3600)

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">{tenant.name} Courses</h1>
            <p className="page-subtitle">
              {courses.length} courses · {totalLessons} video lessons · {totalHours}h total ·
              Watch online or save for offline
            </p>
          </div>
          <div className="flex items-center gap-2">
            {offline && (
              <Badge variant="secondary" className="gap-1.5">
                <CloudOff className="h-3 w-3" aria-hidden="true" />
                Offline Mode
              </Badge>
            )}
            {downloads.queuedCount > 0 && (
              <Badge className="gap-1.5 bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
                <Download className="h-3 w-3" aria-hidden="true" />
                {downloads.queuedCount} Downloading
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="mb-8 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-foreground-muted"
            aria-hidden="true"
          />
          <Input
            placeholder="Search courses, teachers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            aria-label="Search courses"
          />
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="w-[180px] sm:w-[200px]" aria-label="Filter by subject">
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map((subject) => (
                <SelectItem key={subject} value={subject}>
                  {subject}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px] sm:w-[180px]" aria-label="Sort courses">
              <SelectValue placeholder="Sort" />
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
            <Search
              className="h-12 w-12 mx-auto text-foreground-muted mb-4"
              aria-hidden="true"
            />
            <h3 className="text-lg font-semibold text-foreground mb-2">No courses found</h3>
            <p className="text-foreground-muted">Try adjusting your search or filters</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearchQuery('')
                setSubjectFilter('all')
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course, index) => (
            <CourseCard key={course.id} course={course} index={index} />
          ))}
        </div>
      )}
    </div>
  )
}

export default CoursesPage
