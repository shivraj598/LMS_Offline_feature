import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp, statusLabel } from '../state/AppContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatBytes, formatWhen } from '../lib/format'
import { JOB_STATUS, pause as pauseJob, resume as resumeJob } from '../lib/downloadManager'
import { cn } from '@/lib/utils'
import {
  Download,
  CheckCircle2,
  Clock,
  RotateCcw,
  Trash2,
  Play,
  AlertTriangle,
  X,
  Shield,
  CloudOff,
  RefreshCw,
  Trash,
  Filter,
  Search,
  ChevronDown,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu'

export function DownloadsPage() {
  const { courses, downloads, removeDownload, clearAllDownloads, offline, verifyDownloads } = useApp()
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const all = downloads.order.map((key) => downloads.jobs[key]).filter(Boolean)
  const saved = all.filter((job) => job.status === JOB_STATUS.DOWNLOADED)
  const downloading = all.filter((job) => job.status === JOB_STATUS.DOWNLOADING || job.status === JOB_STATUS.QUEUED)
  const paused = all.filter((job) => job.status === JOB_STATUS.PAUSED)
  const failed = all.filter((job) => job.status === JOB_STATUS.ERROR)

  const filteredJobs = (() => {
    let jobs = all
    if (activeTab === 'saved') jobs = saved
    else if (activeTab === 'downloading') jobs = downloading
    else if (activeTab === 'paused') jobs = paused
    else if (activeTab === 'failed') jobs = failed
    
    if (searchQuery) {
      jobs = jobs.filter(job =>
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.courseTitle?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    return jobs
  })()

  const lessonHref = (job) => {
    const course = courses.find((item) => item.id === job.courseId)
    const lesson = course?.lessons.find((item) => item.id === job.lessonId)
    return course && lesson ? `/watch/${course.id}/${lesson.id}` : null
  }

  const statusConfig = {
    [JOB_STATUS.DOWNLOADED]: { label: 'Downloaded', color: 'success', icon: CheckCircle2 },
    [JOB_STATUS.DOWNLOADING]: { label: 'Downloading', color: 'primary', icon: Download },
    [JOB_STATUS.QUEUED]: { label: 'Queued', color: 'primary', icon: Clock },
    [JOB_STATUS.PAUSED]: { label: 'Paused', color: 'warning', icon: AlertTriangle },
    [JOB_STATUS.ERROR]: { label: 'Failed', color: 'destructive', icon: X },
    [JOB_STATUS.FINALISING]: { label: 'Finalizing', color: 'primary', icon: RotateCcw },
  }

  return (
    <TooltipProvider>
      <div className="animate-fade-in">
        <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">Offline Library</h1>
            <p className="page-subtitle">
              {saved.length} lesson{saved.length !== 1 ? 's' : ''} saved · {formatBytes(downloads.downloadedBytes)}
              {downloads.queuedCount > 0 && ` · ${downloads.queuedCount} in queue`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {offline && (
              <Badge variant="secondary" className="gap-1.5">
                <CloudOff className="h-3 w-3" />
                Offline Mode
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={verifyDownloads} disabled={!all.length}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Verify Files
            </Button>
            <Button variant="destructive" size="sm" onClick={clearAllDownloads} disabled={!all.length}>
              <Trash className="h-4 w-4 mr-2" />
              Remove All
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-surface-hover border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground-muted">Total Saved</p>
                    <p className="text-2xl font-heading font-bold text-foreground">{saved.length}</p>
                  </div>
                  <div className="h-12 w-12 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-surface-hover border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground-muted">Storage Used</p>
                    <p className="text-2xl font-heading font-bold text-foreground">{formatBytes(downloads.downloadedBytes)}</p>
                  </div>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Download className="h-6 w-6" />
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-surface-hover border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground-muted">In Progress</p>
                    <p className="text-2xl font-heading font-bold text-foreground">{downloading.length + paused.length}</p>
                  </div>
                  <div className="h-12 w-12 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                    <Clock className="h-6 w-6" />
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-surface-hover border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground-muted">Failed</p>
                    <p className="text-2xl font-heading font-bold text-foreground">{failed.length}</p>
                  </div>
                  <div className="h-12 w-12 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-foreground-muted" />
                <input
                  type="text"
                  placeholder="Search downloads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-foreground-muted" />
                <div className="flex gap-1 bg-surface-hover p-1 rounded-lg border border-border overflow-x-auto">
                  {[
                    { id: 'all', label: 'All', count: all.length },
                    { id: 'saved', label: 'Saved', count: saved.length },
                    { id: 'downloading', label: 'Active', count: downloading.length },
                    { id: 'paused', label: 'Paused', count: paused.length },
                    { id: 'failed', label: 'Failed', count: failed.length },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap cursor-pointer',
                        activeTab === tab.id
                          ? 'bg-surface text-foreground font-medium shadow-sm'
                          : 'text-foreground-muted hover:text-foreground',
                      )}
                    >
                      {tab.label} <span className="ml-1 text-xs opacity-70">{tab.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {offline && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                <CloudOff className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-amber-800">You're Offline</p>
                <p className="text-sm text-amber-700 mt-1">
                  Downloads are paused. {saved.length} saved lesson{saved.length !== 1 ? 's' : ''} below can be watched now.
                </p>
              </div>
            </div>
          </div>
        )}

        {filteredJobs.length === 0 ? (
          <Card className="py-16 text-center">
            <CardContent>
              <Download className="h-12 w-12 mx-auto text-foreground-muted mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchQuery ? 'No downloads match your search' : all.length === 0 ? 'Nothing downloaded yet' : `No ${activeTab} downloads`}
              </h3>
              <p className="text-foreground-muted mb-4">
                {searchQuery ? 'Try a different search term' : all.length === 0 ? 'Open a course and tap Download on a lesson' : `No downloads with status "${activeTab}"`}
              </p>
              {!searchQuery && all.length === 0 && (
                <Link to="/courses">
                  <Button className="mt-4">
                    <Download className="h-4 w-4 mr-2" />
                    Browse Courses
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredJobs.map((job) => {
              const config = statusConfig[job.status] || { label: job.status, color: 'default', icon: Download }
              const Icon = config.icon
              const href = lessonHref(job)

              return (
                <Card key={job.key} className={cn(
                  "transition-all hover:shadow-md",
                  job.status === JOB_STATUS.DOWNLOADED && "border-green-200 bg-green-50/50",
                  job.status === JOB_STATUS.ERROR && "border-red-200 bg-red-50/50",
                  job.status === JOB_STATUS.DOWNLOADING && "border-primary/30 bg-primary/5"
                )}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-4">
                      {job.posterDataUrl ? (
                        <img
                          src={job.posterDataUrl}
                          alt=""
                          className="h-24 w-32 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="h-24 w-32 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Play className="h-8 w-8 text-foreground-muted" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{job.title}</p>
                            <p className="text-sm text-foreground-muted mt-1">
                              {job.courseTitle || 'Unknown Course'}
                              {job.totalBytes && ` · ${formatBytes(job.totalBytes)}`}
                            </p>
                          </div>
                          <Badge
                            variant={config.color === 'success' ? 'secondary' : config.color === 'destructive' ? 'destructive' : config.color === 'warning' ? 'default' : 'outline'}
                            className={cn("gap-1.5", config.color === 'success' && "bg-green-100 text-green-700")}
                          >
                            <config.icon className="h-3.5 w-3.5" />
                            {config.label}
                          </Badge>
                        </div>

                        <div className="flex flex-col gap-2 min-w-[200px]">
                          {job.status === JOB_STATUS.DOWNLOADING || job.status === JOB_STATUS.QUEUED ? (
                            <>
                              <Progress value={job.percent} className="h-2" />
                              <div className="flex items-center justify-between text-xs text-foreground-muted">
                                <span>{Math.floor(job.percent)}%</span>
                                {job.totalBytes && (
                                  <span>{formatBytes(job.receivedBytes || 0)} / {formatBytes(job.totalBytes)}</span>
                                )}
                                {job.bytesPerSecond && (
                                  <span>{formatBytes(job.bytesPerSecond)}/s</span>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-center gap-2"
                                onClick={() => pauseJob(job.key)}
                              >
                                <X className="h-4 w-4" />
                                Pause
                              </Button>
                            </>
                          ) : job.status === JOB_STATUS.PAUSED ? (
                            <>
                              <Progress value={job.percent} className="h-2" />
                              <div className="flex items-center justify-between text-xs text-foreground-muted">
                                <span>{job.percent > 0 ? `${Math.floor(job.percent)}% saved` : 'Not started'}</span>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="flex-1 justify-center gap-2"
                                  onClick={() => resumeJob(job.key)}
                                  disabled={offline}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  {offline ? 'Offline' : 'Resume'}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="flex-1 justify-center gap-2"
                                  onClick={() => removeDownload(job.key, job.title)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </Button>
                              </div>
                              {job.error && <p className="text-xs text-destructive">{job.error}</p>}
                            </>
                          ) : job.status === JOB_STATUS.ERROR ? (
                            <>
                              {job.error && <p className="text-sm text-destructive mb-2">{job.error}</p>}
                              <div className="flex gap-2">
                                {job.retryable !== false && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="flex-1 justify-center gap-2"
                                    onClick={() => resumeJob(job.key)}
                                    disabled={offline}
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                    Retry
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="flex-1 justify-center gap-2"
                                  onClick={() => removeDownload(job.key, job.title)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Dismiss
                                </Button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 text-sm text-foreground-muted mb-2">
                                <span>{formatBytes(job.receivedBytes)}</span>
                                <span>·</span>
                                <span>{formatWhen(job.downloadedAt)}</span>
                              </div>
                              <div className="flex gap-2">
                                {href ? (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="flex-1 justify-center gap-2"
                                    asChild
                                  >
                                    <Link to={href}>
                                      <Play className="h-4 w-4" />
                                      Play
                                    </Link>
                                  </Button>
                                ) : (
                                  <Button variant="outline" size="sm" className="flex-1 justify-center gap-2" disabled>
                                    <Play className="h-4 w-4" />
                                    Play (Unavailable)
                                  </Button>
                                )}
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="flex-1 justify-center gap-2"
                                        onClick={() => removeDownload(job.key, job.title)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        Remove
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Remove from device to free space</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

export default DownloadsPage