import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { toast } from '@/components/ui/sonner'

const STATUS_LABELS: Record<string, string> = {
  'under-action': 'Under Action',
  resolved: 'Resolved',
  closed: 'Closed',
  completed: 'Completed',
  pending: 'Pending',
  'in-progress': 'In Progress',
  unlocated: 'Unlocated',
}

const statusColors: Record<string, string> = {
  'under-action': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300 cursor-pointer hover:opacity-80',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 cursor-pointer hover:opacity-80',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 cursor-pointer hover:opacity-80',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 cursor-pointer hover:opacity-80',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 cursor-pointer hover:opacity-80',
  'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 cursor-pointer hover:opacity-80',
  unlocated: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 cursor-pointer hover:opacity-80',
}

interface UpdateStatusDialogProps {
  concernId: string
  currentStatus: string
  collectionName?: string
  withCompleted?: boolean
}

export function UpdateStatusDialog({
  concernId,
  currentStatus,
  collectionName = '1bac_concerns',
  withCompleted = false,
}: UpdateStatusDialogProps) {
  const [open, setOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleUpdate = async (newStatus: string) => {
    setIsUpdating(true)
    try {
      const ref = doc(db, collectionName, concernId)
      await updateDoc(ref, { status: newStatus, updatedAt: serverTimestamp() })
      toast.success(`Status updated to ${STATUS_LABELS[newStatus] || newStatus}`)
      setOpen(false)
    } catch {
      toast.error('Failed to update status')
    } finally {
      setIsUpdating(false)
    }
  }

  const allStatuses = [
    { value: 'under-action', label: 'Under Action', className: 'text-orange-700 hover:bg-orange-50' },
    { value: 'in-progress', label: 'In Progress', className: 'text-blue-700 hover:bg-blue-50' },
    { value: 'resolved', label: 'Resolved', className: 'text-green-700 hover:bg-green-50' },
    { value: 'closed', label: 'Closed', className: 'text-gray-700 hover:bg-gray-50' },
    ...(withCompleted ? [{ value: 'completed' as const, label: 'Completed', className: 'text-green-700 hover:bg-green-50' }] : []),
    { value: 'pending', label: 'Pending', className: 'text-yellow-700 hover:bg-yellow-50' },
    { value: 'unlocated', label: 'Unlocated', className: 'text-gray-700 hover:bg-gray-50' },
  ]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className={`${statusColors[currentStatus] || ''} select-none`}
        >
          {STATUS_LABELS[currentStatus] || currentStatus}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start" side="bottom">
        <div className="flex flex-col gap-0.5">
          {allStatuses
            .filter((s) => s.value !== currentStatus)
            .map((s) => (
              <Button
                key={s.value}
                variant="ghost"
                size="sm"
                className={`justify-start h-8 text-sm font-normal ${s.className}`}
                onClick={() => handleUpdate(s.value)}
                disabled={isUpdating}
              >
                {s.label}
              </Button>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}