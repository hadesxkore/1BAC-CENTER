import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { HugeiconsIcon } from '@hugeicons/react'
import { CheckmarkCircle02Icon } from '@hugeicons/core-free-icons'
import { db } from '@/config/firebase'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { toast } from '@/components/ui/sonner'

interface MarkAsCompletedDialogProps {
  concernId: string
  concernTitle: string
  collectionName?: string
}

export function MarkAsCompletedDialog({ 
  concernId, 
  concernTitle, 
  collectionName = 'concerns' 
}: MarkAsCompletedDialogProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleMarkAsCompleted = async () => {
    setIsUpdating(true)
    
    try {
      const concernRef = doc(db, collectionName, concernId)
      await updateDoc(concernRef, {
        status: 'closed',
        updatedAt: serverTimestamp(),
      })
      
      toast.success('Status Updated', {
        description: 'Concern closed successfully',
      })
      
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status', {
        description: error instanceof Error ? error.message : 'Please try again'
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="w-4 h-4 mr-2" />
          Mark as Closed
        </DropdownMenuItem>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Close this concern?</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark the concern as closed. No further action can be taken.
            <div className="mt-2 p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium text-foreground">{concernTitle}</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" disabled={isUpdating}>
            Cancel
          </Button>
          <Button onClick={handleMarkAsCompleted} disabled={isUpdating}>
            {isUpdating ? (
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full"
                />
                <span>Closing...</span>
              </div>
            ) : (
              <>
                <HugeiconsIcon icon={CheckmarkCircle02Icon} className="w-4 h-4 mr-2" />
                Close Concern
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}