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
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Search01Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  MoreVerticalIcon,
  FilterIcon,
  Download01Icon,
  SecurityIcon,
  Building03Icon,
} from '@hugeicons/core-free-icons'
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import { BATAAN_MUNICIPALITIES } from '@/data/municipalities'

// General PNP imports
import { AddPNPReportDialog } from '@/components/AddPNPReportDialog'
import { ViewPNPReportDialog } from '@/components/ViewPNPReportDialog'
import { EditPNPReportDialog } from '@/components/EditPNPReportDialog'
import { DeletePNPReportDialog } from '@/components/DeletePNPReportDialog'
import { SubmitAfterPhotosDialog } from '@/components/SubmitAfterPhotosDialog'

// Building Permit imports
import { AddBuildingPermitDialog } from '@/components/AddBuildingPermitDialog'
import { ViewBuildingPermitDialog } from '@/components/ViewBuildingPermitDialog'
import { EditBuildingPermitDialog } from '@/components/EditBuildingPermitDialog'
import { DeleteBuildingPermitDialog } from '@/components/DeleteBuildingPermitDialog'
import { SubmitBuildingPermitAfterPhotosDialog } from '@/components/SubmitBuildingPermitAfterPhotosDialog'
import { generateBuildingPermitSummaryPDF } from '@/utils/generateBuildingPermitSummaryPDF'

import { db } from '@/config/firebase'
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore'
import { toast } from '@/components/ui/sonner'
import jsPDF from 'jspdf'

type PNPStatus = 'pending' | 'for-validation' | 'completed'

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

interface BuildingPermitReport {
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
  'for-validation': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
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
  const [activeTab, setActiveTab] = useState<'pnp' | 'building-permit'>('pnp')

