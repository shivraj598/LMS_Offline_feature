import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useApp, statusLabel } from '../state/AppContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatBytes, formatDuration } from '../lib/format'
import { getOfflinePlaybackUrl } from '../lib/media'
import { youtubeEmbedUrl, youtubeWatchUrl } from '../lib/youtube'
import { JOB_STATUS, keyForLesson } from '../lib/downloadManager'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Play,
  Download,
  DownloadCloud,
  CheckCircle2,
  X,
  RotateCcw,
  Trash2,
  ExternalLink,
  Maximize,
  Minimize,
  Info,
  AlertTriangle,
  CloudOff,
  Wifi,
  Clock,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu'

export function WatchPage() {
  const { courseId, lessonId } = useParams()
  const navigate = useNavigate()
  const { courses, downloads, tenant, offline, jobFor, removeDownload, downloadLesson } = useApp()
  const [mode, setMode] = useState(null)
  const [offlineUrl, setOfflineUrl] = useState(null)
  const [preparing, setPreparing] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const videoRef = useRef(null)

  const course = courses.find((item) => item.id === courseId)
  const lesson = course?.lessons.find((item) => item.id === lessonId)

  if (!course || !lesson) {
    return (
      <div className="animate-fade-in max-w-2xl mx-auto text-center py-16">
        <Play className="h-16 w-16 mx-auto text-foreground-muted mb-4" />
        <h1 className="text-2xl font-heading font-bold text-foreground mb-2">Lesson Not Found</h1>
        <p className="text-foreground-muted mb-6">This lesson may have been removed.</p>
        <Link to="/courses">
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Courses
          </Button>
        </Link>
      </div>
    )
  }

  const index = course.lessons.findIndex((item) => item.id === lesson.id)
  const previous = index > 0 ? course.lessons[index - 1] : null
  const next = index < course.lessons.length - 1 ? course.lessons[index + 1] : null

  const job = jobFor(lesson)
  const downloaded = job?.status === JOB_STATUS.DOWNLOADED
  const effectiveMode = mode ?? (downloaded ? 'offline' : 'stream')
  const status = statusLabel(job)

  const embedUrl = youtubeEmbedUrl(lesson.youtubeUrl)
  const watchUrl = youtubeWatchUrl(lesson.youtubeUrl)

  useEffect(() => {
    let cancelled = false
    if (effectiveMode !== 'offline' || !downloaded) {
      setOfflineUrl(null)
      return () => {}
    }
    setPreparing(true)
    getOfflinePlaybackUrl(tenant.id, lesson.id)
      .then((entry) => {
        if (cancelled) return
        setOfflineUrl(entry?.url || null)
      })
      .finally(() => {
        if (!cancelled) setPreparing(false)
      })
    return () => {
      cancelled = true
    }
  }, [effectiveMode, downloaded, tenant.id, lesson.id])

  const handleDownload = async () => {
    await downloadLesson(lesson, course)
  }

  const handleRemove = async () => {
    await removeDownload(job.key, job.title)
  }

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (!isFullscreen) {
        videoRef.current.requestFullscreen().catch(() => {})
        setIsFullscreen(true)
      } else {
        document.exitFullscreen().catch(() => {})
        setIsFullscreen(false)
      }
    }
  }

  const savedLessons = downloads.order
    .map((key) => downloads.jobs[key])
    .filter((item) => item?.status === JOB_STATUS.DOWNLOADED && item.courseId)

  return (
    <TooltipProvider>
      <div className="animate-fade-in">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <Link to={`/courses/${courseId}`} className="flex items-center gap-2 text-foreground-muted hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
            <span>{course.title}</span>
          </Link>
          <Separator className="h-5 w-px bg-border flex-shrink-0 sm:hidden" />
          <nav className="flex items-center gap-2 text-sm text-foreground-muted flex-1 overflow-x-auto pb-1">
            {course.lessons.map((l, i) => (
              <Link
                key={l.id}
                to={`/watch/${courseId}/${l.id}`}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap",
                  l.id === lesson.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-surface-hover text-foreground-muted"
                )}
              >
                {i + 1}. {l.title}
              </Link>
            ))}
          </nav>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <div className="relative aspect-video bg-black">
                {effectiveMode === 'offline' && downloaded ? (
                  preparing && !offlineUrl ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black">
                      <div className="text-center text-white">
                        <div className="h-12 w-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-lg font-medium">Preparing offline copy…</p>
                        <p className="text-sm text-gray-400 mt-1">This may take a moment</p>
                      </div>
                    </div>
                  ) : offlineUrl ? (
                    <video
                      ref={videoRef}
                      className="absolute inset-0 w-full h-full object-contain"
                      src={offlineUrl}
                      poster={job?.posterDataUrl || undefined}
                      controls
                      playsInline
                      preload="metadata"
                      defaultMuted={isMuted}
                      defaultVolume={volume}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black">
                      <div className="text-center text-white">
                        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-amber-400" />
                        <p className="text-lg font-medium">Download Incomplete</p>
                        <p className="text-sm text-gray-400 mt-1">Tap resume to repair this download</p>
                        <Button className="mt-4" variant="outline" onClick={() => {}}>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Resume Download
                        </Button>
                      </div>
                    </div>
                  )
                ) : offline ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black">
                    <div className="text-center text-white p-8">
                      <CloudOff className="h-16 w-16 mx-auto mb-4 text-gray-500" />
                      <h3 className="text-xl font-semibold mb-2">Not Available Offline</h3>
                      <p className="text-gray-400 max-w-md mx-auto mb-6">
                        This lesson is not saved on this device, and streaming requires internet.
                        Save lessons before you travel so they're available offline.
                      </p>
                      {savedLessons.length > 0 && (
                        <div className="mt-6">
                          <p className="text-sm text-gray-400 mb-3">Available offline on this device:</p>
                          <div className="flex flex-wrap gap-2 justify-center">
                            {savedLessons.map((item) => (
                              <Link
                                key={item.key}
                                to={`/watch/${item.courseId}/${item.lessonId}`}
                                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm text-white transition-colors"
                              >
                                {item.title}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : embedUrl ? (
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src={embedUrl}
                    title={lesson.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-black">
                    <div className="text-center text-white">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-amber-400" />
                      <p className="text-lg font-medium">No Video Source</p>
                      <p className="text-sm text-gray-400 mt-1">This lesson has no playable source attached</p>
                    </div>
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={effectiveMode === 'offline' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setMode('offline')}
                              disabled={!downloaded}
                              className="gap-1.5"
                            >
                              <DownloadCloud className="h-4 w-4" />
                              Offline
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Play from local storage (no internet)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={effectiveMode === 'stream' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setMode('stream')}
                              disabled={offline || !embedUrl}
                              className="gap-1.5"
                            >
                              <Wifi className="h-4 w-4" />
                              YouTube
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Stream from YouTube (requires internet)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <div className="flex items-center gap-2 ml-auto flex-wrap">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={handleDownload}
                              disabled={downloaded || offline}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Download for offline viewing</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={toggleFullscreen}
                            >
                              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Toggle fullscreen</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {downloaded && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={handleRemove}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Remove from this device</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}

                      {watchUrl && !downloaded && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                asChild
                              >
                                <Link to={watchUrl} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </Link>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Open on YouTube</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {job && !downloaded && job.status !== JOB_STATUS.ERROR && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-0 pb-4 px-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-foreground">Download Progress</span>
                    <Badge variant={job.status === JOB_STATUS.DOWNLOADING ? 'default' : 'secondary'} className="gap-1">
                      {job.status === JOB_STATUS.DOWNLOADING ? (
                        <>
                          <Play className="h-3 w-3 animate-spin" />
                          Downloading
                        </>
                      ) : job.status === JOB_STATUS.PAUSED ? (
                        <>
                          <span className="h-3 w-3" style={{ background: 'currentColor', borderRadius: '50%' }} />
                          Paused
                        </>
                      ) : (
                        <>
                          <Download className="h-3 w-3" />
                          Queued
                        </>
                      )}
                    </Badge>
                  </div>
                  <Progress value={job.percent} className="h-3 mb-2" />
                  <div className="flex items-center justify-between text-sm text-foreground-muted">
                    <span>{Math.floor(job.percent)}% complete</span>
                    {job.totalBytes && (
                      <span>{formatBytes(job.receivedBytes || 0)} / {formatBytes(job.totalBytes)}</span>
                    )}
                    {job.bytesPerSecond && (
                      <span>{formatBytes(job.bytesPerSecond)}/s</span>
                    )}
                  </div>
                  {job.status === JOB_STATUS.DOWNLOADING && (
                    <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => {}}>
                      <X className="h-4 w-4 mr-2" />
                      Pause Download
                    </Button>
                  )}
                  {job.status === JOB_STATUS.PAUSED && (
                    <Button variant="default" size="sm" className="mt-3 w-full" onClick={() => {}}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Resume Download
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {job?.status === JOB_STATUS.ERROR && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="pt-0 pb-4 px-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-destructive">Download Failed</p>
                      <p className="text-sm text-foreground-muted mt-1">{job.error}</p>
                      <div className="flex gap-2 mt-3">
                        {job.retryable !== false && (
                          <Button variant="default" size="sm" onClick={() => {}}>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Retry Download
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={handleRemove}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {downloaded && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-green-800">Playing Offline Copy</p>
                    <p className="text-sm text-green-700">
                      This video plays from local storage. No internet required. Stored privately in app — not in your gallery.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!lesson.sourceUrl && !lesson.youtubeUrl && !downloaded && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                    <Info className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-amber-800">No Video Attached</p>
                    <p className="text-sm text-amber-700 mt-1">
                      This lesson has no video yet. Ask your tuition centre to add a YouTube link or video file.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-[1fr_360px] gap-6">
            <div>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between">
                    Lesson Info
                    <Badge variant={downloaded ? 'secondary' : 'outline'} className="gap-1.5">
                      {downloaded ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          Downloaded
                        </>
                      ) : job?.status === JOB_STATUS.DOWNLOADING ? (
                        <>
                          <Play className="h-3 w-3 animate-spin" />
                          Downloading
                        </>
                      ) : (
                        <>
                          <Download className="h-3 w-3" />
                          Not Saved
                        </>
                      )}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-surface-hover">
                      <p className="text-xs text-foreground-muted">Topic</p>
                      <p className="font-medium text-foreground">{lesson.topic}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-surface-hover">
                      <p className="text-xs text-foreground-muted">Duration</p>
                      <p className="font-medium text-foreground">{formatDuration(lesson.durationSec)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-surface-hover">
                      <p className="text-xs text-foreground-muted">Position</p>
                      <p className="font-medium text-foreground">Lesson {index + 1} of {course.lessons.length}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-surface-hover">
                      <p className="text-xs text-foreground-muted">Status</p>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          status.tone === 'done' && "bg-green-100 text-green-700",
                          status.tone === 'busy' && "bg-primary/10 text-primary",
                          status.tone === 'paused' && "bg-amber-100 text-amber-700",
                          status.tone === 'error' && "bg-red-100 text-red-700",
                          status.tone === 'idle' && "bg-slate-100 text-slate-700"
                        )}>
                          {status.text}
                        </span>
                      </div>
                    </div>
                  </div>

                  {downloaded && job?.receivedBytes && (
                    <div className="p-3 rounded-lg bg-green-50 border border-green-100">
                      <p className="text-xs text-green-700 font-medium flex items-center gap-1.5">
                        <Download className="h-3.5 w-3.5" />
                        Saved: {formatBytes(job.receivedBytes)} on this device
                        {job.posterDataUrl && ' · Thumbnail cached'}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {!downloaded && (lesson.sourceUrl || lesson.youtubeUrl) && (
                      <Button onClick={handleDownload} className="flex-1" disabled={offline}>
                        <Download className="h-4 w-4 mr-2" />
                        Download for Offline
                      </Button>
                    )}
                    {downloaded && (
                      <Button variant="destructive" onClick={handleRemove} className="flex-1">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove Download
                      </Button>
                    )}
                    {watchUrl && !downloaded && (
                      <Button variant="outline" asChild className="flex-1">
                        <Link to={watchUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open on YouTube
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Course Navigation</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-1">
                      {course.lessons.map((item, itemIndex) => {
                        const itemJob = downloads.jobs[keyForLesson(tenant.id, item.id)]
                        const itemDownloaded = itemJob?.status === JOB_STATUS.DOWNLOADED
                        return (
                          <Link
                            key={item.id}
                            to={`/watch/${course.id}/${item.id}`}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-xl transition-colors",
                              "hover:bg-surface-hover",
                              itemDownloaded && "bg-green-50",
                              item.id === lesson.id && "bg-primary/5 border border-primary/20"
                            )}
                          >
                            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-medium text-foreground-muted">{itemIndex + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("font-medium truncate", item.id === lesson.id && "text-primary")}>
                                {item.title}
                              </p>
                              <p className="text-xs text-foreground-muted flex items-center gap-1.5">
                                <Clock className="h-3 w-3" />
                                {formatDuration(item.durationSec)}
                                {itemDownloaded && (
                                  <>
                                    <span className="text-green-600">·</span>
                                    <Download className="h-3 w-3" />
                                    Saved
                                  </>
                                )}
                              </p>
                            </div>
                            {itemDownloaded && (
                              <Badge variant="secondary" className="gap-1 px-2 py-0.5">
                                <CheckCircle2 className="h-3 w-3" />
                              </Badge>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default WatchPage