import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { HugeiconsIcon } from '@hugeicons/react'
import { GitCompareIcon } from '@hugeicons/core-free-icons'
import type { ActionRecord } from '@/data/sampleActions'
import { format } from 'date-fns'

interface ActionComparisonDialogProps {
  concernTitle: string
  actionHistory: ActionRecord[]
}

export function ActionComparisonDialog({ concernTitle, actionHistory }: ActionComparisonDialogProps) {
  const [open, setOpen] = useState(false)
  
  const pgoActions = actionHistory.filter(a => a.actionType === 'pgo')
  const deptActions = actionHistory.filter(a => a.actionType === 'department')
  
  const hasBothActions = pgoActions.length > 0 && deptActions.length > 0
  
  if (!hasBothActions) {
    return null // Don't show button if there's nothing to compare
  }
  
  // Get the latest of each type
  const latestPgo = pgoActions[pgoActions.length - 1]
  const latestDept = deptActions[deptActions.length - 1]
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HugeiconsIcon icon={GitCompareIcon} className="w-4 h-4 mr-2" />
          Compare Actions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[95vw] lg:max-w-6xl h-[85vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Action Comparison</DialogTitle>
          <DialogDescription>
            Comparing PGO and Department actions for: <strong className="text-foreground">{concernTitle}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-2 h-full divide-x">
            {/* LEFT SIDE - PGO ACTION */}
            <div className="h-full overflow-hidden">
              <div className="bg-purple-50 dark:bg-purple-950/20 px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🟣</span>
                  <div>
                    <h3 className="font-semibold text-sm">PGO Action</h3>
                    <p className="text-xs text-muted-foreground">
                      {pgoActions.length} action{pgoActions.length !== 1 ? 's' : ''} recorded
                    </p>
                  </div>
                </div>
              </div>
              
              <ScrollArea className="h-[calc(100%-60px)]">
                <div className="px-6 py-6 space-y-6">
                  {pgoActions.map((action, index) => (
                    <div key={action.actionId} className="space-y-4">
                      {index > 0 && <Separator />}
                      
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900">
                          PGO #{index + 1}
                        </Badge>
                        {index === pgoActions.length - 1 && (
                          <Badge className="bg-purple-600">Latest</Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Submitted By
                          </p>
                          <p className="text-sm mt-1.5">{action.submittedBy}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Submitted At
                          </p>
                          <p className="text-sm mt-1.5">
                            {format(new Date(action.submittedAt), 'MMM dd, yyyy HH:mm')}
                          </p>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                          Action Date
                        </p>
                        <p className="text-sm">
                          {action.actionDate === 'Ongoing' ? (
                            <Badge variant="outline" className="font-normal">Ongoing</Badge>
                          ) : (
                            format(new Date(action.actionDate), 'MMMM dd, yyyy')
                          )}
                        </p>
                      </div>

                      <Separator />

                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                          Action Notes
                        </p>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{action.notes}</p>
                      </div>

                      {action.otherInfo && (
                        <>
                          <Separator />
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                              Other Information
                            </p>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{action.otherInfo}</p>
                          </div>
                        </>
                      )}

                      {action.photos && action.photos.length > 0 && (
                        <>
                          <Separator />
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                              Action Photos ({action.photos.length})
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              {action.photos.map((photo, photoIndex) => (
                                photo.fileType === 'document' ? (
                                  <button
                                    key={photoIndex}
                                    onClick={() => window.open(photo.url, '_blank')}
                                    className="block group p-4 border rounded-md hover:bg-muted transition-colors cursor-pointer text-left"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950 rounded flex items-center justify-center flex-shrink-0">
                                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">{photo.fileName || 'Document'}</p>
                                        {photo.fileSize && (
                                          <p className="text-xs text-muted-foreground">
                                            {(photo.fileSize / 1024 / 1024).toFixed(2)} MB
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                ) : (
                                  <a
                                    key={photoIndex}
                                    href={photo.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block group"
                                  >
                                    <img
                                      src={photo.url}
                                      alt={`PGO Action ${photoIndex + 1}`}
                                      className="w-full h-32 object-cover rounded-md border group-hover:opacity-80 transition-opacity cursor-pointer"
                                      loading="lazy"
                                    />
                                  </a>
                                )
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* RIGHT SIDE - DEPARTMENT ACTION */}
            <div className="h-full overflow-hidden">
              <div className="bg-blue-50 dark:bg-blue-950/20 px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🏢</span>
                  <div>
                    <h3 className="font-semibold text-sm">Department Action</h3>
                    <p className="text-xs text-muted-foreground">
                      {deptActions.length} action{deptActions.length !== 1 ? 's' : ''} recorded
                    </p>
                  </div>
                </div>
              </div>
              
              <ScrollArea className="h-[calc(100%-60px)]">
                <div className="px-6 py-6 space-y-6">
                  {deptActions.map((action, index) => (
                    <div key={action.actionId} className="space-y-4">
                      {index > 0 && <Separator />}
                      
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900">
                          Department #{index + 1}
                        </Badge>
                        {index === deptActions.length - 1 && (
                          <Badge className="bg-blue-600">Latest</Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Submitted By
                          </p>
                          <p className="text-sm mt-1.5">{action.submittedBy}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Submitted At
                          </p>
                          <p className="text-sm mt-1.5">
                            {format(new Date(action.submittedAt), 'MMM dd, yyyy HH:mm')}
                          </p>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                          Action Date
                        </p>
                        <p className="text-sm">
                          {action.actionDate === 'Ongoing' ? (
                            <Badge variant="outline" className="font-normal">Ongoing</Badge>
                          ) : (
                            format(new Date(action.actionDate), 'MMMM dd, yyyy')
                          )}
                        </p>
                      </div>

                      <Separator />

                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                          Action Notes
                        </p>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{action.notes}</p>
                      </div>

                      {action.otherInfo && (
                        <>
                          <Separator />
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                              Other Information
                            </p>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{action.otherInfo}</p>
                          </div>
                        </>
                      )}

                      {action.photos && action.photos.length > 0 && (
                        <>
                          <Separator />
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                              Action Photos ({action.photos.length})
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              {action.photos.map((photo, photoIndex) => (
                                photo.fileType === 'document' ? (
                                  <button
                                    key={photoIndex}
                                    onClick={() => window.open(photo.url, '_blank')}
                                    className="block group p-4 border rounded-md hover:bg-muted transition-colors cursor-pointer text-left"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950 rounded flex items-center justify-center flex-shrink-0">
                                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">{photo.fileName || 'Document'}</p>
                                        {photo.fileSize && (
                                          <p className="text-xs text-muted-foreground">
                                            {(photo.fileSize / 1024 / 1024).toFixed(2)} MB
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                ) : (
                                  <a
                                    key={photoIndex}
                                    href={photo.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block group"
                                  >
                                    <img
                                      src={photo.url}
                                      alt={`Department Action ${photoIndex + 1}`}
                                      className="w-full h-32 object-cover rounded-md border group-hover:opacity-80 transition-opacity cursor-pointer"
                                      loading="lazy"
                                    />
                                  </a>
                                )
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
