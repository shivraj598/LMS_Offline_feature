import { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  BookOpen,
  Download,
  Settings,
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
  Wifi,
  WifiOff,
  Menu,
  X,
  Bell,
  Shield,
  HelpCircle,
  ChevronDown,
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
]

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const location = useLocation()
  const { tenant, downloads, offline, simulateOffline, setSimulatedOffline, askPersistentStorage } = useApp()

  const isActive = (href) => location.pathname === href || (href !== '/' && location.pathname.startsWith(href))

  return (
    <SidebarProvider>
      <TooltipProvider>
        <div className="app-shell flex h-screen bg-background">
          <Sidebar
            open={sidebarOpen}
            onOpenChange={setSidebarOpen}
            className={cn(
              "transition-all duration-300 ease-in-out",
              mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}
          >
            <SidebarHeader className="flex h-16 shrink-0 items-center gap-2 overflow-hidden p-4">
              <div className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-heading font-bold text-xl transition-all duration-300",
                !sidebarOpen && "hidden"
              )}>
                {tenant.name.charAt(0)}
              </div>
              <div className={cn("flex flex-1 overflow-hidden transition-all duration-300", !sidebarOpen && "hidden")}>
                <p className="truncate font-heading font-semibold text-foreground">{tenant.name}</p>
                <p className="truncate text-xs text-foreground-muted">{tenant.domain}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto h-7 w-7"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label="Toggle sidebar"
              >
                {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </SidebarHeader>
            <SidebarContent className="flex flex-col pt-0">
              <SidebarGroup>
                <SidebarGroupLabel className={cn("px-4 text-xs font-semibold text-foreground-muted uppercase tracking-wider", !sidebarOpen && "hidden")}>
                  Navigation
                </SidebarGroupLabel>
                <SidebarMenu>
                  {navigation.map((item) => (
                    <SidebarMenuItem key={item.name}>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarMenuButton
                              asChild
                              isActive={isActive(item.href)}
                              className={cn(
                                "data-[state=active]:bg-primary-light data-[state=active]:text-primary data-[state=active]:font-medium",
                                "gap-3 px-3 py-2.5",
                                !sidebarOpen && "justify-center px-2"
                              )}
                            >
                              <NavLink to={item.href} onClick={() => setMobileSidebarOpen(false)}>
                                <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                                <span className={cn("truncate font-medium", !sidebarOpen && "hidden")}>
                                  {item.name}
                                </span>
                                {item.name === 'Downloads' && downloads.downloadedCount > 0 && (
                                  <Badge className="ml-auto h-5 min-w-5 px-1.5 text-xs bg-primary text-primary-foreground">
                                    {downloads.downloadedCount}
                                  </Badge>
                                )}
                              </NavLink>
                            </SidebarMenuButton>
                          </TooltipTrigger>
                          <TooltipContent side="right" className={cn(!sidebarOpen && "hidden")}>
                            {item.name}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
              <SidebarSeparator className="my-4" />
              <SidebarGroup>
                <SidebarGroupLabel className={cn("px-4 text-xs font-semibold text-foreground-muted uppercase tracking-wider", !sidebarOpen && "hidden")}>
                  Account
                </SidebarGroupLabel>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            className={cn("gap-3 px-3 py-2.5", !sidebarOpen && "justify-center px-2")}
                          >
                            <User className="h-5 w-5 shrink-0" aria-hidden="true" />
                            <span className={cn("truncate font-medium", !sidebarOpen && "hidden")}>Profile</span>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right" className={cn(!sidebarOpen && "hidden")}>
                          Profile
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            className={cn("gap-3 px-3 py-2.5", !sidebarOpen && "justify-center px-2")}
                          >
                            <Shield className="h-5 w-5 shrink-0" aria-hidden="true" />
                            <span className={cn("truncate font-medium", !sidebarOpen && "hidden")}>Subscription</span>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right" className={cn(!sidebarOpen && "hidden")}>
                          Subscription
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            className={cn("gap-3 px-3 py-2.5", !sidebarOpen && "justify-center px-2")}
                          >
                            <HelpCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
                            <span className={cn("truncate font-medium", !sidebarOpen && "hidden")}>Help Center</span>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right" className={cn(!sidebarOpen && "hidden")}>
                          Help Center
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>
            </SidebarContent>
            <SidebarFooter className="p-4">
              <SidebarSeparator />
              <div className={cn("space-y-3", !sidebarOpen && "hidden")}>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-hover border border-border">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {offline ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {offline ? 'Offline Mode' : 'Online'}
                    </p>
                    <p className="text-xs text-foreground-muted">
                      {downloads.downloadedCount} lesson{downloads.downloadedCount !== 1 ? 's' : ''} saved · {formatBytes(downloads.downloadedBytes)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-foreground-muted cursor-pointer">
                    Simulate Offline
                  </Label>
                  <Switch
                    checked={simulateOffline}
                    onCheckedChange={setSimulatedOffline}
                    aria-label="Simulate offline mode"
                  />
                </div>
              </div>
              <div className={cn("flex items-center gap-3 p-3", !sidebarOpen && "justify-center px-2")}>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs font-medium bg-primary text-primary-foreground">
                    ST
                  </AvatarFallback>
                </Avatar>
                <div className={cn("flex-1 min-w-0", !sidebarOpen && "hidden")}>
                  <p className="text-sm font-medium text-foreground truncate">Student User</p>
                  <p className="text-xs text-foreground-muted truncate">{tenant.plan} Plan</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ChevronDown className="h-4 w-4" />
                      <span className="sr-only">User menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="font-heading font-semibold">Account</DropdownMenuLabel>
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
            </SidebarFooter>
          </Sidebar>

          <div className="main-content flex flex-col min-w-0">
            <header className="topbar">
              <div className="flex h-16 items-center justify-between px-4 sm:px-6">
                <div className="flex items-center gap-4">
                  <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className="lg:hidden h-10 w-10" aria-label="Open menu">
                        <Menu className="h-5 w-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-64 p-0">
                      <Sidebar>
                        <SidebarHeader className="flex h-16 shrink-0 items-center gap-2 overflow-hidden p-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-heading font-bold text-xl">
                            {tenant.name.charAt(0)}
                          </div>
                          <div>
                            <p className="truncate font-heading font-semibold text-foreground">{tenant.name}</p>
                            <p className="truncate text-xs text-foreground-muted">{tenant.domain}</p>
                          </div>
                        </SidebarHeader>
                        <SidebarContent>
                          <SidebarGroup>
                            <SidebarGroupLabel className="px-4 text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                              Navigation
                            </SidebarGroupLabel>
                            <SidebarMenu>
                              {navigation.map((item) => (
                                <SidebarMenuItem key={item.name}>
                                  <SidebarMenuButton
                                    asChild
                                    isActive={isActive(item.href)}
                                    className="gap-3 px-3 py-2.5 data-[state=active]:bg-primary-light data-[state=active]:text-primary data-[state=active]:font-medium"
                                  >
                                    <NavLink to={item.href} onClick={() => setMobileSidebarOpen(false)}>
                                      <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                                      <span className="truncate font-medium">{item.name}</span>
                                      {item.name === 'Downloads' && downloads.downloadedCount > 0 && (
                                        <Badge className="ml-auto h-5 min-w-5 px-1.5 text-xs bg-primary text-primary-foreground">
                                          {downloads.downloadedCount}
                                        </Badge>
                                      )}
                                    </NavLink>
                                  </SidebarMenuButton>
                                </SidebarMenuItem>
                              ))}
                            </SidebarMenu>
                          </SidebarGroup>
                        </SidebarContent>
                      </Sidebar>
                    </SheetContent>
                  </Sheet>

                  <div className="hidden lg:flex lg:items-center lg:gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSidebarOpen(!sidebarOpen)}
                      className="h-9 px-3"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      <span className={sidebarOpen ? "hidden" : "inline"}>Menu</span>
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 lg:gap-4">
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-hover border border-border">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                      {offline ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-foreground">
                        {offline ? 'Offline' : 'Online'}
                      </p>
                      <p className="text-[10px] text-foreground-muted">
                        {downloads.downloadedCount} saved · {formatBytes(downloads.downloadedBytes)}
                      </p>
                    </div>
                  </div>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="relative h-10 w-10"
                          aria-label="Notifications"
                        >
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

                  <Avatar className="h-10 w-10 cursor-pointer" onClick={() => {}}>
                    <AvatarFallback className="text-sm font-medium bg-primary text-primary-foreground">
                      ST
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
            </header>

            <main className="content-area">
              <Outlet />
            </main>
          </div>
        </div>
      </TooltipProvider>
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "bg-surface border-border text-foreground",
          duration: 5000,
          style: {
            boxShadow: 'var(--shadow-xl)',
            borderRadius: 'var(--radius-lg)',
          },
        }}
      />
    </SidebarProvider>
  )
}

export default AppLayout