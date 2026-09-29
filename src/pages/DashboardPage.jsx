import { useApp, courseOfflineSummary } from '../state/AppContext'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { formatBytes, formatDuration } from '../lib/format'
import {
  BookOpen,
  Download,
  Clock,
  TrendingUp,
  ArrowRight,
  Play,
  CheckCircle2,
  Zap,
  Shield,
  CloudOff,
  HelpCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const subjectColors = {
  Physics: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', icon: 'bg-blue-500' },
  Chemistry: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: 'bg-green-500' },
  Maths: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', icon: 'bg-purple-500' },
  Biology: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', icon: 'bg-orange-500' },
  default: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', icon: 'bg-slate-500' },
}

function CourseCard({ course, jobs, tenantId, onSaveAll }) {
  const summary = courseOfflineSummary(course, jobs, tenantId)
  const totalMinutes = Math.round(
    course.lessons.reduce((total, lesson) => total + (lesson.durationSec || 0), 0) / 60,
  )
  const colors = subjectColors[course.subject] || subjectColors.default
  const progressPercent = (summary.saved / summary.total) * 100

  return (
    <Card className={cn("card-hover overflow-hidden", summary.complete && "border-primary/30")}>
      <div className="relative h-40 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%239C92AC%22 fill-opacity=%220.03%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
        <div className="absolute top-4 right-4">
          <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium", colors.bg, colors.text)}>
            {course.subject}
          </span>
        </div>
        <div className="absolute bottom-4 left-4">
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

function StatCard({ title, value, icon: Icon, trend, trendValue, color = "primary" }) {
  const colorClasses = {
    primary: "text-primary bg-primary/10",
    success: "text-green-600 bg-green-100",
    warning: "text-amber-600 bg-amber-100",
    info: "text-blue-600 bg-blue-100",
  }

  return (
    <Card className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-label">{title}</p>
          <p className="stat-value">{value}</p>
          {trend && (
            <div className="stat-trend">
              <TrendingUp className={cn("h-3.5 w-3.5", trend === 'up' ? 'text-green-600' : 'text-red-600')} />
              <span className={cn(trend === 'up' ? 'text-green-600' : 'text-red-600')}>
                {trendValue}
              </span>
            </div>
          )}
        </div>
        <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center", colorClasses[color])}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </Card>
  )
}

function QuickAction({ title, description, icon: Icon, onClick, variant = "outline" }) {
  return (
    <Button
      variant={variant}
      className="w-full justify-start gap-3 p-4 h-auto text-left hover:bg-primary/5 hover:border-primary/30 transition-all"
      onClick={onClick}
    >
      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-foreground-muted">{description}</p>
      </div>
      <ArrowRight className="ml-auto h-5 w-5 text-foreground-muted" />
    </Button>
  )
}

export function DashboardPage() {
  const { tenant, courses, downloads, offline, saveCourseOffline, simulateOffline } = useApp()

  const totalLessons = courses.reduce((total, course) => total + course.lessons.length, 0)
  const totalDuration = courses.reduce((total, course) =>
    total + course.lessons.reduce((sum, lesson) => sum + (lesson.durationSec || 0), 0), 0
  )
  const totalHours = Math.round(totalDuration / 3600)

  const stats = [
    {
      title: 'Total Courses',
      value: courses.length,
      icon: BookOpen,
      color: 'primary',
      trend: 'up',
      trendValue: '+2 this month',
    },
    {
      title: 'Video Lessons',
      value: totalLessons,
      icon: Play,
      color: 'info',
    },
    {
      title: 'Total Duration',
      value: `${totalHours}h`,
      icon: Clock,
      color: 'warning',
    },
    {
      title: 'Saved Offline',
      value: `${downloads.downloadedCount} (${formatBytes(downloads.downloadedBytes)})`,
      icon: Download,
      color: 'success',
      trend: 'up',
      trendValue: `${downloads.downloadedCount} lessons`,
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
              Continue learning with {tenant.name}. {courses.length} courses, {totalLessons} lessons available.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {offline ? (
                  <>
                    <CloudOff className="h-4 w-4" />
                    Offline Mode
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Online
                  </>
                )}
              </span>
            </div>
            {simulateOffline && (
              <Badge variant="secondary" className="gap-1.5">
                <Shield className="h-3 w-3" />
                Simulated Offline
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, index) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            trend={stat.trend}
            trendValue={stat.trendValue}
            color={stat.color}
            className="stagger-1"
            style={{ animationDelay: `${index * 50}ms` }}
          />
        ))}
      </div>

      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-heading font-semibold text-foreground">My Courses</h2>
            <p className="text-sm text-foreground-muted">Continue where you left off</p>
          </div>
          <Link to="/courses">
            <Button variant="ghost" size="sm">
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {recentCourses.map((course, index) => (
            <CourseCard
              key={course.id}
              course={course}
              jobs={downloads.jobs}
              tenantId={tenant.id}
              onSaveAll={saveCourseOffline}
              className="stagger-1"
              style={{ animationDelay: `${index * 100}ms` }}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-lg font-heading font-semibold text-foreground">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <QuickAction
              title="Browse All Courses"
              description="Explore the complete course catalog"
              icon={BookOpen}
              onClick={() => window.location.href = '/courses'}
            />
            <QuickAction
              title="Manage Downloads"
              description="View and manage your offline library"
              icon={Download}
              onClick={() => window.location.href = '/downloads'}
            />
            <QuickAction
              title="Adjust Settings"
              description="Configure offline storage and preferences"
              icon={Shield}
              onClick={() => window.location.href = '/settings'}
              variant="outline"
            />
            <QuickAction
              title="Get Help"
              description="Access support and documentation"
              icon={HelpCircle}
              onClick={() => {}}
              variant="outline"
            />
          </div>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground">Subscription Status</h4>
                <p className="text-sm text-foreground-muted">{tenant.plan} Plan</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-t border-border">
                <span className="text-foreground-muted">Offline Storage Limit</span>
                <span className="font-medium text-foreground">{tenant.maxOfflineMb} MB</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-border">
                <span className="text-foreground-muted">Used Storage</span>
                <span className="font-medium text-foreground">{formatBytes(downloads.downloadedBytes)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-border">
                <span className="text-foreground-muted">Available</span>
                <span className="font-medium text-success">{formatBytes(tenant.maxOfflineMb * 1024 * 1024 - downloads.downloadedBytes)}</span>
              </div>
              <Progress
                value={(downloads.downloadedBytes / (tenant.maxOfflineMb * 1024 * 1024)) * 100}
                className="h-2"
              />
            </div>
          </Card>

          <Card className="p-6">
            <h4 className="font-semibold text-foreground mb-4">How Offline Works</h4>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-hover">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <Download className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Download Videos</p>
                  <p className="text-foreground-muted">Save any lesson for offline viewing with one click</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-hover">
                <div className="h-8 w-8 rounded-lg bg-success/10 text-success flex items-center justify-center flex-shrink-0">
                  <CloudOff className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Watch Anywhere</p>
                  <p className="text-foreground-muted">Play downloaded videos without internet connection</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-hover">
                <div className="h-8 w-8 rounded-lg bg-warning/10 text-warning flex items-center justify-center flex-shrink-0">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Private & Secure</p>
                  <p className="text-foreground-muted">Videos stay in app storage, never in your gallery</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage