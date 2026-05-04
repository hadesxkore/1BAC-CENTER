import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/store'
import { db } from '@/config/firebase'
import { collection, getDocs } from 'firebase/firestore'
import { HugeiconsIcon } from '@hugeicons/react'
import { 
  ArrowRight01Icon, 
  FileRemoveIcon,
  SecurityIcon,
  AlertCircleIcon,
  CheckmarkCircle01Icon,
  ChartLineData01Icon
} from '@hugeicons/core-free-icons'
import { format } from 'date-fns'

interface DashboardStats {
  actionCenter: {
    total: number
    pending: number
    completed: number
  }
  pnp: {
    total: number
    pending: number
    completed: number
  }
  recentActivity: Array<{
    id: string
    type: 'action-center' | 'pnp'
    title: string
    status: string
    date: string
  }>
}

export default function Dashboard() {
  const { user } = useAppStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats>({
    actionCenter: { total: 0, pending: 0, completed: 0 },
    pnp: { total: 0, pending: 0, completed: 0 },
    recentActivity: []
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setIsLoading(true)
    try {
      // Fetch Action Center stats
      const concernsSnapshot = await getDocs(collection(db, 'concerns'))
      const concerns = concernsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      
      const actionCenterStats = {
        total: concerns.length,
        pending: concerns.filter((c: any) => c.status === 'pending').length,
        completed: concerns.filter((c: any) => c.status === 'completed').length,
      }

      // Fetch PNP stats
      const pnpSnapshot = await getDocs(collection(db, 'pnp_reports'))
      const pnpReports = pnpSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      
      const pnpStats = {
        total: pnpReports.length,
        pending: pnpReports.filter((r: any) => r.status === 'pending').length,
        completed: pnpReports.filter((r: any) => r.status === 'completed').length,
      }

      // Fetch recent activity (last 5 items from both collections)
      const recentConcerns = concerns
        .sort((a: any, b: any) => {
          const aTime = a.createdAt?.toMillis?.() || 0
          const bTime = b.createdAt?.toMillis?.() || 0
          return bTime - aTime
        })
        .slice(0, 3)
        .map((c: any) => ({
          id: c.id,
          type: 'action-center' as const,
          title: c.reportTitle,
          status: c.status,
          date: c.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
        }))

      const recentPNP = pnpReports
        .sort((a: any, b: any) => {
          const aTime = a.createdAt?.toMillis?.() || 0
          const bTime = b.createdAt?.toMillis?.() || 0
          return bTime - aTime
        })
        .slice(0, 2)
        .map((r: any) => ({
          id: r.id,
          type: 'pnp' as const,
          title: r.reportTitle,
          status: r.status,
          date: r.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
        }))

      const recentActivity = [...recentConcerns, ...recentPNP]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5)

      setStats({
        actionCenter: actionCenterStats,
        pnp: pnpStats,
        recentActivity
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const totalReports = stats.actionCenter.total + stats.pnp.total
  const totalPending = stats.actionCenter.pending + stats.pnp.pending
  const totalCompleted = stats.actionCenter.completed + stats.pnp.completed
  const completionRate = totalReports > 0 ? Math.round((totalCompleted / totalReports) * 100) : 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-heading font-bold">
          Welcome back, {user?.name}
        </h2>
        <p className="text-muted-foreground mt-1">
          Here's an overview of your monitoring system
        </p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Reports */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Total Reports
                  </p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <h3 className="text-4xl font-bold">{totalReports}</h3>
                    <span className="text-sm text-muted-foreground">reports</span>
                  </div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <HugeiconsIcon icon={ChartLineData01Icon} className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pending */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-l-4 border-l-yellow-500 hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Pending
                  </p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <h3 className="text-4xl font-bold text-yellow-600">{totalPending}</h3>
                    <span className="text-sm text-muted-foreground">active</span>
                  </div>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <HugeiconsIcon icon={AlertCircleIcon} className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Completed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Completed
                  </p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <h3 className="text-4xl font-bold text-green-600">{totalCompleted}</h3>
                    <span className="text-sm text-muted-foreground">resolved</span>
                  </div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Completion Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Completion Rate
                  </p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <h3 className="text-4xl font-bold text-purple-600">{completionRate}%</h3>
                    <span className="text-sm text-muted-foreground">success</span>
                  </div>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <HugeiconsIcon icon={ChartLineData01Icon} className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Action Center Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="hover:shadow-lg transition-all hover:border-orange-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <HugeiconsIcon icon={FileRemoveIcon} className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Action Center</CardTitle>
                    <CardDescription>Manage community concerns</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{stats.actionCenter.total}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-600">{stats.actionCenter.pending}</p>
                  <p className="text-xs text-muted-foreground mt-1">Pending</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{stats.actionCenter.completed}</p>
                  <p className="text-xs text-muted-foreground mt-1">Done</p>
                </div>
              </div>
              <Separator />
              <Button 
                onClick={() => navigate('/staff/action-center')} 
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                View Action Center
                <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* PNP Reports Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="hover:shadow-lg transition-all hover:border-blue-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <HugeiconsIcon icon={SecurityIcon} className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">PNP Reports</CardTitle>
                    <CardDescription>Police incident reports</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{stats.pnp.total}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-600">{stats.pnp.pending}</p>
                  <p className="text-xs text-muted-foreground mt-1">Pending</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{stats.pnp.completed}</p>
                  <p className="text-xs text-muted-foreground mt-1">Done</p>
                </div>
              </div>
              <Separator />
              <Button 
                onClick={() => navigate('/staff/pnp')} 
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                View PNP Reports
                <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest reports and updates</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
                />
              </div>
            ) : stats.recentActivity.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No recent activity</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentActivity.map((activity, index) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate(activity.type === 'action-center' ? '/staff/action-center' : '/staff/pnp')}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-lg ${
                        activity.type === 'action-center' 
                          ? 'bg-orange-50' 
                          : 'bg-blue-50'
                      }`}>
                        <HugeiconsIcon 
                          icon={activity.type === 'action-center' ? FileRemoveIcon : SecurityIcon} 
                          className={`w-4 h-4 ${
                            activity.type === 'action-center' 
                              ? 'text-orange-600' 
                              : 'text-blue-600'
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(activity.date), 'MMM dd, yyyy • HH:mm')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        activity.status === 'completed'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-yellow-50 text-yellow-700'
                      }`}>
                        {activity.status}
                      </span>
                      <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
