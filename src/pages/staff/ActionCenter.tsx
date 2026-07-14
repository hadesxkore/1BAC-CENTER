import { useState, useEffect, useMemo, memo, useCallback } from 'react'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
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
import CoordinatesDialog from '@/components/CoordinatesDialog'
import { MarkAsCompletedDialog } from '@/components/MarkAsCompletedDialog'
import { UpdateStatusDialog } from '@/components/UpdateStatusDialog'
import ExportPDFDialog from '@/components/ExportPDFDialog'
import ImageCarouselDialog from '@/components/ImageCarouselDialog'
import { db } from '@/config/firebase'
import { collection, query, orderBy, onSnapshot, Timestamp, doc, writeBatch, getDocs, where, setDoc } from 'firebase/firestore'
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
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
  const [pendingCoordsRow, setPendingCoordsRow] = useState<Action | null>(null)

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
          coordinates: typeof data.coordinates === 'object' && data.coordinates !== null
            ? `${data.coordinates.lat ?? ''}, ${data.coordinates.lng ?? ''}`
            : (data.coordinates || undefined),
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

  // One-time backfill: migrate in-progress → under-action
  useEffect(() => {
    const backfill = async () => {
      try {
        const q = query(collection(db, 'concerns'), where('status', '==', 'in-progress'))
        const snapshot = await getDocs(q)
        if (snapshot.empty) return

        const batch = writeBatch(db)
        snapshot.forEach((d) => {
          batch.update(doc(db, 'concerns', d.id), { status: 'under-action' })
        })
        await batch.commit()
        console.log(`Backfilled ${snapshot.size} in-progress → under-action`)
      } catch (err) {
        console.error('Backfill error:', err)
      }
    }
    backfill()
  }, [])

  const columns: ColumnDef<Action>[] = useMemo(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <div className="flex items-center justify-center w-8">
          <input
            type="checkbox"
            className="w-3.5 h-3.5 cursor-pointer accent-[#1a3a6b]"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        </div>
      ),
      cell: ({ row }) => {
        const hasCoords = !!row.original.coordinates
        return (
          <div className="flex items-center justify-center w-8">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 cursor-pointer accent-[#1a3a6b]"
              checked={row.getIsSelected()}
              onChange={() => {
                if (!hasCoords && !row.getIsSelected()) {
                  setPendingCoordsRow(row.original)
                } else {
                  row.toggleSelected()
                }
              }}
            />
          </div>
        )
      },
      enableSorting: false,
    },
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
      if (statusFilter !== 'all') {
        if (statusFilter === 'under-action') {
          if (action.status !== 'under-action' && action.status !== 'in-progress') return false
        } else {
          if (action.status !== statusFilter) return false
        }
      }
      
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
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    initialState: {
      pagination: {
        pageSize: 10, // Show 10 rows per page
      },
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  // Stats with useMemo - split by category, based on filtered data
  const stats = useMemo(() => ({
    total: filteredData.length,
    totalEnvironmental: filteredData.filter((a) => a.category === 'environmental').length,
    totalAgricultural: filteredData.filter((a) => a.category === 'agricultural').length,
    pending: filteredData.filter((a) => a.status === 'pending').length,
    pendingEnvironmental: filteredData.filter((a) => a.status === 'pending' && a.category === 'environmental').length,
    pendingAgricultural: filteredData.filter((a) => a.status === 'pending' && a.category === 'agricultural').length,
    underAction: filteredData.filter((a) => a.status === 'in-progress' || a.status === 'under-action').length,
    underActionEnvironmental: filteredData.filter((a) => (a.status === 'in-progress' || a.status === 'under-action') && a.category === 'environmental').length,
    underActionAgricultural: filteredData.filter((a) => (a.status === 'in-progress' || a.status === 'under-action') && a.category === 'agricultural').length,
    completed: filteredData.filter((a) => a.status === 'completed' || a.status === 'closed' || a.status === 'resolved').length,
    completedEnvironmental: filteredData.filter((a) => (a.status === 'completed' || a.status === 'closed' || a.status === 'resolved') && a.category === 'environmental').length,
    completedAgricultural: filteredData.filter((a) => (a.status === 'completed' || a.status === 'closed' || a.status === 'resolved') && a.category === 'agricultural').length,
    unlocated: filteredData.filter((a) => a.status === 'unlocated').length,
    unlocatedEnvironmental: filteredData.filter((a) => a.status === 'unlocated' && a.category === 'environmental').length,
    unlocatedAgricultural: filteredData.filter((a) => a.status === 'unlocated' && a.category === 'agricultural').length,
  }), [filteredData])

  // Export PDF with row selection, status filter, and date range
  const selectedCount = Object.keys(rowSelection).length

  const handleExportWithFilter = async (
    selectedStatuses: string[],
    dateFrom?: Date,
    dateTo?: Date
  ) => {
    // Start with selected rows, or all filtered data if none selected
    let dataToExport = selectedCount > 0
      ? filteredData.filter((item) => rowSelection[item.id])
      : filteredData

    // Filter by date range (based on dateReported)
    if (dateFrom || dateTo) {
      dataToExport = dataToExport.filter((item) => {
        const d = new Date(item.dateReported)
        if (dateFrom && d < dateFrom) return false
        if (dateTo) {
          const endOfDay = new Date(dateTo)
          endOfDay.setHours(23, 59, 59, 999)
          if (d > endOfDay) return false
        }
        return true
      })
    }

    // Filter by status groups
    if (!selectedStatuses.includes('all')) {
      dataToExport = dataToExport.filter((item) => {
        if (selectedStatuses.includes('pending') && item.status === 'pending') return true
        if (selectedStatuses.includes('under-action') && (item.status === 'in-progress' || item.status === 'under-action')) return true
        if (selectedStatuses.includes('completed') && (item.status === 'completed' || item.status === 'closed' || item.status === 'resolved')) return true
        if (selectedStatuses.includes('unlocated') && item.status === 'unlocated') return true
        return false
      })
    }

    if (dataToExport.length === 0) {
      toast.error('No data matches the selected filters')
      return
    }

    toast.info('Generating PDF... This may take a moment.')
    await generateFormalPDF(dataToExport)
  }

  const generateFormalPDF = async (data: Action[]) => {
    const doc = new jsPDF('l', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 12
    const contentWidth = pageWidth - 2 * margin
    const colGap = 10
    const colW = (contentWidth - colGap) / 2
    const fieldX = margin + 2
    const fieldW = contentWidth - 4
    let y = margin
    let pageNum = 1

    const addFooter = () => {
      doc.setFontSize(7)
      doc.setTextColor(150, 150, 150)
      doc.setFont('helvetica', 'normal')
      doc.text(
        `1BAC Action Center - Official Report | Page ${pageNum}`,
        margin,
        pageHeight - 8
      )
      doc.text(
        `Generated ${format(new Date(), 'MMM dd, yyyy HH:mm')}`,
        pageWidth - margin,
        pageHeight - 8,
        { align: 'right' }
      )
    }

    const addHeader = () => {
      doc.setDrawColor(26, 58, 107)
      doc.setFillColor(26, 58, 107)
      doc.roundedRect(margin, y, contentWidth, 9, 1.5, 1.5, 'F')
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text('ACTION CENTER', margin + 5, y + 6)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(220, 225, 240)
      doc.text('Detailed Concern Report', margin + 75, y + 6)
      y += 13
      doc.setDrawColor(220, 220, 220)
      doc.setFillColor(245, 246, 250)
      doc.roundedRect(margin, y, contentWidth, 10, 1.5, 1.5, 'FD')
      doc.setFontSize(8.5)
      doc.setTextColor(60, 60, 60)
      doc.setFont('helvetica', 'bold')
      doc.text('Total Records:', margin + 4, y + 6)
      doc.setFont('helvetica', 'normal')
      doc.text(`${data.length}`, margin + 26, y + 6)
      doc.setFont('helvetica', 'bold')
      doc.text('Reference:', margin + 80, y + 6)
      doc.setFont('helvetica', 'normal')
      doc.text(`1BAC-ACT-${format(new Date(), 'yyMMdd')}`, margin + 114, y + 6)
      y += 16
    }

    const needsPage = (needed: number) => {
      if (y + needed > pageHeight - 12) {
        addFooter()
        doc.addPage()
        pageNum++
        y = margin
        addHeader()
        return true
      }
      return false
    }

    addHeader()

    for (let i = 0; i < data.length; i++) {
      const item = data[i]

      // Each concern gets its own page
      if (i > 0) {
        addFooter()
        doc.addPage()
        pageNum++
        y = margin
        addHeader()
      }

      // Section header
      if (needsPage(12)) {}
      doc.setDrawColor(26, 58, 107)
      doc.setFillColor(26, 58, 107)
      doc.roundedRect(margin, y, contentWidth, 8, 1.5, 1.5, 'F')
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text(`CONCERN REPORT #${i + 1}`, margin + 5, y + 5)

      const sLabel = STATUS_LABELS[item.status] || item.status
      const badgeColors: Record<string, [number, number, number]> = {
        pending: [250, 204, 21], 'in-progress': [251, 146, 60],
        'under-action': [251, 146, 60], completed: [34, 197, 94],
        closed: [100, 100, 100], resolved: [34, 197, 94],
        unlocated: [156, 163, 175],
      }
      const bc = badgeColors[item.status] || [100, 100, 100]
      doc.setFillColor(bc[0], bc[1], bc[2])
      doc.roundedRect(pageWidth - margin - 32, y + 1.5, 28, 5, 1, 1, 'F')
      doc.setFontSize(7.5)
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.text(sLabel.toUpperCase(), pageWidth - margin - 18, y + 5, { align: 'center' })
      doc.setTextColor(50, 50, 50)

      y += 13

      // ── Field row: 3 core fields in one line ──
      if (needsPage(10)) {}
      const fY = y + 3.5
      const fS = 9.5
      doc.setFontSize(fS)

      const row = (label: string, val: string, x: number, valOffset = 25) => {
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(80, 80, 80)
        doc.text(label, x, fY)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(30, 30, 30)
        doc.text(val || 'N/A', x + valOffset, fY)
      }

      row('Date Reported', format(new Date(item.dateReported), 'MMM dd, yyyy'), margin + 2)
      row('Municipality', item.municipality, margin + 72)
      row('Category', item.category, margin + 138)
      if (item.coordinates) {
        row('Coord', item.coordinates, margin + 200, 16)
      }
      y += 9

      // ── Report Title ──
      const tLines = doc.splitTextToSize(item.reportTitle, fieldW)
      const tH = tLines.length * 4 + 8
      if (needsPage(tH)) {}
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(80, 80, 80)
      doc.text('Report Title', margin + 2, y)
      y += 3.5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(30, 30, 30)
      doc.text(tLines, margin + 2, y)
      y += tLines.length * 4 + 2

      // ── Location ──
      const lLines = doc.splitTextToSize(item.location, fieldW)
      const lH = lLines.length * 4 + 8
      if (needsPage(lH)) {}
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(80, 80, 80)
      doc.text('Location', margin + 2, y)
      y += 3.5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(30, 30, 30)
      doc.text(lLines, margin + 2, y)
      y += lLines.length * 4 + 2

      // ── Remarks ──
      if (item.caseRemarks) {
        const rLines = doc.splitTextToSize(item.caseRemarks, fieldW)
        const rH = rLines.length * 4 + 8
        if (needsPage(rH)) {}
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(80, 80, 80)
        doc.text('Remarks', margin + 2, y)
        y += 3.5
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9.5)
        doc.setTextColor(30, 30, 30)
        doc.text(rLines, margin + 2, y)
        y += rLines.length * 4 + 2
      }

      // ── Action Notes ──
      if (item.actionTaken?.notes) {
        const lh = 4
        const oneColLines = doc.splitTextToSize(item.actionTaken.notes, fieldW)
        const oneColH = oneColLines.length * lh + 10

        if (y + oneColH < pageHeight - 12) {
          if (needsPage(oneColH)) {}
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(9)
          doc.setTextColor(26, 58, 107)
          doc.text('Action Notes', margin + 2, y)
          y += 3.5
          doc.setDrawColor(220, 220, 220)
          doc.line(margin + 2, y, pageWidth - margin - 2, y)
          y += 4
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9.5)
          doc.setTextColor(30, 30, 30)
          doc.text(oneColLines, margin + 2, y)
          y += oneColLines.length * lh + 2
        } else {
          const halfW = (fieldW - colGap) / 2
          const lines = doc.splitTextToSize(item.actionTaken.notes, halfW)
          const mid = Math.ceil(lines.length / 2)
          const leftN = lines.slice(0, mid)
          const rightN = lines.slice(mid)
          const textH = Math.max(leftN.length, rightN.length) * lh + 10

          if (needsPage(textH)) {}
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(9)
          doc.setTextColor(26, 58, 107)
          doc.text('Action Notes', margin + 2, y)
          y += 3.5
          doc.setDrawColor(220, 220, 220)
          doc.line(margin + 2, y, pageWidth - margin - 2, y)
          y += 4
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9.5)
          doc.setTextColor(30, 30, 30)
          doc.text(leftN, margin + 2, y)
          doc.text(rightN, margin + 2 + halfW + colGap, y)
          y += textH
        }
      }

      // ── Supporting Photographs ──
      const allImgs: Array<{ url: string; label: string }> = []
      if (item.concernPhotos?.length) {
        item.concernPhotos.slice(0, 6).forEach((p) => allImgs.push({ url: p.url, label: 'Concern Photo' }))
      }
      if (item.actionTaken?.photos?.length) {
        item.actionTaken.photos.slice(0, 6).forEach((p) => allImgs.push({ url: p.url, label: 'Action Photo' }))
      }

      if (allImgs.length > 0) {
        const imgW = 55
        const imgH = 41
        const perRow = 4
        const gap = (contentWidth - 10 - perRow * imgW) / (perRow - 1 || 1)
        const maxImgs = Math.min(allImgs.length, 8)
        const rows = Math.ceil(maxImgs / perRow)
        const imgBlockH = rows * (imgH + 10) + 10

        if (needsPage(imgBlockH)) {}

        y += 1
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(26, 58, 107)
        doc.text('Supporting Photographs', margin + 2, y)
        y += 3
        doc.setDrawColor(220, 220, 220)
        doc.line(margin + 2, y, pageWidth - margin - 2, y)
        y += 4

        for (let j = 0; j < maxImgs; j++) {
          const c = j % perRow
          const r = Math.floor(j / perRow)
          const xPos = margin + 5 + c * (imgW + gap)
          const yPos = y + r * (imgH + 8)

          doc.setDrawColor(200, 200, 200)
          doc.setFillColor(248, 248, 248)
          doc.roundedRect(xPos - 1, yPos - 1, imgW + 2, imgH + 2, 1.5, 1.5, 'FD')

          try {
            doc.addImage(allImgs[j].url, 'JPEG', xPos, yPos, imgW, imgH)
          } catch (_) {
            doc.setDrawColor(200, 200, 200)
            doc.rect(xPos, yPos, imgW, imgH)
            doc.setFontSize(7)
            doc.setTextColor(160, 160, 160)
            doc.text('Unavailable', xPos + imgW / 2, yPos + imgH / 2, { align: 'center' })
          }

          doc.setFontSize(6.5)
          doc.setTextColor(120, 120, 120)
          doc.setFont('helvetica', 'normal')
          doc.text(`${allImgs[j].label} ${j + 1}`, xPos + imgW / 2, yPos + imgH + 4, { align: 'center' })
        }

        y += rows * (imgH + 8) + 2
      }

      y += 4
    }

    addFooter()
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
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="w-[200px] h-8 text-sm justify-start font-normal">
                          {reportTitleFilter === 'all' ? 'All Report Titles' : (reportTitleFilter.length > 25 ? reportTitleFilter.slice(0, 25) + '...' : reportTitleFilter)}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0" align="end">
                        <Command>
                          <CommandInput placeholder="Search report title..." />
                          <CommandList>
                            <CommandEmpty>No title found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="all"
                                onSelect={() => setReportTitleFilter('all')}
                              >
                                All Report Titles
                              </CommandItem>
                              {uniqueReportTitles.map((title) => (
                                <CommandItem
                                  key={title}
                                  value={title}
                                  onSelect={(value) => setReportTitleFilter(value)}
                                >
                                  {title.length > 40 ? title.slice(0, 40) + '...' : title}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear All
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)}>
                      <HugeiconsIcon icon={Download01Icon} className="w-4 h-4 mr-2" />
                      Export {selectedCount > 0 ? `(${selectedCount} selected)` : `(${filteredData.length})`}
                    </Button>
                  </div>
                </div>
                
                <ExportPDFDialog
                  open={showExportDialog}
                  onOpenChange={setShowExportDialog}
                  totalCount={selectedCount > 0 ? selectedCount : filteredData.length}
                  onExport={handleExportWithFilter}
                />

                <CoordinatesDialog
                  open={!!pendingCoordsRow}
                  onOpenChange={(open) => {
                    if (!open) setPendingCoordsRow(null)
                  }}
                  location={pendingCoordsRow?.location || ''}
                  reportTitle={pendingCoordsRow?.reportTitle || ''}
                  onSave={async (coordText) => {
                    if (!pendingCoordsRow) return
                    const rowId = pendingCoordsRow.id
                    if (coordText !== undefined) {
                      try {
                        await setDoc(doc(db, 'concerns', rowId), { coordinates: coordText }, { merge: true })
                        setConcerns((prev) =>
                          prev.map((c) =>
                            c.id === rowId ? { ...c, coordinates: coordText } : c
                          )
                        )
                        toast.success('Coordinates saved')
                      } catch (err) {
                        toast.error('Failed to save coordinates')
                        console.error(err)
                      }
                    }
                    rowSelection[rowId] = true
                    setRowSelection({ ...rowSelection })
                    setPendingCoordsRow(null)
                  }}
                />

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
