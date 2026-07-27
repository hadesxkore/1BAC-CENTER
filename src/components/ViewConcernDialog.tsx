import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
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

/* ---------- small inline icons (kept dependency-free / theme-neutral) ---------- */

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4">
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path strokeLinecap="round" d="M16 2.5v4M8 2.5v4M3 9.5h18" />
    </svg>
  )
}
function LocationPinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.3" />
    </svg>
  )
}
function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.5 3 11.5l9.5 9.5L21 12.5V3.5h-9L12 2.5Z" />
      <circle cx="16" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}
function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4">
      <circle cx="12" cy="8" r="3.3" />
      <path strokeLinecap="round" d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" />
    </svg>
  )
}
function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.5 12.3 2.4 2.4 4.6-5.4" />
    </svg>
  )
}
function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3.5h9l3 3v14H6z" />
      <path strokeLinecap="round" d="M9 9h6M9 13h6M9 17h4" />
    </svg>
  )
}

/* ---------- lazy image ---------- */

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

/* ---------- shared layout primitives ---------- */

function SectionHeader({
  icon,
  title,
  right,
  className = '',
}: {
  icon?: React.ReactNode
  title: string
  right?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-center justify-between gap-3 border-b bg-muted/40 px-5 py-2.5 ${className}`}>
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">{title}</h3>
      </div>
      {right}
    </div>
  )
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="text-sm mt-0.5 break-words">{value}</div>
      </div>
    </div>
  )
}

/* ---------- numbered photo grid (matches the numbered-step look) ---------- */

function NumberedPhotoGrid({
  photos,
  accentClass,
}: {
  photos: ActionRecord['photos']
  accentClass: string
}) {
  const imagePhotos = (photos || []).filter(p => p.fileType !== 'document')
  const documentPhotos = (photos || []).filter(p => p.fileType === 'document')

  if (imagePhotos.length === 0 && documentPhotos.length === 0) return null

  return (
    <div className="space-y-3">
      {imagePhotos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {imagePhotos.map((photo, index) => (
            <div key={index} className="space-y-1.5">
              <a href={photo.url} target="_blank" rel="noopener noreferrer" className="relative block group">
                <span
                  className={`absolute left-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow ${accentClass}`}
                >
                  {index + 1}
                </span>
                <LazyImage
                  src={photo.url}
                  alt={`Photo ${index + 1}`}
                  className="h-28 w-full rounded-md border object-cover group-hover:opacity-80"
                />
              </a>
              <p className="truncate text-center text-[11px] text-muted-foreground">
                {photo.fileName || `Photo ${index + 1}`}
              </p>
            </div>
          ))}
        </div>
      )}

      {documentPhotos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {documentPhotos.map((photo, index) => (
            <button
              key={index}
              onClick={() => {
                const newWindow = window.open()
                if (newWindow) {
                  newWindow.document.write(`
                    <html>
                      <head>
                        <title>${photo.fileName || 'Document'}</title>
                        <style>body{margin:0;padding:0}iframe{width:100vw;height:100vh;border:none}</style>
                      </head>
                      <body><iframe src="${photo.url}"></iframe></body>
                    </html>
                  `)
                  newWindow.document.close()
                }
              }}
              className="flex items-center gap-3 rounded-md border p-3 text-left hover:bg-muted transition-colors"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-blue-50 dark:bg-blue-950">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{photo.fileName || 'Document'}</p>
                <p className="text-xs text-muted-foreground">
                  {photo.fileSize ? `${(photo.fileSize / 1024 / 1024).toFixed(2)} MB` : 'File'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- action card: header + numbered photos + details box ---------- */

function ActionCard({
  actionRecord,
  actionType,
}: {
  actionRecord: ActionRecord
  actionType: 'pgo' | 'department'
}) {
  const isPgo = actionType === 'pgo'
  const theme = isPgo
    ? {
        header: 'bg-purple-50 dark:bg-purple-950/25',
        text: 'text-purple-700 dark:text-purple-300',
        dot: 'bg-purple-600',
        emoji: '🟣',
      }
    : {
        header: 'bg-blue-50 dark:bg-blue-950/25',
        text: 'text-blue-700 dark:text-blue-300',
        dot: 'bg-blue-600',
        emoji: '🏢',
      }

  return (
    <div className="rounded-lg border overflow-hidden">
      <SectionHeader
        className={theme.header}
        icon={<span className="text-base leading-none">{theme.emoji}</span>}
        title={isPgo ? 'Action Taken by PGO Office' : 'Action Taken by Department'}
      />

      <div className="p-5 space-y-5">
        <NumberedPhotoGrid photos={actionRecord.photos} accentClass={theme.dot} />

        <div className="rounded-md border bg-muted/20 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <DetailItem
              icon={<CalendarIcon />}
              label="Date of Action"
              value={
                actionRecord.actionDate === 'Ongoing' ? (
                  <Badge variant="outline" className="font-normal">Ongoing</Badge>
                ) : (
                  format(new Date(actionRecord.actionDate), 'MMM dd, yyyy')
                )
              }
            />
            <DetailItem icon={<UserIcon />} label="Submitted By" value={actionRecord.submittedBy} />
            <DetailItem
              icon={<CheckCircleIcon />}
              label="Status"
              value={
                <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 font-normal">
                  Completed
                </Badge>
              }
            />
          </div>

          <Separator />

          <DetailItem
            icon={<NoteIcon />}
            label="Action Notes"
            value={<p className="whitespace-pre-wrap leading-relaxed">{actionRecord.notes}</p>}
          />

          {actionRecord.otherInfo && (
            <>
              <Separator />
              <DetailItem
                icon={<NoteIcon />}
                label="Other Information"
                value={<p className="whitespace-pre-wrap leading-relaxed">{actionRecord.otherInfo}</p>}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- main dialog ---------- */

export function ViewConcernDialog({ action }: ViewConcernDialogProps) {
  const pgoActions = action.actionHistory?.filter(a => a.actionType === 'pgo') || []
  const deptActions = action.actionHistory?.filter(a => a.actionType === 'department') || []

  const hasPgoAction = pgoActions.length > 0
  const hasDeptAction = deptActions.length > 0

  const latestPgo = hasPgoAction ? pgoActions[pgoActions.length - 1] : null
  const latestDept = hasDeptAction ? deptActions[deptActions.length - 1] : null

  const hasLegacyAction = !hasPgoAction && !hasDeptAction && action.actionTaken
  const legacyActionRecord = hasLegacyAction
    ? {
        actionId: 'legacy',
        actionType: 'department' as const,
        photos: action.actionTaken!.photos,
        notes: action.actionTaken!.notes,
        otherInfo: action.actionTaken!.otherInfo,
        submittedBy: action.actionTaken!.submittedBy,
        submittedAt: action.actionTaken!.submittedAt,
        actionDate: action.actionDate || format(new Date(), 'yyyy-MM-dd'),
      }
    : null

  const hasAnyAction = hasPgoAction || hasDeptAction || hasLegacyAction

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start">
          <HugeiconsIcon icon={ViewIcon} className="mr-2 h-4 w-4" />
          View
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[95vw] sm:max-w-3xl h-[90vh] p-0 flex flex-col gap-0">
        {/* Dialog header stays as the identity/status bar */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
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

        {/* Everything below scrolls as one continuous page of stacked sections */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="px-6 py-6 space-y-6">
              {/* SECTION 1: Concern Details */}
              <div className="rounded-lg border overflow-hidden">
                <SectionHeader title="Concern Details" />
                <div className="p-5 grid gap-6 md:grid-cols-[220px_1fr]">
                  {/* Concern photos */}
                  <div className="grid grid-cols-2 gap-2 self-start">
                    {action.concernPhotos.map((photo, index) => (
                      <a key={index} href={photo.url} target="_blank" rel="noopener noreferrer" className="block group">
                        <LazyImage
                          src={photo.url}
                          alt={`Concern ${index + 1}`}
                          className="h-24 w-full rounded-md border object-cover group-hover:opacity-80"
                        />
                      </a>
                    ))}
                  </div>

                  {/* Concern info */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <DetailItem
                        icon={<CalendarIcon />}
                        label="Date Reported"
                        value={format(new Date(action.dateReported), 'MMM dd, yyyy')}
                      />
                      <DetailItem
                        icon={<CalendarIcon />}
                        label="Date Uploaded"
                        value={format(new Date(action.dateUploaded), 'MMM dd, yyyy HH:mm')}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <DetailItem icon={<LocationPinIcon />} label="Location" value={`${action.location}, ${action.municipality}`} />
                      <DetailItem icon={<TagIcon />} label="Type of Concern" value={<span className="capitalize">{action.category}</span>} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <DetailItem icon={<UserIcon />} label="Reported By" value={action.reportedBy} />
                      <DetailItem icon={<UserIcon />} label="Assigned To" value={action.assignedTo} />
                    </div>

                    <Separator />

                    <DetailItem
                      icon={<NoteIcon />}
                      label="Case Remarks"
                      value={<p className="whitespace-pre-wrap leading-relaxed">{action.caseRemarks}</p>}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2+: Action cards, stacked full-width */}
              {hasDeptAction && <ActionCard actionRecord={latestDept!} actionType="department" />}
              {hasPgoAction && <ActionCard actionRecord={latestPgo!} actionType="pgo" />}
              {hasLegacyAction && <ActionCard actionRecord={legacyActionRecord!} actionType="department" />}

              {!hasAnyAction && (
                <div className="rounded-lg border overflow-hidden">
                  <SectionHeader title="Action Taken" />
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center text-muted-foreground">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                        <NoteIcon />
                      </div>
                      <p className="font-medium">No Action Taken Yet</p>
                      <p className="mt-1 text-sm">This concern is still pending action.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}