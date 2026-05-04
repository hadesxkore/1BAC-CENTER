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
import type { Action, ActionStatus } from '@/data/sampleActions'
import { format } from 'date-fns'
import { AddConcernDialog } from '@/components/AddConcernDialog'
import { SubmitActionDialog } from '@/components/SubmitActionDialog'
import { ViewConcernDialog } from '@/components/ViewConcernDialog'
import { EditConcernDialog } from '@/components/EditConcernDialog'
import { DeleteConcernDialog } from '@/components/DeleteConcernDialog'
import { db } from '@/config/firebase'
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore'
import { toast } from 'sonner'

const statusColors: Record<ActionStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
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

export default function ActionCenter() {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [concerns, setConcerns] = useState<Action[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Real-time listener for concerns
  useEffect(() => {
    setIsLoading(true)
    const q = query(collection(db, 'concerns'), orderBy('createdAt', 'desc'))
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const concernsData: Action[] = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        concernsData.push({
          id: doc.id,
          dateReported: data.dateReported,
          dateUploaded: data.dateUploaded instanceof Timestamp 
            ? data.dateUploaded.toDate().toISOString()
            : new Date().toISOString(),
          municipality: data.municipality,
          category: data.category,
          assignedTo: data.assignedTo,
          reportTitle: data.reportTitle,
          caseRemarks: data.caseRemarks,
          location: data.location,
          concernPhotos: data.concernPhotos || [],
          answeredBy: data.answeredBy,
          actionTaken: data.actionTaken,
          actionDate: data.actionDate,
          status: data.status,
          reportedBy: data.reportedBy,
          createdAt: data.createdAt instanceof Timestamp 
            ? data.createdAt.toDate().toISOString()
            : new Date().toISOString(),
        })
      })
      setConcerns(concernsData)
      setIsLoading(false)
    }, (error) => {
      console.error('Error fetching concerns:', error)
      toast.error('Failed to load concerns')
      setIsLoading(false)
    })

    // Cleanup subscription on unmount
    return () => unsubscribe()
  }, []) // Empty dependency array - only run once

  const columns: ColumnDef<Action>[] = useMemo(() => [
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
            {row.original.caseRemarks}
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
      accessorKey: 'answeredBy',
      header: 'Answered By',
      cell: ({ row }) => <div className="text-xs">{row.getValue('answeredBy')}</div>,
    },
    {
      accessorKey: 'concernPhotos',
      header: 'Concern Photos',
      cell: ({ row }) => {
        const photos = row.original.concernPhotos
        return (
          <div className="flex gap-1">
            {photos.slice(0, 3).map((photo, index) => (
              <LazyImage
                key={index}
                src={photo.url}
                alt={`Concern ${index + 1}`}
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
      accessorKey: 'actionTaken',
      header: 'Action Taken',
      cell: ({ row }) => {
        const actionTaken = row.original.actionTaken
        if (!actionTaken) {
          return (
            <SubmitActionDialog
              concernId={row.original.id}
              concernTitle={row.original.reportTitle}
            />
          )
        }
        return (
          <div className="flex gap-1">
            {actionTaken.photos.slice(0, 2).map((photo, index) => (
              <LazyImage
                key={index}
                src={photo.url}
                alt={`Action ${index + 1}`}
                className="w-10 h-10 object-cover rounded border"
              />
            ))}
            {actionTaken.photos.length > 2 && (
              <div className="w-10 h-10 bg-muted rounded border flex items-center justify-center text-xs">
                +{actionTaken.photos.length - 2}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'actionDate',
      header: 'Action Date',
      cell: ({ row }) => {
        const date = row.getValue('actionDate')
        if (!date) return <span className="text-xs text-muted-foreground">-</span>
        return <div className="text-xs">{format(new Date(date as string), 'MMM dd, yyyy')}</div>
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as ActionStatus
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
              <ViewConcernDialog action={row.original} />
              <EditConcernDialog concern={row.original} />
              <DeleteConcernDialog concernId={row.original.id} concernTitle={row.original.reportTitle} />
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ], []) // Empty dependency - columns don't change

  // Apply filters with useMemo
  const filteredData = useMemo(() => {
    return concerns.filter((action) => {
      if (statusFilter !== 'all' && action.status !== statusFilter) return false
      return true
    })
  }, [concerns, statusFilter])

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
        pageSize: 10, // Show 10 rows per page
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
    total: concerns.length,
    pending: concerns.filter((a) => a.status === 'pending').length,
    completed: concerns.filter((a) => a.status === 'completed').length,
  }), [concerns])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-3xl font-heading font-bold">Action Center</h2>
          <p className="text-muted-foreground mt-1">
            Monitor and manage all action items and concerns
          </p>
        </div>
        <div className="shrink-0">
          <AddConcernDialog />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Concerns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Data Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card>
          <CardHeader>
            <CardTitle>Concern Reports</CardTitle>
            <CardDescription>
              View and manage all reported concerns
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
