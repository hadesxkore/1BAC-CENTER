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
} from '@hugeicons/core-free-icons'
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import { BATAAN_MUNICIPALITIES } from '@/data/municipalities'
import { AddPNPReportDialog } from '@/components/AddPNPReportDialog'
import { ViewPNPReportDialog } from '@/components/ViewPNPReportDialog'
import { EditPNPReportDialog } from '@/components/EditPNPReportDialog'
import { DeletePNPReportDialog } from '@/components/DeletePNPReportDialog'
import { SubmitAfterPhotosDialog } from '@/components/SubmitAfterPhotosDialog'
import { db } from '@/config/firebase'
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore'
import { toast } from '@/components/ui/sonner'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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
        const status = row.original.status
        
        // If status is for-validation, show Validate button
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
        
        // If no after photos, show Submit button
        if (!afterPhotos || !afterPhotos.photos || afterPhotos.photos.length === 0) {
          return (
            <SubmitAfterPhotosDialog
              reportId={row.original.id}
              reportTitle={row.original.reportTitle}
              currentStatus={status}
            />
          )
        }
        
        // Otherwise show the photos
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
      // Status filter
      if (statusFilter !== 'all' && report.status !== statusFilter) return false
      
      // Municipality filter
      if (municipalityFilter !== 'all' && report.municipality !== municipalityFilter) return false
      
      // Date range filter
      if (dateFrom || dateTo) {
        const reportDate = new Date(report.dateReported)
        if (dateFrom && dateTo) {
          if (!isWithinInterval(reportDate, { 
            start: startOfDay(dateFrom), 
            end: endOfDay(dateTo) 
          })) return false
        } else if (dateFrom) {
          if (reportDate < startOfDay(dateFrom)) return false
        } else if (dateTo) {
          if (reportDate > endOfDay(dateTo)) return false
        }
      }
      
      // Advanced search filters
      if (advancedSearch.location && !report.location.toLowerCase().includes(advancedSearch.location.toLowerCase())) {
        return false
      }
      if (advancedSearch.reportedBy && !report.reportedBy.toLowerCase().includes(advancedSearch.reportedBy.toLowerCase())) {
        return false
      }
      
      return true
    })
  }, [reports, statusFilter, municipalityFilter, dateFrom, dateTo, advancedSearch])

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
    forValidation: reports.filter((r) => r.status === 'for-validation').length,
    completed: reports.filter((r) => r.status === 'completed').length,
  }), [reports])

  // Export filtered data as PDF with full details
  const exportFilteredPDF = async () => {
    if (filteredData.length === 0) {
      toast.error('No data to export')
      return
    }

    toast.info('Generating PDF... This may take a moment.')

    const doc = new jsPDF('p', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 14
    let yPosition = 20

    // Header
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('PNP Reports - Detailed Report', margin, yPosition)
    
    yPosition += 8
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, margin, yPosition)
    doc.text(`Total Records: ${filteredData.length}`, pageWidth - margin - 30, yPosition)
    
    yPosition += 10
    doc.setTextColor(0, 0, 0)

    // Process each report
    for (let i = 0; i < filteredData.length; i++) {
      const item = filteredData[i]
      
      // Check if we need a new page
      if (yPosition > pageHeight - 60) {
        doc.addPage()
        yPosition = 20
      }

      // Report box
      doc.setDrawColor(200, 200, 200)
      doc.setFillColor(239, 246, 255)
      doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 10, 2, 2, 'FD')
      
      // Report number and status
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(`PNP Report #${i + 1}`, margin + 3, yPosition + 6)
      
      // Status badge
      const statusX = pageWidth - margin - 25
      if (item.status === 'completed') {
        doc.setFillColor(220, 252, 231)
        doc.setTextColor(22, 163, 74)
      } else if (item.status === 'for-validation') {
        doc.setFillColor(255, 237, 213)
        doc.setTextColor(234, 88, 12)
      } else {
        doc.setFillColor(219, 234, 254)
        doc.setTextColor(29, 78, 216)
      }
      doc.roundedRect(statusX, yPosition + 2, 22, 6, 1, 1, 'F')
      doc.setFontSize(8)
      const statusLabel = item.status === 'for-validation' ? 'For Validation' : item.status.charAt(0).toUpperCase() + item.status.slice(1)
      doc.text(statusLabel.toUpperCase(), statusX + 11, yPosition + 6, { align: 'center' })
      
      yPosition += 15
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')

      // Details in two columns
      doc.setFontSize(9)
      const col1X = margin + 3
      const col2X = pageWidth / 2 + 5
      const lineHeight = 5

      // Column 1
      doc.setFont('helvetica', 'bold')
      doc.text('Date Reported:', col1X, yPosition)
      doc.setFont('helvetica', 'normal')
      doc.text(format(new Date(item.dateReported), 'MMM dd, yyyy'), col1X + 30, yPosition)
      
      yPosition += lineHeight
      doc.setFont('helvetica', 'bold')
      doc.text('Date Uploaded:', col1X, yPosition)
      doc.setFont('helvetica', 'normal')
      doc.text(format(new Date(item.dateUploaded), 'MMM dd, yyyy'), col1X + 30, yPosition)
      
      yPosition += lineHeight
      doc.setFont('helvetica', 'bold')
      doc.text('Municipality:', col1X, yPosition)
      doc.setFont('helvetica', 'normal')
      doc.text(item.municipality, col1X + 30, yPosition)

      // Column 2
      yPosition -= lineHeight * 2
      doc.setFont('helvetica', 'bold')
      doc.text('Reported By:', col2X, yPosition)
      doc.setFont('helvetica', 'normal')
      doc.text(item.reportedBy, col2X + 30, yPosition)
      
      yPosition += lineHeight
      doc.setFont('helvetica', 'bold')
      doc.text('Action Date:', col2X, yPosition)
      doc.setFont('helvetica', 'normal')
      const actionDate = item.afterPhotos?.actionDate 
        ? format(new Date(item.afterPhotos.actionDate), 'MMM dd, yyyy') 
        : 'N/A'
      doc.text(actionDate, col2X + 30, yPosition)

      yPosition += lineHeight * 2

      // Report Title
      doc.setFont('helvetica', 'bold')
      doc.text('Report Title:', col1X, yPosition)
      yPosition += 4
      doc.setFont('helvetica', 'normal')
      const titleLines = doc.splitTextToSize(item.reportTitle, pageWidth - 2 * margin - 6)
      doc.text(titleLines, col1X, yPosition)
      yPosition += titleLines.length * 4

      // Location
      doc.setFont('helvetica', 'bold')
      doc.text('Location:', col1X, yPosition)
      yPosition += 4
      doc.setFont('helvetica', 'normal')
      const locationLines = doc.splitTextToSize(item.location, pageWidth - 2 * margin - 6)
      doc.text(locationLines, col1X, yPosition)
      yPosition += locationLines.length * 4

      // Remarks
      if (item.remarks) {
        doc.setFont('helvetica', 'bold')
        doc.text('Remarks:', col1X, yPosition)
        yPosition += 4
        doc.setFont('helvetica', 'normal')
        const remarksLines = doc.splitTextToSize(item.remarks, pageWidth - 2 * margin - 6)
        doc.text(remarksLines, col1X, yPosition)
        yPosition += remarksLines.length * 4
      }

      // Images section
      yPosition += 3

      // Before Photos
      if (item.beforePhotos && item.beforePhotos.length > 0) {
        // Check if we need a new page for images
        if (yPosition > pageHeight - 50) {
          doc.addPage()
          yPosition = 20
        }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(`Before Photos (${item.beforePhotos.length}):`, col1X, yPosition)
        yPosition += 5

        try {
          const imgWidth = 35
          const imgHeight = 35
          const imgsPerRow = 4
          const imgSpacing = 3

          for (let j = 0; j < Math.min(item.beforePhotos.length, 4); j++) {
            const xPos = col1X + (j % imgsPerRow) * (imgWidth + imgSpacing)
            const yPos = yPosition + Math.floor(j / imgsPerRow) * (imgHeight + imgSpacing)

            // Check if we need a new page
            if (yPos + imgHeight > pageHeight - margin) {
              doc.addPage()
              yPosition = 20
            }

            try {
              doc.addImage(item.beforePhotos[j].url, 'JPEG', xPos, yPos, imgWidth, imgHeight)
            } catch (err) {
              // If image fails, draw a placeholder
              doc.setDrawColor(200, 200, 200)
              doc.rect(xPos, yPos, imgWidth, imgHeight)
              doc.setFontSize(7)
              doc.text('Image', xPos + imgWidth / 2, yPos + imgHeight / 2, { align: 'center' })
            }
          }
          yPosition += Math.ceil(Math.min(item.beforePhotos.length, 4) / imgsPerRow) * (imgHeight + imgSpacing) + 5
        } catch (error) {
          console.error('Error adding before photos:', error)
          yPosition += 5
        }
      }

      // After Photos
      if (item.afterPhotos && item.afterPhotos.photos && item.afterPhotos.photos.length > 0) {
        // Check if we need a new page for images
        if (yPosition > pageHeight - 50) {
          doc.addPage()
          yPosition = 20
        }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(`After Photos (${item.afterPhotos.photos.length}):`, col1X, yPosition)
        yPosition += 5

        try {
          const imgWidth = 35
          const imgHeight = 35
          const imgsPerRow = 4
          const imgSpacing = 3

          for (let j = 0; j < Math.min(item.afterPhotos.photos.length, 4); j++) {
            const xPos = col1X + (j % imgsPerRow) * (imgWidth + imgSpacing)
            const yPos = yPosition + Math.floor(j / imgsPerRow) * (imgHeight + imgSpacing)

            // Check if we need a new page
            if (yPos + imgHeight > pageHeight - margin) {
              doc.addPage()
              yPosition = 20
            }

            try {
              doc.addImage(item.afterPhotos.photos[j].url, 'JPEG', xPos, yPos, imgWidth, imgHeight)
            } catch (err) {
              // If image fails, draw a placeholder
              doc.setDrawColor(200, 200, 200)
              doc.rect(xPos, yPos, imgWidth, imgHeight)
              doc.setFontSize(7)
              doc.text('Image', xPos + imgWidth / 2, yPos + imgHeight / 2, { align: 'center' })
            }
          }
          yPosition += Math.ceil(Math.min(item.afterPhotos.photos.length, 4) / imgsPerRow) * (imgHeight + imgSpacing) + 5
        } catch (error) {
          console.error('Error adding after photos:', error)
          yPosition += 5
        }

        // After photos notes
        if (item.afterPhotos.notes) {
          doc.setFont('helvetica', 'bold')
          doc.text('Action Notes:', col1X, yPosition)
          yPosition += 4
          doc.setFont('helvetica', 'normal')
          const notesLines = doc.splitTextToSize(item.afterPhotos.notes, pageWidth - 2 * margin - 6)
          doc.text(notesLines, col1X, yPosition)
          yPosition += notesLines.length * 4
        }
      }

      yPosition += 8
    }

    doc.save(`pnp-reports-detailed-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
    toast.success('PDF exported successfully!')
  }

  // Clear all filters
  const clearFilters = () => {
    setStatusFilter('all')
    setMunicipalityFilter('all')
    setDateFrom(undefined)
    setDateTo(undefined)
    setAdvancedSearch({ location: '', reportedBy: '' })
    table.getColumn('reportTitle')?.setFilterValue('')
    toast.success('All filters cleared')
  }

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
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <Card className="border-orange-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-orange-700">For Validation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.forValidation}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="border-green-200">
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
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card className="border-blue-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-blue-700">PNP Reports</CardTitle>
                <CardDescription>
                  View and manage all PNP reports
                </CardDescription>
              </div>
              <AddPNPReportDialog />
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters and Search */}
            <div className="space-y-4 mb-4">
              {/* Primary Filters Row */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <HugeiconsIcon
                    icon={Search01Icon}
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                  />
                  <Input
                    placeholder="Search report title..."
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

              {/* Advanced Filters - Collapsible */}
              <Collapsible>
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm">
                      <HugeiconsIcon icon={FilterIcon} className="w-4 h-4 mr-2" />
                      Advanced Filters
                    </Button>
                  </CollapsibleTrigger>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear All
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportFilteredPDF}>
                      <HugeiconsIcon icon={Download01Icon} className="w-4 h-4 mr-2" />
                      Export ({filteredData.length})
                    </Button>
                  </div>
                </div>
                
                <CollapsibleContent className="mt-4 space-y-4">
                  {/* Date Range */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date From</Label>
                      <DatePicker
                        date={dateFrom}
                        onDateChange={setDateFrom}
                        placeholder="Select start date"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date To</Label>
                      <DatePicker
                        date={dateTo}
                        onDateChange={setDateTo}
                        placeholder="Select end date"
                      />
                    </div>
                  </div>

                  {/* Advanced Search Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input
                        placeholder="Search by location..."
                        value={advancedSearch.location}
                        onChange={(e) => setAdvancedSearch({ ...advancedSearch, location: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Reported By</Label>
                      <Input
                        placeholder="Search by reported by..."
                        value={advancedSearch.reportedBy}
                        onChange={(e) => setAdvancedSearch({ ...advancedSearch, reportedBy: e.target.value })}
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
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
