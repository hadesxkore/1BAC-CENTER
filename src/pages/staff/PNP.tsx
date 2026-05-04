import { useState, useEffect, useMemo, memo } from 'react'
import { motion } from 'framer-motion'
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Search01Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  MoreVerticalIcon,
} from '@hugeicons/core-free-icons'
import { format } from 'date-fns'
import { AddPNPReportDialog } from '@/components/AddPNPReportDialog'
import { ViewPNPReportDialog } from '@/components/ViewPNPReportDialog'
import { EditPNPReportDialog } from '@/components/EditPNPReportDialog'
import { DeletePNPReportDialog } from '@/components/DeletePNPReportDialog'
import { SubmitAfterPhotosDialog } from '@/components/SubmitAfterPhotosDialog'
import { db } from '@/config/firebase'
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore'
import { toast } from 'sonner'

type PNPStatus = 'pending' | 'completed'

interface PNPReport {
  id: string
  dateReported: string
  dateUploaded: string
  municipality: string
  reportTitle: string
  location: string
  remarks: string
  beforePhotos: { url: string; publicId: string }[]
  afterPhotos: {
    photos: { url: string; publicId: string }[]
    notes: string
    actionDate: string
    submittedBy: string
    submittedAt: string
  } | null
  status: PNPStatus
  reportedBy: string
  createdAt: string
  createdBy: string
}

const statusColors: Record<PNPStatus, string> = {
  pending: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
}

