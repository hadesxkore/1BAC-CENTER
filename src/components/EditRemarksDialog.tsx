import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { toast } from '@/components/ui/sonner'

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
    } catch {
      toast.error('Failed to save remarks')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setRemarks(currentRemarks) }}>
      <DialogTrigger asChild>
        <button className="text-xs text-left w-full hover:bg-muted/50 rounded transition-colors cursor-pointer line-clamp-2 break-words">
          {currentRemarks || <span className="text-muted-foreground italic">Add remarks...</span>}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base">Remarks</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Type your remarks here..."
            rows={3}
            disabled={isSubmitting}
            className="text-sm"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