  // PNP Reports State
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [municipalityFilter, setMunicipalityFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [advancedSearch, setAdvancedSearch] = useState({
    location: '',
    reportedBy: ''
  })
  const [reports, setReports] = useState<PNPReport[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Building Permit State
  const [bpSorting, setBpSorting] = useState<SortingState>([])
  const [bpColumnFilters, setBpColumnFilters] = useState<ColumnFiltersState>([])
  const [bpColumnVisibility, setBpColumnVisibility] = useState<VisibilityState>({})
  const [bpStatusFilter, setBpStatusFilter] = useState<string>('all')
  const [bpMunicipalityFilter, setBpMunicipalityFilter] = useState<string>('all')
  const [bpDateFrom, setBpDateFrom] = useState<Date | undefined>(undefined)
  const [bpDateTo, setBpDateTo] = useState<Date | undefined>(undefined)
  const [bpAdvancedSearch, setBpAdvancedSearch] = useState({
    location: '',
    reportedBy: ''
  })
  const [buildingPermits, setBuildingPermits] = useState<BuildingPermitReport[]>([])
  const [isBpLoading, setIsBpLoading] = useState(true)

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
          afterPhotos: data.afterPhotos || null,
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

  // Real-time listener for Building Permit reports
  useEffect(() => {
    setIsBpLoading(true)
    const q = query(collection(db, 'building_permit_reports'), orderBy('createdAt', 'desc'))
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bpData: BuildingPermitReport[] = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        bpData.push({
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
          afterPhotos: data.afterPhotos || null,
          status: data.status,
          reportedBy: data.reportedBy,
          createdAt: data.createdAt instanceof Timestamp 
            ? data.createdAt.toDate().toISOString()
            : new Date().toISOString(),
          createdBy: data.createdBy || '',
        })
      })
      setBuildingPermits(bpData)
      setIsBpLoading(false)
    }, (error) => {
      console.error('Error fetching Building Permit reports:', error)
      toast.error('Failed to load Building Permit reports')
      setIsBpLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Columns for PNP Reports
  const pnpColumns: ColumnDef<PNPReport>[] = useMemo(() => [
    {
      accessorKey: 'dateUploaded',
      header: ({ column }) => (
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
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue('dateUploaded'))
        return <div className="text-xs">{format(date, 'MMM dd, yyyy')}</div>
      },
    },
    {
      accessorKey: 'dateReported',
      header: ({ column }) => (
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
      ),
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
        if (!photos || photos.length === 0) return <span className="text-xs text-muted-foreground">-</span>
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
        const status = row.original.status

        if (status === 'for-validation' && afterPhotos && afterPhotos.photos && afterPhotos.photos.length > 0) {
          return (
            <div className="flex flex-col gap-1">
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
              <SubmitAfterPhotosDialog
                reportId={row.original.id}
                reportTitle={row.original.reportTitle}
                currentStatus={status}
              />
            </div>
          )
        }

        if (!afterPhotos || !afterPhotos.photos || afterPhotos.photos.length === 0) {
          return (
            <SubmitAfterPhotosDialog
              reportId={row.original.id}
              reportTitle={row.original.reportTitle}
              currentStatus={status}
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
      cell: ({ row }) => (
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
      ),
    },
  ], [])

  // Columns for Building Permits
  const bpColumns: ColumnDef<BuildingPermitReport>[] = useMemo(() => [
    {
      accessorKey: 'dateUploaded',
      header: ({ column }) => (
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
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue('dateUploaded'))
        return <div className="text-xs">{format(date, 'MMM dd, yyyy')}</div>
      },
    },
    {
      accessorKey: 'dateReported',
      header: ({ column }) => (
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
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue('dateReported'))
        return <div className="text-xs">{format(date, 'MMM dd, yyyy')}</div>
      },
    },
    {
      accessorKey: 'municipality',
      header: 'Municipality',
      cell: ({ row }) => <div className="text-xs font-medium">{row.getValue('municipality')}</div>,
    },
    {
      accessorKey: 'reportTitle',
      header: 'Permit / Report Title',
      cell: ({ row }) => (
        <div className="max-w-[250px]">
          <div className="font-semibold text-sm truncate">{row.getValue('reportTitle')}</div>
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
        <div className="text-xs max-w-[200px] truncate">{row.getValue('location') || 'N/A'}</div>
      ),
    },
    {
      accessorKey: 'beforePhotos',
      header: 'Before Photos',
      cell: ({ row }) => {
        const photos = row.original.beforePhotos
        if (!photos || photos.length === 0) return <span className="text-xs text-muted-foreground">-</span>
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
        const status = row.original.status

        if (status === 'for-validation' && afterPhotos && afterPhotos.photos && afterPhotos.photos.length > 0) {
          return (
            <div className="flex flex-col gap-1">
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
              <SubmitBuildingPermitAfterPhotosDialog
                reportId={row.original.id}
                reportTitle={row.original.reportTitle}
                currentStatus={status}
              />
            </div>
          )
        }

        if (!afterPhotos || !afterPhotos.photos || afterPhotos.photos.length === 0) {
          return (
            <SubmitBuildingPermitAfterPhotosDialog
              reportId={row.original.id}
              reportTitle={row.original.reportTitle}
              currentStatus={status}
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
            {status.toUpperCase()}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <ViewBuildingPermitDialog report={row.original} />
            <EditBuildingPermitDialog report={row.original} />
            <DeleteBuildingPermitDialog reportId={row.original.id} reportTitle={row.original.reportTitle} />
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [])

  // Filtered data for PNP
  const filteredPNPData = useMemo(() => {
    return reports.filter((report) => {
      if (statusFilter !== 'all' && report.status !== statusFilter) return false
      if (municipalityFilter !== 'all' && report.municipality !== municipalityFilter) return false
      if (dateFrom || dateTo) {
        const reportDate = new Date(report.dateReported)
        if (dateFrom && dateTo) {
          if (!isWithinInterval(reportDate, { start: startOfDay(dateFrom), end: endOfDay(dateTo) })) return false
        } else if (dateFrom) {
          if (reportDate < startOfDay(dateFrom)) return false
        } else if (dateTo) {
          if (reportDate > endOfDay(dateTo)) return false
        }
      }
      if (advancedSearch.location && !report.location.toLowerCase().includes(advancedSearch.location.toLowerCase())) {
        return false
      }
      if (advancedSearch.reportedBy && !report.reportedBy.toLowerCase().includes(advancedSearch.reportedBy.toLowerCase())) {
        return false
      }
      return true
    })
  }, [reports, statusFilter, municipalityFilter, dateFrom, dateTo, advancedSearch])

  // Filtered data for Building Permit
  const filteredBpData = useMemo(() => {
    return buildingPermits.filter((permit) => {
      if (bpStatusFilter !== 'all' && permit.status !== bpStatusFilter) return false
      if (bpMunicipalityFilter !== 'all' && permit.municipality !== bpMunicipalityFilter) return false
      if (bpDateFrom || bpDateTo) {
        const permitDate = new Date(permit.dateReported)
        if (bpDateFrom && bpDateTo) {
          if (!isWithinInterval(permitDate, { start: startOfDay(bpDateFrom), end: endOfDay(bpDateTo) })) return false
        } else if (bpDateFrom) {
          if (permitDate < startOfDay(bpDateFrom)) return false
        } else if (bpDateTo) {
          if (permitDate > endOfDay(bpDateTo)) return false
        }
      }
      if (bpAdvancedSearch.location && !permit.location.toLowerCase().includes(bpAdvancedSearch.location.toLowerCase())) {
        return false
      }
      if (bpAdvancedSearch.reportedBy && !permit.reportedBy.toLowerCase().includes(bpAdvancedSearch.reportedBy.toLowerCase())) {
        return false
      }
      return true
    })
  }, [buildingPermits, bpStatusFilter, bpMunicipalityFilter, bpDateFrom, bpDateTo, bpAdvancedSearch])

  // Table instance for PNP Reports
  const pnpTable = useReactTable({
    data: filteredPNPData,
    columns: pnpColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    initialState: { pagination: { pageSize: 10 } },
    state: { sorting, columnFilters, columnVisibility },
  })

  // Table instance for Building Permits
  const bpTable = useReactTable({
    data: filteredBpData,
    columns: bpColumns,
    onSortingChange: setBpSorting,
    onColumnFiltersChange: setBpColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setBpColumnVisibility,
    initialState: { pagination: { pageSize: 10 } },
    state: { sorting: bpSorting, columnFilters: bpColumnFilters, columnVisibility: bpColumnVisibility },
  })

  // Stats for PNP
  const pnpStats = useMemo(() => ({
    total: reports.length,
    pending: reports.filter((r) => r.status === 'pending').length,
    forValidation: reports.filter((r) => r.status === 'for-validation').length,
    completed: reports.filter((r) => r.status === 'completed').length,
  }), [reports])

  // Stats for Building Permits
  const bpStats = useMemo(() => ({
    total: buildingPermits.length,
    pending: buildingPermits.filter((r) => r.status === 'pending').length,
    forValidation: buildingPermits.filter((r) => r.status === 'for-validation').length,
    completed: buildingPermits.filter((r) => r.status === 'completed').length,
  }), [buildingPermits])

  // Export PDF for PNP
  const exportPNPPDF = async () => {
    if (filteredPNPData.length === 0) {
      toast.error('No data to export')
      return
    }
    toast.info('Generating PNP PDF report...')
    const doc = new jsPDF('p', 'mm', 'a4')
    doc.setFontSize(16)
    doc.text('PNP Reports Summary', 14, 20)
    doc.save(`pnp-reports-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
    toast.success('PDF downloaded!')
  }

  // Export PDF for Building Permit
  const exportBpPDF = async () => {
    if (filteredBpData.length === 0) {
      toast.error('No Building Permit data to export')
      return
    }
    toast.info('Generating Building Permit PDF summary...')
    const period = bpDateFrom && bpDateTo
      ? `${format(bpDateFrom, 'MMM dd, yyyy')} - ${format(bpDateTo, 'MMM dd, yyyy')}`
      : 'All Time'
    await generateBuildingPermitSummaryPDF(filteredBpData, period)
    toast.success('Building Permit PDF exported successfully!')
  }

  const clearPNPFilters = () => {
    setStatusFilter('all')
    setMunicipalityFilter('all')
    setDateFrom(undefined)
    setDateTo(undefined)
    setAdvancedSearch({ location: '', reportedBy: '' })
    pnpTable.getColumn('reportTitle')?.setFilterValue('')
    toast.success('All filters cleared')
  }

  const clearBpFilters = () => {
    setBpStatusFilter('all')
    setBpMunicipalityFilter('all')
    setBpDateFrom(undefined)
    setBpDateTo(undefined)
    setBpAdvancedSearch({ location: '', reportedBy: '' })
    bpTable.getColumn('reportTitle')?.setFilterValue('')
    toast.success('Building permit filters cleared')
  }

  if (isLoading && isBpLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub-button Nav */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-3xl font-heading font-bold">PNP & Building Permits</h2>
          <p className="text-muted-foreground mt-1">
            Monitor and manage PNP reports and Building Permit compliance reports
          </p>
        </div>

        {/* Sub-button Navigation Switcher */}
        <div className="flex items-center gap-2 bg-muted/60 p-1.5 rounded-xl border">
          <Button
            variant={activeTab === 'pnp' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('pnp')}
            className={`gap-2 rounded-lg font-medium transition-all ${
              activeTab === 'pnp' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted'
            }`}
          >
            <HugeiconsIcon icon={SecurityIcon} className="w-4 h-4" />
            PNP Reports
            {pnpStats.total > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0.2">
                {pnpStats.total}
              </Badge>
            )}
          </Button>

          <Button
            variant={activeTab === 'building-permit' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('building-permit')}
            className={`gap-2 rounded-lg font-medium transition-all ${
              activeTab === 'building-permit' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted'
            }`}
          >
            <HugeiconsIcon icon={Building03Icon} className="w-4 h-4" />
            Building Permit
            {bpStats.total > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0.2">
                {bpStats.total}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* VIEW 1: PNP REPORTS */}
      {activeTab === 'pnp' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-blue-700">Total Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{pnpStats.total}</div>
              </CardContent>
            </Card>

            <Card className="border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-blue-700">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{pnpStats.pending}</div>
              </CardContent>
            </Card>

            <Card className="border-orange-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-orange-700">For Validation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{pnpStats.forValidation}</div>
              </CardContent>
            </Card>

            <Card className="border-green-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-green-700">Completed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{pnpStats.completed}</div>
              </CardContent>
            </Card>
          </div>

          {/* Data Table */}
          <Card className="border-blue-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-blue-700">PNP Reports</CardTitle>
                  <CardDescription>View and manage all PNP reports</CardDescription>
                </div>
                <AddPNPReportDialog />
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="space-y-4 mb-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <HugeiconsIcon
                      icon={Search01Icon}
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                    />
                    <Input
                      placeholder="Search report title..."
                      value={(pnpTable.getColumn('reportTitle')?.getFilterValue() as string) ?? ''}
                      onChange={(e) => pnpTable.getColumn('reportTitle')?.setFilterValue(e.target.value)}
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
                      <SelectItem value="for-validation">For Validation</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={municipalityFilter} onValueChange={setMunicipalityFilter}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="Municipality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Municipalities</SelectItem>
                      {BATAAN_MUNICIPALITIES.map((muni) => (
                        <SelectItem key={muni} value={muni}>
                          {muni}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Collapsible>
                  <div className="flex items-center justify-between">
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm">
                        <HugeiconsIcon icon={FilterIcon} className="w-4 h-4 mr-2" />
                        Advanced Filters
                      </Button>
                    </CollapsibleTrigger>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={clearPNPFilters}>
                        Clear All
                      </Button>
                      <Button variant="outline" size="sm" onClick={exportPNPPDF}>
                        <HugeiconsIcon icon={Download01Icon} className="w-4 h-4 mr-2" />
                        Export ({filteredPNPData.length})
                      </Button>
                    </div>
                  </div>
                  
                  <CollapsibleContent className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date From</Label>
                        <DatePicker date={dateFrom} onDateChange={setDateFrom} placeholder="Select start date" />
                      </div>
                      <div className="space-y-2">
                        <Label>Date To</Label>
                        <DatePicker date={dateTo} onDateChange={setDateTo} placeholder="Select end date" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Location</Label>
                        <Input
                          placeholder="Search location..."
                          value={advancedSearch.location}
                          onChange={(e) => setAdvancedSearch({ ...advancedSearch, location: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Reported By</Label>
                        <Input
                          placeholder="Search reported by..."
                          value={advancedSearch.reportedBy}
                          onChange={(e) => setAdvancedSearch({ ...advancedSearch, reportedBy: e.target.value })}
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Table */}
              <div className="w-full overflow-x-auto">
                <div className="rounded-md border min-w-max">
                  <Table>
                    <TableHeader>
                      {pnpTable.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <TableHead key={header.id}>
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {pnpTable.getRowModel().rows?.length ? (
                        pnpTable.getRowModel().rows.map((row) => (
                          <TableRow key={row.id}>
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={pnpColumns.length} className="h-24 text-center">
                            No PNP reports found.
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
                  Page {pnpTable.getState().pagination.pageIndex + 1} of {pnpTable.getPageCount() || 1} ({filteredPNPData.length} total results)
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pnpTable.previousPage()}
                    disabled={!pnpTable.getCanPreviousPage()}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pnpTable.nextPage()}
                    disabled={!pnpTable.getCanNextPage()}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* VIEW 2: BUILDING PERMIT */}
      {activeTab === 'building-permit' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-indigo-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-indigo-700">Total Building Permits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-600">{bpStats.total}</div>
              </CardContent>
            </Card>

            <Card className="border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-blue-700">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{bpStats.pending}</div>
              </CardContent>
            </Card>

            <Card className="border-orange-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-orange-700">For Validation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{bpStats.forValidation}</div>
              </CardContent>
            </Card>

            <Card className="border-green-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-green-700">Completed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{bpStats.completed}</div>
              </CardContent>
            </Card>
          </div>

          {/* Data Table */}
          <Card className="border-indigo-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-indigo-700 flex items-center gap-2">
                    <HugeiconsIcon icon={Building03Icon} className="w-5 h-5 text-indigo-600" />
                    Building Permit Reports
                  </CardTitle>
                  <CardDescription>
                    Track, input, and verify building permits and compliance photos
                  </CardDescription>
                </div>
                <AddBuildingPermitDialog />
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="space-y-4 mb-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <HugeiconsIcon
                      icon={Search01Icon}
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                    />
                    <Input
                      placeholder="Search permit title..."
                      value={(bpTable.getColumn('reportTitle')?.getFilterValue() as string) ?? ''}
                      onChange={(e) => bpTable.getColumn('reportTitle')?.setFilterValue(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <Select value={bpStatusFilter} onValueChange={setBpStatusFilter}>
                    <SelectTrigger className="w-full md:w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="for-validation">For Validation</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={bpMunicipalityFilter} onValueChange={setBpMunicipalityFilter}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="Municipality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Municipalities</SelectItem>
                      {BATAAN_MUNICIPALITIES.map((muni) => (
                        <SelectItem key={muni} value={muni}>
                          {muni}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Collapsible>
                  <div className="flex items-center justify-between">
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm">
                        <HugeiconsIcon icon={FilterIcon} className="w-4 h-4 mr-2" />
                        Advanced Filters
                      </Button>
                    </CollapsibleTrigger>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={clearBpFilters}>
                        Clear All
                      </Button>
                      <Button variant="outline" size="sm" onClick={exportBpPDF}>
                        <HugeiconsIcon icon={Download01Icon} className="w-4 h-4 mr-2" />
                        Export PDF ({filteredBpData.length})
                      </Button>
                    </div>
                  </div>
                  
                  <CollapsibleContent className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date From</Label>
                        <DatePicker date={bpDateFrom} onDateChange={setBpDateFrom} placeholder="Select start date" />
                      </div>
                      <div className="space-y-2">
                        <Label>Date To</Label>
                        <DatePicker date={bpDateTo} onDateChange={setBpDateTo} placeholder="Select end date" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Location / Address</Label>
                        <Input
                          placeholder="Search location..."
                          value={bpAdvancedSearch.location}
                          onChange={(e) => setBpAdvancedSearch({ ...bpAdvancedSearch, location: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Reported By</Label>
                        <Input
                          placeholder="Search reported by..."
                          value={bpAdvancedSearch.reportedBy}
                          onChange={(e) => setBpAdvancedSearch({ ...bpAdvancedSearch, reportedBy: e.target.value })}
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Table */}
              <div className="w-full overflow-x-auto">
                <div className="rounded-md border min-w-max">
                  <Table>
                    <TableHeader>
                      {bpTable.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <TableHead key={header.id}>
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {bpTable.getRowModel().rows?.length ? (
                        bpTable.getRowModel().rows.map((row) => (
                          <TableRow key={row.id}>
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={bpColumns.length} className="h-24 text-center">
                            No Building Permit reports found.
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
                  Page {bpTable.getState().pagination.pageIndex + 1} of {bpTable.getPageCount() || 1} ({filteredBpData.length} total results)
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => bpTable.previousPage()}
                    disabled={!bpTable.getCanPreviousPage()}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => bpTable.nextPage()}
                    disabled={!bpTable.getCanNextPage()}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
