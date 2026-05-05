import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAppStore } from '@/store'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ThemeToggle } from '@/components/ThemeToggle'
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  DashboardSpeed01Icon, 
  AlertCircleIcon,
  FileValidationIcon,
  UserMultiple02Icon,
  Settings02Icon,
  Logout03Icon,
  SecurityIcon,
  Building03Icon,
} from '@hugeicons/core-free-icons'

const menuItems = [
  {
    title: 'Dashboard',
    icon: DashboardSpeed01Icon,
    path: '/staff/dashboard',
    roles: ['staff', 'environmental', 'agricultural'], // All roles
  },
  {
    title: 'Action Center',
    icon: AlertCircleIcon,
    path: '/staff/action-center',
    roles: ['staff', 'environmental', 'agricultural'], // All roles
  },
  {
    title: '1BAC',
    icon: Building03Icon,
    path: '/staff/1bac',
    roles: ['staff', 'environmental', 'agricultural'], // All roles
  },
  {
    title: 'PNP',
    icon: SecurityIcon,
    path: '/staff/pnp',
    roles: ['staff', 'environmental', 'agricultural'], // All roles
  },
  {
    title: 'Report',
    icon: FileValidationIcon,
    path: '/staff/report',
    roles: ['staff', 'environmental', 'agricultural'], // All roles
  },
  {
    title: 'Users',
    icon: UserMultiple02Icon,
    path: '/staff/users',
    roles: ['staff'], // Only staff can see this
  },
]

function StaffSidebar() {
  const { user, logout } = useAppStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { state, isMobile, setOpenMobile } = useSidebar()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleNavigate = (path: string) => {
    navigate(path)
    // Auto-collapse sidebar on mobile after navigation
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const isCollapsed = state === 'collapsed'

  // Filter menu items based on user role
  const visibleMenuItems = menuItems.filter((item) =>
    item.roles.includes(user?.role || '')
  )

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        {isCollapsed ? (
          <div className="flex items-center justify-center py-4">
            <img
              src="/images/bataanlogo.png"
              alt="Bataan Logo"
              className="w-8 h-8 object-contain"
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 px-6 py-4">
            <img
              src="/images/bataanlogo.png"
              alt="Bataan Logo"
              className="w-8 h-8 object-contain shrink-0"
            />
            <div className="flex flex-col">
              <span className="font-heading font-bold text-sm">1BAC</span>
              <span className="text-xs text-muted-foreground">Monitoring</span>
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <TooltipProvider>
                {visibleMenuItems.map((item) => {
                  const isActive = location.pathname === item.path
                  return (
                    <SidebarMenuItem key={item.path}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            onClick={() => handleNavigate(item.path)}
                            isActive={isActive}
                            className="w-full"
                            tooltip={item.title}
                          >
                            <HugeiconsIcon
                              icon={item.icon}
                              className="w-4 h-4"
                              strokeWidth={2}
                            />
                            <span>{item.title}</span>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        {isCollapsed && (
                          <TooltipContent side="right">
                            {item.title}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </SidebarMenuItem>
                  )
                })}
              </TooltipProvider>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <SidebarMenu>
          <SidebarMenuItem className={isCollapsed ? 'flex justify-center' : ''}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton
                    onClick={() => handleNavigate('/staff/settings')}
                    isActive={location.pathname === '/staff/settings'}
                    tooltip="Settings"
                  >
                    <HugeiconsIcon
                      icon={Settings02Icon}
                      className="w-4 h-4"
                      strokeWidth={2}
                    />
                    <span>Settings</span>
                  </SidebarMenuButton>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right">Settings</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </SidebarMenuItem>
        </SidebarMenu>

        <Separator className="my-4" />

        <DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  {isCollapsed ? (
                    <Button
                      variant="ghost"
                      className="w-full justify-center p-2"
                      size="icon"
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {getInitials(user?.name || 'User')}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 px-2 h-auto py-2"
                    >
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {getInitials(user?.name || 'User')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col items-start text-left flex-1 min-w-0">
                        <span className="text-sm font-medium truncate w-full">
                          {user?.name}
                        </span>
                        <span className="text-xs text-muted-foreground truncate w-full">
                          {user?.email}
                        </span>
                      </div>
                    </Button>
                  )}
                </DropdownMenuTrigger>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  <div className="text-xs">
                    <div className="font-medium">{user?.name}</div>
                    <div className="text-muted-foreground">{user?.email}</div>
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNavigate('/staff/settings')}>
              <HugeiconsIcon
                icon={Settings02Icon}
                className="w-4 h-4 mr-2"
                strokeWidth={2}
              />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <HugeiconsIcon
                icon={Logout03Icon}
                className="w-4 h-4 mr-2"
                strokeWidth={2}
              />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

export default function StaffLayout() {
  const location = useLocation()

  const allMenuItems = [
    {
      title: 'Dashboard',
      icon: DashboardSpeed01Icon,
      path: '/staff/dashboard',
    },
    {
      title: 'Action Center',
      icon: AlertCircleIcon,
      path: '/staff/action-center',
    },
    {
      title: '1BAC',
      icon: Building03Icon,
      path: '/staff/1bac',
    },
    {
      title: 'PNP',
      icon: SecurityIcon,
      path: '/staff/pnp',
    },
    {
      title: 'Report',
      icon: FileValidationIcon,
      path: '/staff/report',
    },
    {
      title: 'Users',
      icon: UserMultiple02Icon,
      path: '/staff/users',
    },
  ]

  // Get current page title
  const currentPageTitle = allMenuItems.find((item) => item.path === location.pathname)?.title || 'Settings'

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <StaffSidebar />

        <main className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center gap-4 px-4">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-6" />
              <div className="flex-1">
                <h1 className="text-sm font-medium">
                  {currentPageTitle}
                </h1>
              </div>
              <ThemeToggle />
            </div>
          </header>

          <div className="flex-1 overflow-x-hidden overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="container mx-auto p-6 max-w-full"
            >
              <Outlet />
            </motion.div>
          </div>
        </main>
      </div>
      <PWAInstallPrompt />
    </SidebarProvider>
  )
}
