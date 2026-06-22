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
import type { Action, ActionStatus } from '@/data/sampleActions'
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import { BATAAN_MUNICIPALITIES } from '@/data/municipalities'
import { AddConcernDialog } from '@/components/AddConcernDialog'
import { SubmitActionDialog } from '@/components/SubmitActionDialog'
import { ViewConcernDialog } from '@/components/ViewConcernDialog'
import { EditConcernDialog } from '@/components/EditConcernDialog'
import { DeleteConcernDialog } from '@/components/DeleteConcernDialog'
import { MarkAsCompletedDialog } from '@/components/MarkAsCompletedDialog'
import { UpdateStatusDialog } from '@/components/UpdateStatusDialog'
import ImageCarouselDialog from '@/components/ImageCarouselDialog'
import { db } from '@/config/firebase'
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore'
import { toast } from '@/components/ui/sonner'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const STATUS_LABELS: Record<string, string> = {
  'under-action': 'Under Action',
  'in-progress': 'Under Action',
  resolved: 'Resolved',
  closed: 'Closed',
  completed: 'Completed',
  pending: 'Pending',
  unlocated: 'Unlocated',
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 cursor-pointer hover:opacity-80',
  'in-progress': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300 cursor-pointer hover:opacity-80',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 cursor-pointer hover:opacity-80',
  unlocated: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 cursor-pointer hover:opacity-80',
  'under-action': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300 cursor-pointer hover:opacity-80',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 cursor-pointer hover:opacity-80',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 cursor-pointer hover:opacity-80',
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
  const [globalFilter, setGlobalFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [municipalityFilter, setMunicipalityFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [reportTitleFilter, setReportTitleFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [advancedSearch, setAdvancedSearch] = useState({
    location: '',
    assignedTo: '',
    reportedBy: ''
  })
  const [concerns, setConcerns] = useState<Action[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [carouselImages, setCarouselImages] = useState<Array<{ url: string; caption?: string }>>([])
  const [carouselTitle, setCarouselTitle] = useState('')
  const [showCarousel, setShowCarousel] = useState(false)

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
      cell: ({ row }) => {
        const isExpanded = expandedRows.has(row.original.id + '-title')
        const title = row.getValue('reportTitle') as string
        const remarks = row.original.caseRemarks
        
        // Check if text is long enough to be truncated
        const isTitleLong = title.length > 60
        const isRemarksLong = remarks && remarks.length > 40
        
        const toggleExpand = () => {
          const newExpanded = new Set(expandedRows)
          const key = row.original.id + '-title'
          if (newExpanded.has(key)) {
            newExpanded.delete(key)
          } else {
            newExpanded.add(key)
          }
          setExpandedRows(newExpanded)
        }
        
        return (
          <div className="max-w-[250px]">
            <button
              onClick={toggleExpand}
              className="text-left w-full hover:bg-muted/50 rounded p-1 -m-1 transition-colors cursor-pointer"
            >
              <div className="font-medium text-xs">
                <div className={isExpanded ? 'whitespace-normal' : 'line-clamp-2'}>
                  {title}
                </div>
                {!isExpanded && isTitleLong && (
                  <span className="text-blue-600 dark:text-blue-400 font-bold">...</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                <div className={isExpanded ? 'mt-1 whitespace-normal' : 'line-clamp-1'}>
                  {remarks}
                </div>
                {!isExpanded && isRemarksLong && (
                  <span className="text-blue-600 dark:text-blue-400 font-bold">...</span>
                )}
              </div>
            </button>
          </div>
        )
      },
    },
    {
      accessorKey: 'location',
      header: 'Location',
      cell: ({ row }) => {
        const isExpanded = expandedRows.has(row.original.id + '-location')
        const location = row.getValue('location') as string
        const isLocationLong = location.length > 50
        
        const toggleExpand = () => {
          const newExpanded = new Set(expandedRows)
          const key = row.original.id + '-location'
          if (newExpanded.has(key)) {
            newExpanded.delete(key)
          } else {
            newExpanded.add(key)
          }
          setExpandedRows(newExpanded)
        }
        
        return (
          <div className="max-w-[200px]">
            <button
              onClick={toggleExpand}
              className="text-left w-full hover:bg-muted/50 rounded p-1 -m-1 transition-colors cursor-pointer"
            >
              <div className="text-xs">
                <div className={isExpanded ? 'whitespace-normal' : 'line-clamp-2'}>
                  {location}
                </div>
                {!isExpanded && isLocationLong && (
                  <span className="text-blue-600 dark:text-blue-400 font-bold">...</span>
                )}
              </div>
            </button>
          </div>
        )
      },
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
        if (photos.length === 0) return <span className="text-xs text-muted-foreground">-</span>
        
        return (
          <button
            onClick={() => {
              setCarouselImages(photos.map(p => ({ url: p.url, caption: p.fileName })))
              setCarouselTitle('Concern Photos')
              setShowCarousel(true)
            }}
            className="flex gap-1 hover:opacity-80 transition-opacity cursor-pointer"
          >
            {photos.slice(0, 3).map((photo, index) => (
              <LazyImage
                key={index}
                src={photo.url}
                alt={`Concern ${index + 1}`}
                className="w-10 h-10 object-cover rounded border"
              />
            ))}
            {photos.length > 3 && (
              <div className="w-10 h-10 bg-muted rounded border flex items-center justify-center text-xs font-medium">
                +{photos.length - 3}
              </div>
            )}
          </button>
        )
      },
    },
    {
      accessorKey: 'actionTaken',
      header: 'Action Taken',
      cell: ({ row }) => {
        const actionTaken = row.original.actionTaken
        const status = row.original.status
        
        // Show Submit Action button if no action taken OR status needs action
        if (!actionTaken || status === 'pending' || status === 'under-action' || status === 'in-progress') {
          return (
            <SubmitActionDialog
              concernId={row.original.id}
              concernTitle={row.original.reportTitle}
            />
          )
        }
        
        // If there are photos, show them as clickable
        if (actionTaken.photos && actionTaken.photos.length > 0) {
          // Filter out documents and only show images
          const imagePhotos = actionTaken.photos.filter(p => p.fileType !== 'document')
          const documentPhotos = actionTaken.photos.filter(p => p.fileType === 'document')
          
          return (
            <div className="flex gap-1">
              {/* Show clickable images */}
              {imagePhotos.length > 0 && (
                <button
                  onClick={() => {
                    setCarouselImages(imagePhotos.map(p => ({ url: p.url, caption: p.fileName })))
                    setCarouselTitle('Action Photos')
                    setShowCarousel(true)
                  }}
                  className="flex gap-1 hover:opacity-80 transition-opacity cursor-pointer"
                >
                  {imagePhotos.slice(0, 2).map((photo, index) => (
                    <LazyImage
                      key={index}
                      src={photo.url}
                      alt={`Action ${index + 1}`}
                      className="w-10 h-10 object-cover rounded border"
                    />
                  ))}
                  {imagePhotos.length > 2 && (
                    <div className="w-10 h-10 bg-muted rounded border flex items-center justify-center text-xs font-medium">
                      +{imagePhotos.length - 2}
                    </div>
                  )}
                </button>
              )}
              
              {/* Show document icons separately */}
              {documentPhotos.map((photo, index) => (
                <button
                  key={`doc-${index}`}
                  onClick={() => {
                    const newWindow = window.open()
                    if (newWindow) {
                      newWindow.document.write(`
                        <html>
                          <head>
                            <title>${photo.fileName || 'Document'}</title>
                            <style>
                              body { margin: 0; padding: 0; }
                              iframe { width: 100vw; height: 100vh; border: none; }
                            </style>
                          </head>
                          <body>
                            <iframe src="${photo.url}"></iframe>
                          </body>
                        </html>
                      `)
                      newWindow.document.close()
                    }
                  }}
                  className="w-10 h-10 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors cursor-pointer"
                  title={photo.fileName || 'Document'}
                >
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </button>
              ))}
            </div>
          )
        }
        
        // If no photos, show action notes with accordion-style dropdown
        const isExpanded = expandedRows.has(row.original.id + '-action')
        const notes = actionTaken.notes || 'No notes provided'
        const isNotesLong = notes.length > 50
        
        const toggleExpand = () => {
          const newExpanded = new Set(expandedRows)
          const key = row.original.id + '-action'
          if (newExpanded.has(key)) {
            newExpanded.delete(key)
          } else {
            newExpanded.add(key)
          }
          setExpandedRows(newExpanded)
        }
        
        return (
          <div className="max-w-[200px]">
            <button
              onClick={toggleExpand}
              className="text-left w-full hover:bg-muted/50 rounded p-1 -m-1 transition-colors cursor-pointer"
            >
              <div className="text-xs text-muted-foreground">
                <div className={isExpanded ? 'whitespace-normal break-words' : 'line-clamp-2 break-words'}>
                  {notes}
                </div>
                {!isExpanded && isNotesLong && (
                  <span className="text-blue-600 dark:text-blue-400 font-bold">...</span>
                )}
              </div>
            </button>
          </div>
        )
      },
    },
    {
      accessorKey: 'otherInfo',
      header: 'Other Info',
      cell: ({ row }) => {
        const actionTaken = row.original.actionTaken
        const status = row.original.status
        
        // Show dash if no action taken OR status is pending
        if (!actionTaken || status === 'pending' || !actionTaken.otherInfo) {
          return <span className="text-xs text-muted-foreground">-</span>
        }
        
        // Show other info with accordion-style dropdown
        const isExpanded = expandedRows.has(row.original.id + '-otherInfo')
        const otherInfo = actionTaken.otherInfo || ''
        const isOtherInfoLong = otherInfo.length > 50
        
        const toggleExpand = () => {
          const newExpanded = new Set(expandedRows)
          const key = row.original.id + '-otherInfo'
          if (newExpanded.has(key)) {
            newExpanded.delete(key)
          } else {
            newExpanded.add(key)
          }
          setExpandedRows(newExpanded)
        }
        
        return (
          <div className="max-w-[200px]">
            <button
              onClick={toggleExpand}
              className="text-left w-full hover:bg-muted/50 rounded p-1 -m-1 transition-colors cursor-pointer"
            >
              <div className="text-xs text-muted-foreground">
                <div className={isExpanded ? 'whitespace-normal break-words' : 'line-clamp-2 break-words'}>
                  {otherInfo}
                </div>
                {!isExpanded && isOtherInfoLong && (
                  <span className="text-blue-600 dark:text-blue-400 font-bold">...</span>
                )}
              </div>
            </button>
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
        // Check if date is "Ongoing" or a string that can't be parsed as date
        if (date === 'Ongoing' || isNaN(new Date(date as string).getTime())) {
          return <div className="text-xs font-medium text-blue-600">{date as string}</div>
        }
        return <div className="text-xs">{format(new Date(date as string), 'MMM dd, yyyy')}</div>
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as string
        return (
          <UpdateStatusDialog
            concernId={row.original.id}
            currentStatus={status}
            collectionName="concerns"
            withCompleted
          />
        )
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const isInProgress = row.original.status === 'in-progress' || row.original.status === 'pending' || row.original.status === 'under-action'
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
              {isInProgress && (
                <MarkAsCompletedDialog 
                  concernId={row.original.id} 
                  concernTitle={row.original.reportTitle}
                  collectionName="concerns"
                />
              )}
              <DeleteConcernDialog concernId={row.original.id} concernTitle={row.original.reportTitle} />
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ], [expandedRows]) // Include expandedRows so columns re-render when expansion state changes

  // Apply filters with useMemo
  const filteredData = useMemo(() => {
    return concerns.filter((action) => {
      // Global search filter (searches both report title and location)
      if (globalFilter) {
        const searchLower = globalFilter.toLowerCase()
        const titleMatch = action.reportTitle.toLowerCase().includes(searchLower)
        const locationMatch = action.location.toLowerCase().includes(searchLower)
        if (!titleMatch && !locationMatch) return false
      }
      
      // Status filter
      if (statusFilter !== 'all' && action.status !== statusFilter) return false
      
      // Municipality filter
      if (municipalityFilter !== 'all' && action.municipality !== municipalityFilter) return false
      
      // Category filter
      if (categoryFilter !== 'all' && action.category !== categoryFilter) return false

      // Report Title filter
      if (reportTitleFilter !== 'all' && action.reportTitle !== reportTitleFilter) return false
      
      // Date range filter
      if (dateFrom || dateTo) {
        const actionDate = new Date(action.dateReported)
        if (dateFrom && dateTo) {
          if (!isWithinInterval(actionDate, { 
            start: startOfDay(dateFrom), 
            end: endOfDay(dateTo) 
          })) return false
        } else if (dateFrom) {
          if (actionDate < startOfDay(dateFrom)) return false
        } else if (dateTo) {
          if (actionDate > endOfDay(dateTo)) return false
        }
      }
      
      // Advanced search filters
      if (advancedSearch.location && !action.location.toLowerCase().includes(advancedSearch.location.toLowerCase())) {
        return false
      }
      if (advancedSearch.assignedTo && !action.assignedTo.toLowerCase().includes(advancedSearch.assignedTo.toLowerCase())) {
        return false
      }
      if (advancedSearch.reportedBy && !action.answeredBy.toLowerCase().includes(advancedSearch.reportedBy.toLowerCase())) {
        return false
      }
      
      return true
    })
  }, [concerns, globalFilter, statusFilter, municipalityFilter, categoryFilter, reportTitleFilter, dateFrom, dateTo, advancedSearch])

  // Unique report titles for filter dropdown
  const uniqueReportTitles = useMemo(() => {
    const titles = [...new Set(concerns.map((c) => c.reportTitle).filter(Boolean))]
    return titles.sort()
  }, [concerns])

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

  // Stats with useMemo - split by category
  const stats = useMemo(() => ({
    total: concerns.length,
    totalEnvironmental: concerns.filter((a) => a.category === 'environmental').length,
    totalAgricultural: concerns.filter((a) => a.category === 'agricultural').length,
    pending: concerns.filter((a) => a.status === 'pending').length,
    pendingEnvironmental: concerns.filter((a) => a.status === 'pending' && a.category === 'environmental').length,
    pendingAgricultural: concerns.filter((a) => a.status === 'pending' && a.category === 'agricultural').length,
    underAction: concerns.filter((a) => a.status === 'in-progress' || a.status === 'under-action').length,
    underActionEnvironmental: concerns.filter((a) => (a.status === 'in-progress' || a.status === 'under-action') && a.category === 'environmental').length,
    underActionAgricultural: concerns.filter((a) => (a.status === 'in-progress' || a.status === 'under-action') && a.category === 'agricultural').length,
    completed: concerns.filter((a) => a.status === 'completed' || a.status === 'closed' || a.status === 'resolved').length,
    completedEnvironmental: concerns.filter((a) => (a.status === 'completed' || a.status === 'closed' || a.status === 'resolved') && a.category === 'environmental').length,
    completedAgricultural: concerns.filter((a) => (a.status === 'completed' || a.status === 'closed' || a.status === 'resolved') && a.category === 'agricultural').length,
    unlocated: concerns.filter((a) => a.status === 'unlocated').length,
    unlocatedEnvironmental: concerns.filter((a) => a.status === 'unlocated' && a.category === 'environmental').length,
    unlocatedAgricultural: concerns.filter((a) => a.status === 'unlocated' && a.category === 'agricultural').length,
  }), [concerns])

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
    doc.text('Action Center - Detailed Report', margin, yPosition)
    
    yPosition += 8
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, margin, yPosition)
    doc.text(`Total Records: ${filteredData.length}`, pageWidth - margin - 30, yPosition)
    
    yPosition += 10
    doc.setTextColor(0, 0, 0)

    // Process each concern
    for (let i = 0; i < filteredData.length; i++) {
      const item = filteredData[i]
      
      // Check if we need a new page
      if (yPosition > pageHeight - 60) {
        doc.addPage()
        yPosition = 20
      }

      // Concern box
      doc.setDrawColor(200, 200, 200)
      doc.setFillColor(249, 250, 251)
      doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 10, 2, 2, 'FD')
      
      // Concern number and status
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(`Concern #${i + 1}`, margin + 3, yPosition + 6)
      
      // Status badge
      const statusX = pageWidth - margin - 25
      if (item.status === 'completed') {
        doc.setFillColor(220, 252, 231)
        doc.setTextColor(22, 163, 74)
      } else {
        doc.setFillColor(254, 249, 195)
        doc.setTextColor(161, 98, 7)
      }
      doc.roundedRect(statusX, yPosition + 2, 22, 6, 1, 1, 'F')
      doc.setFontSize(8)
      doc.text(item.status.toUpperCase(), statusX + 11, yPosition + 6, { align: 'center' })
      
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
      doc.text('Municipality:', col1X, yPosition)
      doc.setFont('helvetica', 'normal')
      doc.text(item.municipality, col1X + 30, yPosition)
      
      yPosition += lineHeight
      doc.setFont('helvetica', 'bold')
      doc.text('Category:', col1X, yPosition)
      doc.setFont('helvetica', 'normal')
      doc.text(item.category, col1X + 30, yPosition)

      // Column 2
      yPosition -= lineHeight * 2
      doc.setFont('helvetica', 'bold')
      doc.text('Answered By:', col2X, yPosition)
      doc.setFont('helvetica', 'normal')
      doc.text(item.answeredBy, col2X + 30, yPosition)
      
      yPosition += lineHeight
      doc.setFont('helvetica', 'bold')
      doc.text('Action Date:', col2X, yPosition)
      doc.setFont('helvetica', 'normal')
      // Handle action date - could be "Ongoing", null, or a valid date
      let actionDateText = 'N/A'
      if (item.actionDate) {
        if (item.actionDate === 'Ongoing') {
          actionDateText = 'Ongoing'
        } else {
          try {
            const actionDate = new Date(item.actionDate)
            if (!isNaN(actionDate.getTime())) {
              actionDateText = format(actionDate, 'MMM dd, yyyy')
            }
          } catch (e) {
            actionDateText = 'N/A'
          }
        }
      }
      doc.text(actionDateText, col2X + 30, yPosition)

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

      // Case Remarks
      if (item.caseRemarks) {
        doc.setFont('helvetica', 'bold')
        doc.text('Remarks:', col1X, yPosition)
        yPosition += 4
        doc.setFont('helvetica', 'normal')
        const remarksLines = doc.splitTextToSize(item.caseRemarks, pageWidth - 2 * margin - 6)
        doc.text(remarksLines, col1X, yPosition)
        yPosition += remarksLines.length * 4
      }

      // Images section
      yPosition += 3

      // Concern Photos
      if (item.concernPhotos && item.concernPhotos.length > 0) {
        // Check if we need a new page for images
        if (yPosition > pageHeight - 50) {
          doc.addPage()
          yPosition = 20
        }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(`Concern Photos (${item.concernPhotos.length}):`, col1X, yPosition)
        yPosition += 5

        try {
          const imgWidth = 35
          const imgHeight = 35
          const imgsPerRow = 4
          const imgSpacing = 3

          for (let j = 0; j < Math.min(item.concernPhotos.length, 4); j++) {
            const xPos = col1X + (j % imgsPerRow) * (imgWidth + imgSpacing)
            const yPos = yPosition + Math.floor(j / imgsPerRow) * (imgHeight + imgSpacing)

            // Check if we need a new page
            if (yPos + imgHeight > pageHeight - margin) {
              doc.addPage()
              yPosition = 20
            }

            try {
              doc.addImage(item.concernPhotos[j].url, 'JPEG', xPos, yPos, imgWidth, imgHeight)
            } catch (err) {
              // If image fails, draw a placeholder
              doc.setDrawColor(200, 200, 200)
              doc.rect(xPos, yPos, imgWidth, imgHeight)
              doc.setFontSize(7)
              doc.text('Image', xPos + imgWidth / 2, yPos + imgHeight / 2, { align: 'center' })
            }
          }
          yPosition += Math.ceil(Math.min(item.concernPhotos.length, 4) / imgsPerRow) * (imgHeight + imgSpacing) + 5
        } catch (error) {
          console.error('Error adding concern photos:', error)
          yPosition += 5
        }
      }

      // Action Taken Photos
      if (item.actionTaken && item.actionTaken.photos && item.actionTaken.photos.length > 0) {
        // Check if we need a new page for images
        if (yPosition > pageHeight - 50) {
          doc.addPage()
          yPosition = 20
        }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(`Action Taken Photos (${item.actionTaken.photos.length}):`, col1X, yPosition)
        yPosition += 5

        try {
          const imgWidth = 35
          const imgHeight = 35
          const imgsPerRow = 4
          const imgSpacing = 3

          for (let j = 0; j < Math.min(item.actionTaken.photos.length, 4); j++) {
            const xPos = col1X + (j % imgsPerRow) * (imgWidth + imgSpacing)
            const yPos = yPosition + Math.floor(j / imgsPerRow) * (imgHeight + imgSpacing)

            // Check if we need a new page
            if (yPos + imgHeight > pageHeight - margin) {
              doc.addPage()
              yPosition = 20
            }

            try {
              doc.addImage(item.actionTaken.photos[j].url, 'JPEG', xPos, yPos, imgWidth, imgHeight)
            } catch (err) {
              // If image fails, draw a placeholder
              doc.setDrawColor(200, 200, 200)
              doc.rect(xPos, yPos, imgWidth, imgHeight)
              doc.setFontSize(7)
              doc.text('Image', xPos + imgWidth / 2, yPos + imgHeight / 2, { align: 'center' })
            }
          }
          yPosition += Math.ceil(Math.min(item.actionTaken.photos.length, 4) / imgsPerRow) * (imgHeight + imgSpacing) + 5
        } catch (error) {
          console.error('Error adding action photos:', error)
          yPosition += 5
        }

        // Action notes
        if (item.actionTaken.notes) {
          doc.setFont('helvetica', 'bold')
          doc.text('Action Notes:', col1X, yPosition)
          yPosition += 4
          doc.setFont('helvetica', 'normal')
          const notesLines = doc.splitTextToSize(item.actionTaken.notes, pageWidth - 2 * margin - 6)
          doc.text(notesLines, col1X, yPosition)
          yPosition += notesLines.length * 4
        }
      }

      yPosition += 8
    }

    doc.save(`action-center-detailed-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
    toast.success('PDF exported successfully!')
  }

  // Clear all filters
  const clearFilters = () => {
    setStatusFilter('all')
    setMunicipalityFilter('all')
    setCategoryFilter('all')
    setReportTitleFilter('all')
    setDateFrom(undefined)
    setDateTo(undefined)
    setAdvancedSearch({ location: '', assignedTo: '', reportedBy: '' })
    table.getColumn('reportTitle')?.setFilterValue('')
    toast.success('All filters cleared')
  }

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
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Concerns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="mt-2 flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <span className="text-emerald-600 font-semibold">{stats.totalEnvironmental}</span>
                  <span className="text-muted-foreground">Environmental</span>
                </div>
                <div className="text-muted-foreground">/</div>
                <div className="flex items-center gap-1">
                  <span className="text-amber-600 font-semibold">{stats.totalAgricultural}</span>
                  <span className="text-muted-foreground">Agricultural</span>
                </div>
              </div>
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
              <div className="mt-2 flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <span className="text-emerald-600 font-semibold">{stats.pendingEnvironmental}</span>
                  <span className="text-muted-foreground">Environmental</span>
                </div>
                <div className="text-muted-foreground">/</div>
                <div className="flex items-center gap-1">
                  <span className="text-amber-600 font-semibold">{stats.pendingAgricultural}</span>
                  <span className="text-muted-foreground">Agricultural</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Under Action</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.underAction}</div>
              <div className="mt-2 flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <span className="text-emerald-600 font-semibold">{stats.underActionEnvironmental}</span>
                  <span className="text-muted-foreground">Environmental</span>
                </div>
                <div className="text-muted-foreground">/</div>
                <div className="flex items-center gap-1">
                  <span className="text-amber-600 font-semibold">{stats.underActionAgricultural}</span>
                  <span className="text-muted-foreground">Agricultural</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <div className="mt-2 flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <span className="text-emerald-600 font-semibold">{stats.completedEnvironmental}</span>
                  <span className="text-muted-foreground">Environmental</span>
                </div>
                <div className="text-muted-foreground">/</div>
                <div className="flex items-center gap-1">
                  <span className="text-amber-600 font-semibold">{stats.completedAgricultural}</span>
                  <span className="text-muted-foreground">Agricultural</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Unlocated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.unlocated}</div>
              <div className="mt-2 flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <span className="text-emerald-600 font-semibold">{stats.unlocatedEnvironmental}</span>
                  <span className="text-muted-foreground">Environmental</span>
                </div>
                <div className="text-muted-foreground">/</div>
                <div className="flex items-center gap-1">
                  <span className="text-amber-600 font-semibold">{stats.unlocatedAgricultural}</span>
                  <span className="text-muted-foreground">Agricultural</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Data Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Concern Reports</CardTitle>
                <CardDescription>
                  View and manage all reported concerns
                </CardDescription>
              </div>
              <AddConcernDialog />
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
                    placeholder="Search report title or location..."
                    value={globalFilter}
                    onChange={(event) => setGlobalFilter(event.target.value)}
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
                    <SelectItem value="under-action">Under Action</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="unlocated">Unlocated</SelectItem>
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

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full md:w-[150px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="environmental">Environmental</SelectItem>
                    <SelectItem value="agricultural">Agricultural</SelectItem>
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
                  <div className="flex gap-2 items-center">
                    <Select value={reportTitleFilter} onValueChange={setReportTitleFilter}>
                      <SelectTrigger className="w-[200px] h-8 text-sm">
                        <SelectValue placeholder="Report Title" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Report Titles</SelectItem>
                        {uniqueReportTitles.map((title) => (
                          <SelectItem key={title} value={title}>
                            {title.length > 30 ? title.slice(0, 30) + '...' : title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input
                        placeholder="Search by location..."
                        value={advancedSearch.location}
                        onChange={(e) => setAdvancedSearch({ ...advancedSearch, location: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Assigned To</Label>
                      <Input
                        placeholder="Search by assigned to..."
                        value={advancedSearch.assignedTo}
                        onChange={(e) => setAdvancedSearch({ ...advancedSearch, assignedTo: e.target.value })}
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

      {/* Image Carousel Dialog */}
      <ImageCarouselDialog
        open={showCarousel}
        onOpenChange={setShowCarousel}
        images={carouselImages}
        title={carouselTitle}
      />
    </div>
  )
}
