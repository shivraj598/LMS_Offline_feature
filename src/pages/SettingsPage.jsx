import { useEffect, useState } from 'react'
import { useApp } from '../state/AppContext'
import { getPrefs, savePrefs } from '../lib/db'
import { setCapMb } from '../lib/downloadManager'
import { formatBytes, formatMbValue } from '../lib/format'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Settings as SettingsIcon,
  HardDrive,
  Wifi,
  WifiOff,
  Shield,
  ShieldCheck,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Info,
  Database,
  CloudOff,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function SettingsPage() {
  const {
    tenant,
    tenantId,
    downloads,
    offline,
    simulateOffline,
    setSimulatedOffline,
    clearAllDownloads,
    verifyDownloads,
    askPersistentStorage,
  } = useApp()

  const planCap = tenant.maxOfflineMb
  const [cap, setCap] = useState(planCap)
  const [swReady, setSwReady] = useState(false)

  useEffect(() => {
    getPrefs()
      .then((prefs) => {
        if (Number.isFinite(prefs?.capMb) && prefs.capMb > 0) {
          const bounded = Math.min(prefs.capMb, planCap)
          setCap(bounded)
          setCapMb(bounded)
        }
      })
      .catch(() => {})
  }, [planCap])

  useEffect(() => {
    const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
    setSwReady(Boolean(supported && navigator.serviceWorker.controller))
  }, [])

  const applyCap = async (value) => {
    const bounded = Math.max(50, Math.min(value, planCap))
    setCap(bounded)
    setCapMb(bounded)
    await savePrefs({ capMb: bounded }).catch(() => {})
  }

  const storagePercent = planCap > 0
    ? (downloads.downloadedBytes / (planCap * 1024 * 1024)) * 100
    : 0

  return (
    <div className="animate-fade-in space-y-6 max-w-4xl">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">
          {tenant.name} · {tenant.plan} Plan · Manage offline storage and preferences
        </p>
      </div>

      {/* Storage overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            Offline Storage
          </CardTitle>
          <CardDescription>
            Videos are kept in this browser's private storage. They never appear in your
            gallery or file manager, cannot be shared, and are removed when you clear site data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-surface-hover border border-border">
              <p className="text-sm text-foreground-muted">Lessons Saved</p>
              <p className="text-2xl font-heading font-bold">{downloads.downloadedCount}</p>
            </div>
            <div className="p-4 rounded-xl bg-surface-hover border border-border">
              <p className="text-sm text-foreground-muted">Storage Used</p>
              <p className="text-2xl font-heading font-bold">{formatBytes(downloads.downloadedBytes)}</p>
            </div>
            <div className="p-4 rounded-xl bg-surface-hover border border-border">
              <p className="text-sm text-foreground-muted">Plan Limit</p>
              <p className="text-2xl font-heading font-bold">{formatMbValue(planCap)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground-muted">
                {formatBytes(downloads.downloadedBytes)} of {formatMbValue(planCap)} used
              </span>
              <span className="font-medium">{Math.round(storagePercent)}%</span>
            </div>
            <Progress value={storagePercent} className="h-2" />
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-hover border border-border">
            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
              downloads.storage?.persisted ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
            )}>
              {downloads.storage?.persisted ? <ShieldCheck className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">
                {downloads.storage?.persisted ? 'Storage is protected' : 'Storage is best-effort'}
              </p>
              <p className="text-sm text-foreground-muted mt-0.5">
                {downloads.storage?.persisted
                  ? 'The browser will not clear your downloads automatically.'
                  : 'The browser may clear downloads if the device runs low on space.'}
              </p>
            </div>
            {!downloads.storage?.persisted && (
              <Button variant="outline" size="sm" onClick={askPersistentStorage}>
                Protect my downloads
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Personal cap */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            My Offline Limit
          </CardTitle>
          <CardDescription>
            Your {tenant.plan} plan allows up to {formatMbValue(planCap)}. Keep a smaller
            library for yourself — downloads that would exceed the limit are refused before they start.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">My limit: {formatMbValue(cap)}</Label>
              <Badge variant="outline">{Math.round((cap / planCap) * 100)}% of plan</Badge>
            </div>
            <Slider
              value={[cap]}
              onValueChange={([v]) => applyCap(v)}
              min={50}
              max={planCap}
              step={50}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-foreground-muted">
              <span>50 MB</span>
              <span>{formatMbValue(planCap)}</span>
            </div>
          </div>
          <p className="text-sm text-foreground-muted">
            Currently saved: {formatBytes(downloads.downloadedBytes)}. You will never
            fill your phone by accident — oversized downloads are blocked up front.
          </p>
        </CardContent>
      </Card>

      {/* Connectivity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {offline ? <WifiOff className="h-5 w-5 text-amber-600" /> : <Wifi className="h-5 w-5 text-green-600" />}
            Connectivity & Offline Mode
          </CardTitle>
          <CardDescription>
            The app shell is cached by a service worker, so this site opens with no network at all.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <span className="text-sm font-medium">Network status</span>
            <Badge variant={offline ? 'destructive' : 'secondary'} className="gap-1.5">
              {offline ? <WifiOff className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
              {offline ? 'Offline' : 'Online'}
            </Badge>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-border">
            <span className="text-sm font-medium">App shell cached</span>
            <Badge variant={swReady ? 'secondary' : 'outline'} className="gap-1.5">
              {swReady ? <CheckCircle2 className="h-3 w-3" /> : <Info className="h-3 w-3" />}
              {swReady ? 'Active' : 'Run a production build or reload once'}
            </Badge>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <Label className="text-sm font-medium cursor-pointer">Simulate offline mode</Label>
              <p className="text-xs text-foreground-muted mt-0.5">
                Pretend the internet is gone to test offline playback
              </p>
            </div>
            <Switch
              checked={simulateOffline}
              onCheckedChange={setSimulatedOffline}
              aria-label="Simulate offline mode"
            />
          </div>
          <Button variant="outline" className="w-full" onClick={verifyDownloads}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Verify downloaded files
          </Button>
        </CardContent>
      </Card>

      {/* Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Tenant & Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border text-sm">
            <span className="text-foreground-muted">Tuition centre</span>
            <span className="font-medium">{tenant.name} ({tenantId})</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border text-sm">
            <span className="text-foreground-muted">Domain</span>
            <span className="font-mono text-xs">{tenant.domain}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border text-sm">
            <span className="text-foreground-muted">Plan</span>
            <Badge>{tenant.plan}</Badge>
          </div>
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="text-foreground-muted">Support</span>
            <span className="font-mono text-xs">{tenant.supportEmail}</span>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Removing downloads deletes the stored video chunks immediately and cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="destructive"
            disabled={!downloads.order.length}
            onClick={async () => {
              if (window.confirm('Delete all offline lessons from this device?')) {
                await clearAllDownloads()
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remove all offline lessons
          </Button>
          <Button variant="outline" onClick={verifyDownloads}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Check files first
          </Button>
        </CardContent>
      </Card>

      {/* Explainer */}
      <Card className="bg-secondary/50">
        <CardContent className="pt-6 space-y-3 text-sm text-foreground-muted">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <CloudOff className="h-4 w-4" />
            Why not just download the file?
          </h3>
          <p>
            A normal download lands in the device's storage, where it can be copied, shared or
            uploaded anywhere. A tuition centre's paid content must stay inside the app. Keeping
            the video in the browser's private storage gives the student the same convenience —
            watch later, zero data, works with no signal — while the lesson is removed when the
            download is removed.
          </p>
          <Separator />
          <p>
            Videos play from YouTube while online. Tapping <strong>Download</strong> copies the
            video into this app's private storage via the LMS server (which resolves the YouTube
            URL with yt-dlp and proxies the bytes with Range support). Downloaded lessons show a{' '}
            <strong>Downloaded</strong> badge and play with no internet.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default SettingsPage
