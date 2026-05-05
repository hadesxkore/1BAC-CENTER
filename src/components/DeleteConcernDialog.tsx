import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { Delete02Icon } from '@hugeicons/core-free-icons'
import { db } from '@/config/firebase'
import { doc, deleteDoc } from 'firebase/firestore'
import { toast } from 'sonner'

interface DeleteConcernDialogProps {
  concernId: string
  concernTitle: string
  collectionName?: string
}

export function DeleteConcernDialog({ concernId, concernTitle, collectionName = 'concerns' }: DeleteConcernDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    
    try {
      await deleteDoc(doc(db, collectionName, concernId))
      
      toast.success('Concern Deleted', {
        description: 'The concern has been permanently removed',
      })
    } catch (error) {
      console.error('Error deleting concern:', error)
      toast.error('Failed to delete concern', {
        description: error instanceof Error ? error.message : 'Please try again'
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive">
          <HugeiconsIcon icon={Delete02Icon} className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the concern <strong className="text-foreground">"{concernTitle}"</strong> and all its data including photos and action taken. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
