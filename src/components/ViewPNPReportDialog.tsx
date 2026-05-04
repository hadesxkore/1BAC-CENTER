import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { HugeiconsIcon } from '@hugeicons/react'
import { ViewIcon } from '@hugeicons/core-free-icons'
import { format } from 'date-fns'

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
  status: 'pending' | 'completed'
  reportedBy: string
  createdAt: string
}

interface ViewPNPReportDialogProps {
  report: PNPReport
}

const statusColors = {
  pending: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
}

// Lazy loading image component
function LazyImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [isLoaded, setIsLoaded] = useState(false)
  
  return (
    <img
      src={src}
      alt={alt}
      className={`${className} ${!isLoaded ? 'bg-muted animate-pulse' : ''} transition-opacity duration-200`}
      loading="lazy"
      onLoad={() => setIsLoaded(true)}
    />
  )
}

// Safe date formatter
function formatDate(dateString: string | undefined | null, formatStr: string): string {
  if (!dateString) {
    return 'N/A'
  }
  
  try {
    // Handle various date formats
    let date: Date
    
    // If it's already a valid date string
    if (dateString.includes('T') || dateString.includes('-')) {
      date = new Date(dateString)
    } else {
      // Try parsing as is
      date = new Date(dateString)
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date:', dateString)
      return dateString // Return original string if can't parse
    }
    
    return format(date, formatStr)
  } catch (error) {
    console.error('Date formatting error:', error, dateString)
    return dateString || 'Invalid date'
  }
}

export function ViewPNPReportDialog({ report }: ViewPNPReportDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start">
          <HugeiconsIcon icon={ViewIcon} className="mr-2 h-4 w-4" />
          View
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[95vw] lg:max-w-7xl h-[90vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-blue-200">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-2xl pr-8 text-blue-700">{report.reportTitle}</DialogTitle>
              <DialogDescription className="mt-1">
                Report ID: {report.id}
              </DialogDescription>
            </div>
            <Badge variant="outline" className={statusColors[report.status]}>
              {report.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-2 h-full divide-x">
            {/* LEFT SIDE - BEFORE (REPORT DETAILS) */}
            <div className="h-full overflow-hidden">
              <ScrollArea className="h-full">
                <div className="px-6 py-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-blue-700">Report Details</h3>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date Reported</p>
                          <p className="text-sm mt-1.5">{formatDate(report.dateReported, 'MMMM dd, yyyy')}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date Uploaded</p>
                          <p className="text-sm mt-1.5">{formatDate(report.dateUploaded, 'MMM dd, yyyy HH:mm')}</p>
                        </div>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Municipality</p>
                          <p className="text-sm mt-1.5">{report.municipality}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reported By</p>
                          <p className="text-sm mt-1.5">{report.reportedBy}</p>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Location</p>
                        <p className="text-sm">{report.location}</p>
                      </div>

                      <Separator />

                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Remarks</p>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{report.remarks}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Before Photos */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-blue-700">Before Photos</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {report.beforePhotos.map((photo, index) => (
                        <a
                          key={index}
                          href={photo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block group"
                        >
                          <LazyImage
                            src={photo.url}
                            alt={`Before ${index + 1}`}
                            className="w-full h-40 object-cover rounded-md border border-blue-200 group-hover:opacity-80 transition-opacity cursor-pointer"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>

            {/* RIGHT SIDE - AFTER (ACTION TAKEN) */}
            <div className="h-full overflow-hidden">
              <ScrollArea className="h-full">
                <div className="px-6 py-6 space-y-6">
                  {report.afterPhotos ? (
                    <>
                      <div>
                        <h3 className="text-lg font-semibold mb-4 text-green-700">After Photos (Action Taken)</h3>
                        
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Action Date</p>
                              <p className="text-sm mt-1.5">{formatDate(report.afterPhotos.actionDate, 'MMMM dd, yyyy')}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Submitted By</p>
                              <p className="text-sm mt-1.5">{report.afterPhotos.submittedBy}</p>
                            </div>
                          </div>

                          <Separator />

                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Submitted At</p>
                            <p className="text-sm">{formatDate(report.afterPhotos.submittedAt, 'MMM dd, yyyy HH:mm')}</p>
                          </div>

                          <Separator />

                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Action Notes</p>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{report.afterPhotos.notes}</p>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h3 className="text-lg font-semibold mb-4 text-green-700">After Photos</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {report.afterPhotos.photos && report.afterPhotos.photos.length > 0 ? (
                            report.afterPhotos.photos.map((photo, index) => (
                              <a
                                key={index}
                                href={photo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block group"
                              >
                                <LazyImage
                                  src={photo.url}
                                  alt={`After ${index + 1}`}
                                  className="w-full h-40 object-cover rounded-md border border-green-200 group-hover:opacity-80 transition-opacity cursor-pointer"
                                />
                              </a>
                            ))
                          ) : (
                            <div className="col-span-2 text-center py-8 text-muted-foreground">
                              <p className="text-sm">No photos available</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center text-muted-foreground py-12">
                        <div className="w-16 h-16 rounded-full bg-blue-50 mx-auto mb-4 flex items-center justify-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-8 h-8 text-blue-600"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                            />
                          </svg>
                        </div>
                        <p className="font-medium text-blue-700">No After Photos Yet</p>
                        <p className="text-sm mt-1">This report is still pending completion.</p>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
