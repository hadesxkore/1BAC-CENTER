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

interface DeletePNPReportDialogProps {
  reportId: string
  reportTitle: string
}

export function DeletePNPReportDialog({ reportId, reportTitle }: DeletePNPReportDialogProps) {
  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'pnp_reports', reportId))
      toast.success('Report Deleted Successfully!', {
        description: 'The report has been removed',
      })
    } catch (error) {
      console.error('Error deleting report:', error)
      toast.error('Failed to delete report', {
        description: error instanceof Error ? error.message : 'Please try again'
      })
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50">
          <HugeiconsIcon icon={Delete02Icon} className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the report <strong>"{reportTitle}"</strong>. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-red-600 hover:bg-red-700"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
