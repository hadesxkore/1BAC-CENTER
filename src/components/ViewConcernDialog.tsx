import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { HugeiconsIcon } from '@hugeicons/react'
import { ViewIcon } from '@hugeicons/core-free-icons'
import type { Action } from '@/data/sampleActions'
import { format } from 'date-fns'

interface ViewConcernDialogProps {
  action: Action
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  unlocated: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  'under-action': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
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

export function ViewConcernDialog({ action }: ViewConcernDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start">
          <HugeiconsIcon icon={ViewIcon} className="mr-2 h-4 w-4" />
          View
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[95vw] lg:max-w-7xl h-[90vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-2xl pr-8">{action.reportTitle}</DialogTitle>
              <DialogDescription className="mt-1">
                Tracking No: {action.trackingNo || action.id}
              </DialogDescription>
            </div>
            <Badge variant="outline" className={statusColors[action.status]}>
              {action.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-2 h-full divide-x">
            {/* LEFT SIDE - CONCERN DETAILS */}
            <div className="h-full overflow-hidden">
              <ScrollArea className="h-full">
                <div className="px-6 py-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Concern Details</h3>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date Reported</p>
                          <p className="text-sm mt-1.5">{format(new Date(action.dateReported), 'MMMM dd, yyyy')}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date Uploaded</p>
                          <p className="text-sm mt-1.5">{format(new Date(action.dateUploaded), 'MMM dd, yyyy HH:mm')}</p>
                        </div>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Municipality</p>
                          <p className="text-sm mt-1.5">{action.municipality}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</p>
                          <p className="text-sm mt-1.5 capitalize">{action.category}</p>
                        </div>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assigned To</p>
                          <p className="text-sm mt-1.5">{action.assignedTo}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reported By</p>
                          <p className="text-sm mt-1.5">{action.reportedBy}</p>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Location</p>
                        <p className="text-sm">{action.location}</p>
                      </div>

                      <Separator />

                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Case Remarks</p>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{action.caseRemarks}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Concern Photos */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Concern Photos</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {action.concernPhotos.map((photo, index) => (
                        <a
                          key={index}
                          href={photo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block group"
                        >
                          <LazyImage
                            src={photo.url}
                            alt={`Concern ${index + 1}`}
                            className="w-full h-40 object-cover rounded-md border group-hover:opacity-80 transition-opacity cursor-pointer"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>

            {/* RIGHT SIDE - ACTION TAKEN */}
            <div className="h-full overflow-hidden">
              <ScrollArea className="h-full">
                <div className="px-6 py-6 space-y-6">
                  {action.actionTaken ? (
                    <>
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Action Taken</h3>
                        
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Submitted By</p>
                              <p className="text-sm mt-1.5">{action.actionTaken.submittedBy}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Submitted At</p>
                              <p className="text-sm mt-1.5">
                                {format(new Date(action.actionTaken.submittedAt), 'MMM dd, yyyy HH:mm')}
                              </p>
                            </div>
                          </div>

                          <Separator />

                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Action Notes</p>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{action.actionTaken.notes}</p>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h3 className="text-lg font-semibold mb-4">Action Files</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {action.actionTaken.photos.map((photo, index) => (
                            photo.fileType === 'document' ? (
                              <button
                                key={index}
                                onClick={() => {
                                  // Open base64 document in new window
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
                                className="block group p-4 border rounded-md hover:bg-muted transition-colors cursor-pointer text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950 rounded flex items-center justify-center flex-shrink-0">
                                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{photo.fileName || 'Document'}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {photo.fileSize ? `${(photo.fileSize / 1024 / 1024).toFixed(2)} MB` : 'File'}
                                    </p>
                                  </div>
                                  <svg className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </div>
                              </button>
                            ) : (
                              <a
                                key={index}
                                href={photo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block group"
                              >
                                <LazyImage
                                  src={photo.url}
                                  alt={`Action ${index + 1}`}
                                  className="w-full h-40 object-cover rounded-md border group-hover:opacity-80 transition-opacity cursor-pointer"
                                />
                              </a>
                            )
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center text-muted-foreground py-12">
                        <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-8 h-8"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
                            />
                          </svg>
                        </div>
                        <p className="font-medium">No Action Taken Yet</p>
                        <p className="text-sm mt-1">This concern is still pending action.</p>
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