// Memoized lazy loading image component
const LazyImage = memo(({ src, alt, className }: { src: string; alt: string; className: string }) => {
  const [isLoaded, setIsLoaded] = useState(false)
  
  return (
    <div className={`${className} ${!isLoaded ? 'bg-muted animate-pulse' : ''}`}>
      <img
        src={src}
        alt={alt}
        className={`${className} ${!isLoaded ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  )
})

LazyImage.displayName = 'LazyImage'

export default function PNP() {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [reports, setReports] = useState<PNPReport[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Real-time listener for PNP reports
  useEffect(() => {
    setIsLoading(true)
    const q = query(collection(db, 'pnp_reports'), orderBy('createdAt', 'desc'))
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reportsData: PNPReport[] = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        reportsData.push({
          id: doc.id,
          dateReported: data.dateReported,
          dateUploaded: data.dateUploaded instanceof Timestamp 
            ? data.dateUploaded.toDate().toISOString()
            : new Date().toISOString(),
          municipality: data.municipality,
          reportTitle: data.reportTitle,
          location: data.location,
          remarks: data.remarks,
          beforePhotos: data.beforePhotos || [],
          afterPhotos: data.afterPhotos || [],
          status: data.status,
          reportedBy: data.reportedBy,
          createdAt: data.createdAt instanceof Timestamp 
            ? data.createdAt.toDate().toISOString()
            : new Date().toISOString(),
          createdBy: data.createdBy || '',
        })
      })
      setReports(reportsData)
      setIsLoading(false)
    }, (error) => {
      console.error('Error fetching PNP reports:', error)
      toast.error('Failed to load PNP reports')
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const columns: ColumnDef<PNPReport>[] = useMemo(() => [
    {
      accessorKey: 'dateUploaded',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-2"
          >
            Date Uploaded
            {column.getIsSorted() === 'asc' ? (
              <HugeiconsIcon icon={ArrowUp01Icon} className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <HugeiconsIcon icon={ArrowDown01Icon} className="ml-2 h-4 w-4" />
            ) : null}
          </Button>
        )
      },
      cell: ({ row }) => {
        const date = new Date(row.getValue('dateUploaded'))
        return <div className="text-xs">{format(date, 'MMM dd, yyyy')}</div>
      },
    },
    {
      accessorKey: 'dateReported',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-2"
          >
            Date Reported
            {column.getIsSorted() === 'asc' ? (
              <HugeiconsIcon icon={ArrowUp01Icon} className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <HugeiconsIcon icon={ArrowDown01Icon} className="ml-2 h-4 w-4" />
            ) : null}
          </Button>
        )
      },
      cell: ({ row }) => {
        const date = new Date(row.getValue('dateReported'))
        return <div className="text-xs">{format(date, 'MMM dd, yyyy')}</div>
      },
    },
    {
      accessorKey: 'municipality',
      header: 'Municipality',
      cell: ({ row }) => <div className="text-xs">{row.getValue('municipality')}</div>,
    },
    {
      accessorKey: 'reportTitle',
      header: 'Report Title',
      cell: ({ row }) => (
        <div className="max-w-[250px]">
          <div className="font-medium truncate">{row.getValue('reportTitle')}</div>
          <div className="text-xs text-muted-foreground line-clamp-2">
            {row.original.remarks}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'location',
      header: 'Location',
      cell: ({ row }) => (
        <div className="text-xs max-w-[200px] truncate">{row.getValue('location')}</div>
      ),
    },
    {
      accessorKey: 'beforePhotos',
      header: 'Before Photos',
      cell: ({ row }) => {
        const photos = row.original.beforePhotos
        if (photos.length === 0) {
          return <span className="text-xs text-muted-foreground">-</span>
        }
        return (
          <div className="flex gap-1">
            {photos.slice(0, 3).map((photo, index) => (
              <LazyImage
                key={index}
                src={photo.url}
                alt={`Before ${index + 1}`}
                className="w-10 h-10 object-cover rounded border"
              />
            ))}
            {photos.length > 3 && (
              <div className="w-10 h-10 bg-muted rounded border flex items-center justify-center text-xs">
                +{photos.length - 3}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'afterPhotos',
      header: 'After Photos',
      cell: ({ row }) => {
        const afterPhotos = row.original.afterPhotos
        if (!afterPhotos || !afterPhotos.photos || afterPhotos.photos.length === 0) {
          return (
            <SubmitAfterPhotosDialog
              reportId={row.original.id}
              reportTitle={row.original.reportTitle}
            />
          )
        }
        return (
          <div className="flex gap-1">
            {afterPhotos.photos.slice(0, 3).map((photo, index) => (
              <LazyImage
                key={index}
                src={photo.url}
                alt={`After ${index + 1}`}
                className="w-10 h-10 object-cover rounded border"
              />
            ))}
            {afterPhotos.photos.length > 3 && (
              <div className="w-10 h-10 bg-muted rounded border flex items-center justify-center text-xs">
                +{afterPhotos.photos.length - 3}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as PNPStatus
        return (
          <Badge variant="outline" className={statusColors[status]}>
            {status}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <ViewPNPReportDialog report={row.original} />
              <EditPNPReportDialog report={row.original} />
              <DeletePNPReportDialog reportId={row.original.id} reportTitle={row.original.reportTitle} />
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ], [])

  // Apply filters with useMemo
  const filteredData = useMemo(() => {
    return reports.filter((report) => {
      if (statusFilter !== 'all' && report.status !== statusFilter) return false
      return true
    })
  }, [reports, statusFilter])

  const table = useReactTable({
    data: filteredData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  })

  // Stats with useMemo
  const stats = useMemo(() => ({
    total: reports.length,
    pending: reports.filter((r) => r.status === 'pending').length,
    completed: reports.filter((r) => r.status === 'completed').length,
  }), [reports])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-3xl font-heading font-bold">PNP Reports</h2>
          <p className="text-muted-foreground mt-1">
            Monitor and manage PNP-related reports and actions
          </p>
        </div>
        <div className="shrink-0">
          <AddPNPReportDialog />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-blue-700">Total Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-blue-700">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-green-700">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Data Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-700">PNP Reports</CardTitle>
            <CardDescription>
              View and manage all PNP reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters and Search */}
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="flex-1 relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                />
                <Input
                  placeholder="Search reports..."
                  value={(table.getColumn('reportTitle')?.getFilterValue() as string) ?? ''}
                  onChange={(event) =>
                    table.getColumn('reportTitle')?.setFilterValue(event.target.value)
                  }
                  className="pl-9"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table with horizontal scroll */}
            <div className="w-full overflow-x-auto">
              <div className="rounded-md border min-w-max">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => {
                          return (
                            <TableHead key={header.id}>
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                            </TableHead>
                          )
                        })}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow
                          key={row.id}
                          data-state={row.getIsSelected() && 'selected'}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={columns.length}
                          className="h-24 text-center"
                        >
                          No results.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between space-x-2 py-4">
              <div className="text-sm text-muted-foreground">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} ({filteredData.length} total results)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
