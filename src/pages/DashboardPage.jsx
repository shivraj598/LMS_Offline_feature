import { useApp } from '../state/AppContext'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { formatBytes } from '../lib/format'
import { CourseCard } from '../components/CourseCard'
import {
  BookOpen,
  Download,
  Clock,
  Play,
  ArrowRight,
  Shield,
  CloudOff,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function StatCard({ title, value, detail, icon: Icon, color = 'primary' }) {
  const colorClasses = {
    primary: 'text-primary bg-primary/10',
    success: 'text-accent-hover bg-accent/10',
    warning: 'text-warning bg-warning/10',
    info: 'text-secondary bg-secondary/10',
  }

  return (
    <Card className="stat-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="stat-label">{title}</p>
          <p className="stat-value">{value}</p>
          {detail && <p className="mt-0.5 text-xs text-foreground-muted">{detail}</p>}
        </div>
        <div
          className={cn('h-12 w-12 shrink-0 rounded-xl flex items-center justify-center', colorClasses[color])}
        >
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      </div>
    </Card>
  )
}

export function DashboardPage() {
  const { tenant, courses, downloads, offline, simulateOffline } = useApp()

  const totalLessons = courses.reduce((total, course) => total + course.lessons.length, 0)
  const totalDuration = courses.reduce(
    (total, course) =>
      total + course.lessons.reduce((sum, lesson) => sum + (lesson.durationSec || 0), 0),
    0,
  )
  const totalHours = Math.floor(totalDuration / 3600)
  const totalMinutes = Math.round((totalDuration % 3600) / 60)
  const storageLimitBytes = tenant.maxOfflineMb * 1024 * 1024

  const stats = [
    {
      title: 'Total Courses',
      value: courses.length,
      detail: `${new Set(courses.map((c) => c.subject)).size} subjects`,
      icon: BookOpen,
      color: 'primary',
    },
    {
      title: 'Video Lessons',
      value: totalLessons,
      detail: `${totalHours}h ${totalMinutes}m of video`,
      icon: Play,
      color: 'info',
    },
    {
      title: 'Saved Offline',
      value: downloads.downloadedCount,
      detail: `${formatBytes(downloads.downloadedBytes)} on this device`,
      icon: Download,
      color: 'success',
    },
    {
      title: 'Storage Used',
      value: `${Math.round((downloads.downloadedBytes / storageLimitBytes) * 100)}%`,
      detail: `${formatBytes(tenant.maxOfflineMb * 1024 * 1024 - downloads.downloadedBytes)} available`,
      icon: Clock,
      color: 'warning',
    },
  ]

  const recentCourses = courses.slice(0, 4)

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">Welcome back</h1>
            <p className="page-subtitle">
              Continue learning with {tenant.name}. {courses.length} courses, {totalLessons}{' '}
              lessons available.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-1.5',
                offline
                  ? 'border-warning/40 bg-warning-light text-warning'
                  : 'border-primary/20 bg-primary/10 text-primary',
              )}
            >
              <span className="text-sm font-medium">
                {offline ? 'Offline mode' : 'Online'}
              </span>
              {offline ? (
                <CloudOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Zap className="h-4 w-4" aria-hidden="true" />
              )}
            </div>
            {simulateOffline && (
              <Badge variant="secondary" className="gap-1.5">
                <Shield className="h-3 w-3" aria-hidden="true" />
                Simulated
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="mb-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-heading font-semibold text-foreground">My Courses</h2>
            <p className="text-sm text-foreground-muted">Continue where you left off</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/courses">
              View All
              <ArrowRight className="h-4 w-4 ml-1" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {recentCourses.map((course, index) => (
            <CourseCard key={course.id} course={course} index={index} />
          ))}
        </div>
      </div>

      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h3 className="font-heading font-semibold text-foreground">Offline storage</h3>
            <p className="text-sm text-foreground-muted">
              {tenant.plan} plan · {tenant.maxOfflineMb} MB limit
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/settings">Manage in Settings</Link>
          </Button>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground-muted">Used</span>
            <span className="font-semibold text-foreground">
              {formatBytes(downloads.downloadedBytes)}
            </span>
          </div>
          <Progress
            value={(downloads.downloadedBytes / storageLimitBytes) * 100}
            className="h-2"
            aria-label="Offline storage used"
          />
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground-muted">Available</span>
            <span className="font-semibold text-success">
              {formatBytes(storageLimitBytes - downloads.downloadedBytes)}
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default DashboardPage
