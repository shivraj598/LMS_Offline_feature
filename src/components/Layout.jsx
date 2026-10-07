import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  BookOpen,
  Download,
  Settings,
  ChevronLeft,
  Wifi,
  WifiOff,
  Menu,
  Clapperboard,
} from 'lucide-react'
import { useApp } from '@/state/AppContext'
import { formatBytes } from '@/lib/format'
import { Toaster } from '@/components/ui/sonner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'My Courses', href: '/courses', icon: BookOpen },
  { name: 'Downloads', href: '/downloads', icon: Download },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Owner Studio', href: '/owner', icon: Clapperboard },
]

const student = { name: 'Anisha Thapa', initials: 'AT' }

function NavItem({ item, onNavigate, badge }) {
  return (
    <NavLink
      to={item.href}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors duration-200 cursor-pointer',
          isActive
            ? 'bg-primary-light text-primary'
            : 'text-foreground-muted hover:bg-surface-hover hover:text-foreground',
        )
      }
    >
      <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="truncate">{item.name}</span>
      {badge > 0 && (
        <Badge className="ml-auto h-5 min-w-5 px-1.5 text-xs bg-primary text-primary-foreground">
          {badge}
        </Badge>
      )}
    </NavLink>
  )
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { tenant, downloads, offline, simulateOffline, setSimulatedOffline } = useApp()

  const sidebarBody = (onNavigate) => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary font-heading text-lg font-bold text-primary-foreground">
          {tenant.name.charAt(0)}
        </div>
        <div className={cn('flex-1 min-w-0', collapsed && 'hidden')}>
          <p className="truncate font-heading font-semibold text-foreground">{tenant.name}</p>
          <p className="truncate text-xs text-foreground-muted">{tenant.domain}</p>
        </div>
      </div>

      <Separator />

      <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Main">
        {navigation.map((item) => (
          <NavItem
            key={item.name}
            item={item}
            onNavigate={onNavigate}
            badge={item.name === 'Downloads' ? downloads.downloadedCount : 0}
          />
        ))}
      </nav>

      <div className="space-y-3 border-t border-border p-3">
        <div className={cn(collapsed && 'hidden')}>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-hover p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {offline ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {offline ? 'Offline mode' : 'Online'}
              </p>
              <p className="truncate text-xs text-foreground-muted">
                {downloads.downloadedCount} saved · {formatBytes(downloads.downloadedBytes)}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between px-1">
            <Label className="cursor-pointer text-sm font-medium text-foreground-muted">
              Simulate offline
            </Label>
            <Switch
              checked={simulateOffline}
              onCheckedChange={setSimulatedOffline}
              aria-label="Simulate offline mode"
            />
          </div>
        </div>

        <div className={cn('flex items-center gap-3 p-2', collapsed && 'justify-center px-0')}>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
              {student.initials}
            </AvatarFallback>
          </Avatar>
          <div className={cn('min-w-0 flex-1', collapsed && 'hidden')}>
            <p className="truncate text-sm font-medium text-foreground">{student.name}</p>
            <p className="truncate text-xs text-foreground-muted">{tenant.plan} plan</p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <TooltipProvider>
      <div className="app-shell flex h-dvh bg-background">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            'hidden shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-300 ease-in-out lg:flex h-full',
            collapsed ? 'w-20' : 'w-64',
          )}
        >
          {sidebarBody(undefined)}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="topbar">
            <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
              <div className="flex items-center gap-3">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 lg:hidden"
                      aria-label="Open menu"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-72 p-0">
                    {sidebarBody(() => setMobileOpen(false))}
                  </SheetContent>
                </Sheet>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCollapsed(!collapsed)}
                  className="hidden h-9 px-3 lg:inline-flex"
                  aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  <ChevronLeft
                    className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')}
                  />
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        'flex items-center gap-2 rounded-lg border border-border bg-surface-hover px-3 py-1.5',
                        offline && 'border-warning/40 bg-warning-light',
                      )}
                    >
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          offline ? 'bg-warning' : 'bg-accent',
                        )}
                        aria-hidden="true"
                      />
                      <span className="text-xs font-semibold text-foreground">
                        {offline ? 'Offline' : 'Online'}
                      </span>
                      <span className="hidden text-xs text-foreground-muted sm:inline">
                        {downloads.downloadedCount} saved ·{' '}
                        {formatBytes(downloads.downloadedBytes)}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="end">
                    <p>Offline lessons stay playable with no internet</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'bg-surface border-border text-foreground',
          duration: 5000,
        }}
      />
    </TooltipProvider>
  )
}

export default AppLayout
