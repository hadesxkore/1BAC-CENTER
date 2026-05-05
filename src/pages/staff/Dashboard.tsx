import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/store'
import { db } from '@/config/firebase'
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore'
import { HugeiconsIcon } from '@hugeicons/react'
import { 
  ArrowRight01Icon, 
  FileRemoveIcon,
  SecurityIcon,
  AlertCircleIcon,
  CheckmarkCircle01Icon,
  ChartLineData01Icon,
  Calendar03Icon,
  TimeQuarterPassIcon
} from '@hugeicons/core-free-icons'
import { format, subDays, subMonths, startOfDay, endOfDay, differenceInDays } from 'date-fns'
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts'

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
  municipalityBreakdown: Array<{
    name: string
    count: number
  }>
  categoryDistribution: Array<{
    name: string
    value: number
  }>
  weeklyTrend: Array<{
    date: string
    completed: number
    pending: number
  }>
  monthlyComparison: {
    currentMonth: number
    lastMonth: number
    percentageChange: number
  }
  averageResolutionTime: number
  responseTimeAnalytics: {
    under24h: number
    under48h: number
    under7days: number
    over7days: number
  }
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function Dashboard() {
  const { user } = useAppStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats>({
    actionCenter: { total: 0, pending: 0, completed: 0 },
    pnp: { total: 0, pending: 0, completed: 0 },
    recentActivity: [],
    municipalityBreakdown: [],
    categoryDistribution: [],
    weeklyTrend: [],
    monthlyComparison: { currentMonth: 0, lastMonth: 0, percentageChange: 0 },
    averageResolutionTime: 0,
    responseTimeAnalytics: { under24h: 0, under48h: 0, under7days: 0, over7days: 0 }
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setIsLoading(true)
    try {
      // Optimize: Fetch both collections in parallel
      const [concernsSnapshot, pnpSnapshot] = await Promise.all([
        getDocs(collection(db, 'concerns')),
        getDocs(collection(db, 'pnp_reports'))
      ])

      const concerns = concernsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      const pnpReports = pnpSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      
      // Calculate Action Center stats
      const actionCenterStats = {
        total: concerns.length,
        pending: concerns.filter((c: any) => c.status === 'pending').length,
        completed: concerns.filter((c: any) => c.status === 'completed').length,
      }

      // Calculate PNP stats
      const pnpStats = {
        total: pnpReports.length,
        pending: pnpReports.filter((r: any) => r.status === 'pending').length,
        completed: pnpReports.filter((r: any) => r.status === 'completed').length,
      }

      // Municipality Breakdown (Top 5)
      const municipalityMap = new Map<string, number>()
      ;[...concerns, ...pnpReports].forEach((item: any) => {
        const muni = item.municipality || 'Unknown'
        municipalityMap.set(muni, (municipalityMap.get(muni) || 0) + 1)
      })
      const municipalityBreakdown = Array.from(municipalityMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      // Category Distribution (Action Center only)
      const categoryMap = new Map<string, number>()
      concerns.forEach((c: any) => {
        const category = c.category === 'environmental' ? 'Environmental' : 
                        c.category === 'agricultural' ? 'Agricultural' : 'Other'
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1)
      })
      const categoryDistribution = Array.from(categoryMap.entries())
        .map(([name, value]) => ({ name, value }))

      // Weekly Trend (Last 7 days)
      const weeklyTrend = []
      for (let i = 6; i >= 0; i--) {
        const date = subDays(new Date(), i)
        const dateStr = format(date, 'MMM dd')
        const dayStart = startOfDay(date)
        const dayEnd = endOfDay(date)
        
        const dayData = [...concerns, ...pnpReports].filter((item: any) => {
          const itemDate = item.createdAt?.toDate?.() || new Date(item.createdAt)
          return itemDate >= dayStart && itemDate <= dayEnd
        })
        
        weeklyTrend.push({
          date: dateStr,
          completed: dayData.filter((item: any) => item.status === 'completed').length,
          pending: dayData.filter((item: any) => item.status === 'pending').length,
        })
      }

      // Monthly Comparison
      const now = new Date()
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastMonthStart = subMonths(currentMonthStart, 1)
      
      const currentMonthData = [...concerns, ...pnpReports].filter((item: any) => {
        const itemDate = item.createdAt?.toDate?.() || new Date(item.createdAt)
        return itemDate >= currentMonthStart
      })
      
      const lastMonthData = [...concerns, ...pnpReports].filter((item: any) => {
        const itemDate = item.createdAt?.toDate?.() || new Date(item.createdAt)
        return itemDate >= lastMonthStart && itemDate < currentMonthStart
      })
      
      const currentMonth = currentMonthData.length
      const lastMonth = lastMonthData.length
      const percentageChange = lastMonth > 0 
        ? Math.round(((currentMonth - lastMonth) / lastMonth) * 100) 
        : 0

      // Average Resolution Time (in days)
      const completedItems = [...concerns, ...pnpReports].filter((item: any) => 
        item.status === 'completed' && item.actionDate
      )
      
      let totalResolutionDays = 0
      completedItems.forEach((item: any) => {
        const reportedDate = new Date(item.dateReported)
        const actionDate = new Date(item.actionDate)
        const days = differenceInDays(actionDate, reportedDate)
        if (days >= 0) totalResolutionDays += days
      })
      
      const averageResolutionTime = completedItems.length > 0 
        ? Math.round(totalResolutionDays / completedItems.length) 
        : 0

      // Response Time Analytics
      const responseTimeAnalytics = {
        under24h: 0,
        under48h: 0,
        under7days: 0,
        over7days: 0
      }
      
      completedItems.forEach((item: any) => {
        const reportedDate = new Date(item.dateReported)
        const actionDate = new Date(item.actionDate)
        const days = differenceInDays(actionDate, reportedDate)
        
        if (days < 1) responseTimeAnalytics.under24h++
        else if (days < 2) responseTimeAnalytics.under48h++
        else if (days < 7) responseTimeAnalytics.under7days++
        else responseTimeAnalytics.over7days++
      })

      // Recent Activity (last 5 items)
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
        recentActivity,
        municipalityBreakdown,
        categoryDistribution,
        weeklyTrend,
        monthlyComparison: { currentMonth, lastMonth, percentageChange },
        averageResolutionTime,
        responseTimeAnalytics
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

      {/* Analytics Cards - Monthly Comparison & Resolution Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Monthly Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-l-4 border-l-indigo-500 hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    This Month
                  </p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <h3 className="text-4xl font-bold text-indigo-600">{stats.monthlyComparison.currentMonth}</h3>
                    <span className="text-sm text-muted-foreground">reports</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`text-xs font-medium ${
                      stats.monthlyComparison.percentageChange >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stats.monthlyComparison.percentageChange >= 0 ? '+' : ''}{stats.monthlyComparison.percentageChange}%
                    </span>
                    <span className="text-xs text-muted-foreground">vs last month</span>
                  </div>
                </div>
                <div className="p-3 bg-indigo-50 rounded-lg">
                  <HugeiconsIcon icon={Calendar03Icon} className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Average Resolution Time */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="border-l-4 border-l-teal-500 hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Avg Resolution
                  </p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <h3 className="text-4xl font-bold text-teal-600">{stats.averageResolutionTime}</h3>
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Average time to resolve concerns
                  </p>
                </div>
                <div className="p-3 bg-teal-50 rounded-lg">
                  <HugeiconsIcon icon={TimeQuarterPassIcon} className="w-6 h-6 text-teal-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Response Time Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="border-l-4 border-l-pink-500 hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Response Time
                  </p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <h3 className="text-4xl font-bold text-pink-600">
                      {stats.responseTimeAnalytics.under24h + stats.responseTimeAnalytics.under48h}
                    </h3>
                    <span className="text-sm text-muted-foreground">fast</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Resolved within 48 hours
                  </p>
                </div>
                <div className="p-3 bg-pink-50 rounded-lg">
                  <HugeiconsIcon icon={TimeQuarterPassIcon} className="w-6 h-6 text-pink-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Trend Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Weekly Trend</CardTitle>
              <CardDescription>Reports over the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.weeklyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} name="Completed" />
                  <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} name="Pending" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Response Time Breakdown Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Response Time Breakdown</CardTitle>
              <CardDescription>Resolution time distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={[
                  { name: '< 24h', count: stats.responseTimeAnalytics.under24h, fill: '#10b981' },
                  { name: '< 48h', count: stats.responseTimeAnalytics.under48h, fill: '#3b82f6' },
                  { name: '< 7 days', count: stats.responseTimeAnalytics.under7days, fill: '#f59e0b' },
                  { name: '> 7 days', count: stats.responseTimeAnalytics.over7days, fill: '#ef4444' },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" name="Reports">
                    {[
                      { name: '< 24h', count: stats.responseTimeAnalytics.under24h, fill: '#10b981' },
                      { name: '< 48h', count: stats.responseTimeAnalytics.under48h, fill: '#3b82f6' },
                      { name: '< 7 days', count: stats.responseTimeAnalytics.under7days, fill: '#f59e0b' },
                      { name: '> 7 days', count: stats.responseTimeAnalytics.over7days, fill: '#ef4444' },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Category Distribution Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Category Distribution</CardTitle>
              <CardDescription>Action Center reports by category</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.categoryDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stats.categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Municipalities Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Top 5 Municipalities</CardTitle>
              <CardDescription>Municipalities with most reports</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.municipalityBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" name="Total Reports" />
                </BarChart>
              </ResponsiveContainer>
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
