import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { HugeiconsIcon } from '@hugeicons/react'
import { ViewIcon } from '@hugeicons/core-free-icons'
import type { Action, ActionRecord } from '@/data/sampleActions'
import { format } from 'date-fns'

interface ViewConcernDialogProps {
  action: Action
}

const STATUS_LABELS: Record<string, string> = {
  'under-action': 'Under Action',
  resolved: 'Resolved',
  closed: 'Closed',
  completed: 'Closed',
}
const statusColors: Record<string, string> = {
  'under-action': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  pending: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  'in-progress': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  unlocated: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
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

// Action Details View Component
function ActionDetailsView({ actionRecord, actionType }: { actionRecord: ActionRecord; actionType: 'pgo' | 'department' }) {
  const bgColor = actionType === 'pgo' ? 'bg-purple-50 dark:bg-purple-950/20' : 'bg-blue-50 dark:bg-blue-950/20'
  const icon = actionType === 'pgo' ? '🟣' : '🏢'
  const label = actionType === 'pgo' ? 'PGO Action' : 'Department Action'
  
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className={`${bgColor} px-6 py-3 border-b flex-shrink-0`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <div>
            <h3 className="font-semibold text-sm">{label}</h3>
            <p className="text-xs text-muted-foreground">
              Latest action details
            </p>
          </div>
        </div>
      </div>
      
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="px-6 py-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Action Information</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Submitted By</p>
                    <p className="text-sm mt-1.5">{actionRecord.submittedBy}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Submitted At</p>
                    <p className="text-sm mt-1.5">
                      {format(new Date(actionRecord.submittedAt), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Action Date</p>
                  <p className="text-sm">
                    {actionRecord.actionDate === 'Ongoing' ? (
                      <Badge variant="outline" className="font-normal">Ongoing</Badge>
                    ) : (
                      format(new Date(actionRecord.actionDate), 'MMMM dd, yyyy')
                    )}
                  </p>
                </div>

                <Separator />

                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Action Notes</p>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{actionRecord.notes}</p>
                </div>

                {actionRecord.otherInfo && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Other Information</p>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{actionRecord.otherInfo}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {actionRecord.photos && actionRecord.photos.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold mb-4">Action Files</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {actionRecord.photos.map((photo, index) => (
                      photo.fileType === 'document' ? (
                        <button
                          key={index}
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
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

export function ViewConcernDialog({ action }: ViewConcernDialogProps) {
  // Extract action history by type
  const pgoActions = action.actionHistory?.filter(a => a.actionType === 'pgo') || []
  const deptActions = action.actionHistory?.filter(a => a.actionType === 'department') || []
  
  const hasPgoAction = pgoActions.length > 0
  const hasDeptAction = deptActions.length > 0
  const hasBothActions = hasPgoAction && hasDeptAction
  
  // Get latest action of each type
  const latestPgo = hasPgoAction ? pgoActions[pgoActions.length - 1] : null
  const latestDept = hasDeptAction ? deptActions[deptActions.length - 1] : null
  
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
              <div className="flex items-center gap-2">
                <DialogTitle className="text-2xl">{action.reportTitle}</DialogTitle>
                {action.pgoInvolved && (
                  <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                    <span className="mr-1">🟣</span>
                    PGO Involved
                  </Badge>
                )}
              </div>
              <DialogDescription className="mt-1">
                Tracking No: {action.trackingNo || action.id}
              </DialogDescription>
              {action.actionHistory && action.actionHistory.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {action.actionHistory.length} action{action.actionHistory.length !== 1 ? 's' : ''} recorded
                  </span>
                  {hasPgoAction && (
                    <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-xs">
                      🟣 {pgoActions.length} PGO
                    </Badge>
                  )}
                  {hasDeptAction && (
                    <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs">
                      🏢 {deptActions.length} Dept
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <Badge variant="outline" className={statusColors[action.status]}>
              {STATUS_LABELS[action.status] || action.status}
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
            <div className="h-full overflow-hidden flex flex-col">
              {/* If both action types exist, show tabs */}
              {hasBothActions ? (
                <Tabs defaultValue="pgo" className="h-full flex flex-col">
                  <div className="border-b px-6 pt-4 flex-shrink-0">
                    <TabsList variant="line">
                      <TabsTrigger value="pgo">
                        <span className="mr-1.5">🟣</span>
                        PGO Action
                      </TabsTrigger>
                      <TabsTrigger value="department">
                        <span className="mr-1.5">🏢</span>
                        Department Action
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <TabsContent value="pgo" className="flex-1 m-0 h-0">
                    <ActionDetailsView actionRecord={latestPgo!} actionType="pgo" />
                  </TabsContent>
                  
                  <TabsContent value="department" className="flex-1 m-0 h-0">
                    <ActionDetailsView actionRecord={latestDept!} actionType="department" />
                  </TabsContent>
                </Tabs>
              ) : hasPgoAction || hasDeptAction ? (
                /* If only one action type exists, show it directly without tabs */
                <ActionDetailsView 
                  actionRecord={(latestPgo || latestDept)!} 
                  actionType={hasPgoAction ? 'pgo' : 'department'} 
                />
              ) : (
                /* No actions yet */
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
