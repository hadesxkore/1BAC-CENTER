import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { toast } from '@/components/ui/sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import { Edit02Icon } from '@hugeicons/core-free-icons'

interface EditRemarksDialogProps {
  concernId: string
  concernTitle: string
  currentRemarks?: string
  collectionName?: string
}

export function EditRemarksDialog({ concernId, concernTitle, currentRemarks = '', collectionName = '1bac_concerns' }: EditRemarksDialogProps) {
  const [open, setOpen] = useState(false)
  const [remarks, setRemarks] = useState(currentRemarks)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSave = async () => {
    setIsSubmitting(true)
    try {
      const ref = doc(db, collectionName, concernId)
      await updateDoc(ref, { remarks })
      toast.success('Remarks saved')
      setOpen(false)
    } catch (err) {
      toast.error('Failed to save remarks')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setRemarks(currentRemarks) }}>
      <DialogTrigger asChild>
        <button className="text-xs text-left w-full hover:bg-muted/50 rounded p-1 -m-1 transition-colors cursor-pointer line-clamp-2 break-words">
          {currentRemarks || <span className="text-muted-foreground italic">Add remarks...</span>}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remarks</DialogTitle>
          <DialogDescription>{concernTitle}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Type your remarks here..."
            rows={5}
            disabled={isSubmitting}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
