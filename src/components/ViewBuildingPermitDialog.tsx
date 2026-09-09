import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { HugeiconsIcon } from '@hugeicons/react'
import { ViewIcon } from '@hugeicons/core-free-icons'
import { format } from 'date-fns'

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
  status: 'pending' | 'for-validation' | 'completed'
  reportedBy: string
  createdAt: string
}

interface ViewBuildingPermitDialogProps {
  report: BuildingPermitReport
}

const statusColors = {
  pending: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'for-validation': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
}

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

function formatDate(dateString: string | undefined | null, formatStr: string): string {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString
    return format(date, formatStr)
  } catch {
    return dateString || 'N/A'
  }
}

export function ViewBuildingPermitDialog({ report }: ViewBuildingPermitDialogProps) {
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
              <div className="flex items-center gap-2 mb-1">
                <Badge className={statusColors[report.status] || 'bg-gray-100 text-gray-800'}>
                  {report.status.toUpperCase()}
                </Badge>
                <span className="text-xs text-muted-foreground">ID: {report.id}</span>
              </div>
              <DialogTitle className="text-xl font-bold">{report.reportTitle}</DialogTitle>
              <DialogDescription className="text-sm mt-1">
                {report.municipality} • Reported on {formatDate(report.dateReported, 'MMMM dd, yyyy')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6">
          <div className="space-y-6">
            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/30 border">
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Municipality</span>
                <span className="text-sm font-semibold">{report.municipality}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Location</span>
                <span className="text-sm font-semibold">{report.location || 'N/A'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Reported By</span>
                <span className="text-sm font-semibold">{report.reportedBy}</span>
              </div>
            </div>

            {report.remarks && (
              <div className="p-4 rounded-lg bg-muted/20 border">
                <span className="text-xs text-muted-foreground block font-medium mb-1">Remarks & Details</span>
                <p className="text-sm whitespace-pre-wrap">{report.remarks}</p>
              </div>
            )}

            <Separator />

            {/* Photos Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Before Photos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-base flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    Before Photos ({report.beforePhotos.length})
                  </h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {report.beforePhotos.map((photo, index) => (
                    <div key={index} className="aspect-square rounded-lg overflow-hidden border bg-muted group relative">
                      <LazyImage
                        src={photo.url}
                        alt={`Before ${index + 1}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* After Photos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-base flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    After Photos ({report.afterPhotos?.photos.length || 0})
                  </h4>
                  {report.afterPhotos?.actionDate && (
                    <span className="text-xs text-muted-foreground">
                      Action Date: {formatDate(report.afterPhotos.actionDate, 'MMM dd, yyyy')}
                    </span>
                  )}
                </div>

                {report.afterPhotos && report.afterPhotos.photos.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {report.afterPhotos.photos.map((photo, index) => (
                        <div key={index} className="aspect-square rounded-lg overflow-hidden border bg-muted group relative">
                          <LazyImage
                            src={photo.url}
                            alt={`After ${index + 1}`}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                        </div>
                      ))}
                    </div>
                    {report.afterPhotos.notes && (
                      <div className="p-3 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
                        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 block mb-0.5">
                          Resolution / Compliance Notes:
                        </span>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">
                          {report.afterPhotos.notes}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 rounded-lg border-2 border-dashed text-center">
                    <p className="text-sm font-medium text-muted-foreground">No After Photos uploaded yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Pending verification or resolution compliance</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
