import { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
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
  User,
  LogOut,
  Wifi,
  WifiOff,
  Menu,
  Bell,
  Shield,
  HelpCircle,
  ChevronDown,
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

const accountNav = [
  { name: 'Profile', icon: User },
  { name: 'Subscription', icon: Shield },
  { name: 'Help Center', icon: HelpCircle },
]

function NavItem({ item, collapsed, onNavigate, badge }) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <NavLink
            to={item.href}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground-muted hover:bg-surface-hover hover:text-foreground',
                collapsed && 'justify-center px-2',
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className={cn('truncate', collapsed && 'hidden')}>{item.name}</span>
            {badge > 0 && (
              <Badge className="ml-auto h-5 min-w-5 px-1.5 text-xs bg-primary text-primary-foreground">
                {badge}
              </Badge>
            )}
          </NavLink>
        </TooltipTrigger>
        {collapsed && (
          <TooltipContent side="right">
            <p>{item.name}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { tenant, downloads, offline, simulateOffline, setSimulatedOffline } = useApp()

  const isActive = (href) =>
    href === '/' ? location.pathname === '/' : location.pathname.startsWith(href)

  const sidebarBody = (onNavigate) => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-heading font-bold text-xl">
          {tenant.name.charAt(0)}
        </div>
        <div className={cn('flex-1 min-w-0', collapsed && 'hidden')}>
          <p className="truncate font-heading font-semibold text-foreground">{tenant.name}</p>
          <p className="truncate text-xs text-foreground-muted">{tenant.domain}</p>
        </div>
      </div>

      <Separator />

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <p className={cn('px-3 pt-1 pb-2 text-xs font-semibold text-foreground-muted uppercase tracking-wider', collapsed && 'hidden')}>
          Navigation
        </p>
        {navigation.map((item) => (
          <NavItem
            key={item.name}
            item={item}
            collapsed={collapsed}
            onNavigate={onNavigate}
            badge={item.name === 'Downloads' ? downloads.downloadedCount : 0}
          />
        ))}

        <div className="py-2">
          <Separator />
        </div>

        <p className={cn('px-3 pt-1 pb-2 text-xs font-semibold text-foreground-muted uppercase tracking-wider', collapsed && 'hidden')}>
          Account
        </p>
        {accountNav.map((item) => (
          <button
            key={item.name}
            type="button"
            className={cn(
              'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground-muted hover:bg-surface-hover hover:text-foreground transition-all duration-200 cursor-pointer',
              collapsed && 'justify-center px-2',
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className={cn('truncate', collapsed && 'hidden')}>{item.name}</span>
          </button>
        ))}
      </nav>

      <div className="p-3 space-y-3 border-t border-border">
        <div className={cn(collapsed && 'hidden')}>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-hover border border-border">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {offline ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {offline ? 'Offline Mode' : 'Online'}
              </p>
              <p className="text-xs text-foreground-muted truncate">
                {downloads.downloadedCount} saved · {formatBytes(downloads.downloadedBytes)}
              </p>
            </div>
          </div>
        </div>
        <div className={cn('flex items-center justify-between px-1', collapsed && 'hidden')}>
          <Label className="text-sm font-medium text-foreground-muted cursor-pointer">
            Simulate Offline
          </Label>
          <Switch
            checked={simulateOffline}
            onCheckedChange={setSimulatedOffline}
            aria-label="Simulate offline mode"
          />
        </div>
        <div className={cn('flex items-center gap-3 p-2', collapsed && 'justify-center px-0')}>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs font-medium bg-primary text-primary-foreground">
              ST
            </AvatarFallback>
          </Avatar>
          <div className={cn('flex-1 min-w-0', collapsed && 'hidden')}>
            <p className="text-sm font-medium text-foreground truncate">Student User</p>
            <p className="text-xs text-foreground-muted truncate">{tenant.plan} Plan</p>
          </div>
          <div className={cn(collapsed && 'hidden')}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ChevronDown className="h-4 w-4" />
                  <span className="sr-only">User menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Subscription
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="flex items-center gap-2 text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <TooltipProvider>
      <div className="app-shell flex h-screen bg-background">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            'hidden lg:flex flex-col shrink-0 border-r border-border bg-surface transition-all duration-300 ease-in-out h-full',
            collapsed ? 'w-20' : 'w-64',
          )}
        >
          {sidebarBody(undefined)}
        </aside>

        <div className="flex flex-col flex-1 min-w-0">
          <header className="topbar">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6 gap-3">
              <div className="flex items-center gap-3">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="lg:hidden h-10 w-10" aria-label="Open menu">
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
                  className="hidden lg:inline-flex h-9 px-3"
                >
                  <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
                </Button>

                <nav className="hidden md:flex items-center gap-1 text-sm">
                  {navigation.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={() =>
                        cn(
                          'px-3 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5',
                          isActive(item.href)
                            ? 'text-primary font-medium bg-primary/10'
                            : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover',
                        )
                      }
                    >
                      {item.name}
                      {item.name === 'Downloads' && downloads.downloadedCount > 0 && (
                        <Badge className="h-5 min-w-5 px-1.5 text-xs bg-primary text-primary-foreground">
                          {downloads.downloadedCount}
                        </Badge>
                      )}
                    </NavLink>
                  ))}
                </nav>
              </div>

              <div className="flex items-center gap-2 lg:gap-3">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-hover border border-border">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                    {offline ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-foreground leading-none">
                      {offline ? 'Offline' : 'Online'}
                    </p>
                    <p className="text-[10px] text-foreground-muted mt-0.5">
                      {downloads.downloadedCount} saved · {formatBytes(downloads.downloadedBytes)}
                    </p>
                  </div>
                </div>

                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="relative h-10 w-10 cursor-pointer" aria-label="Notifications">
                        <Bell className="h-5 w-5" />
                        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                          3
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="end">
                      <p className="text-sm font-medium">3 new notifications</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <Avatar className="h-10 w-10 cursor-pointer">
                  <AvatarFallback className="text-sm font-medium bg-primary text-primary-foreground">
                    ST
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
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
