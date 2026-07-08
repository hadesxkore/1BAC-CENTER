import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

interface CoordinatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  location: string
  reportTitle: string
  onSave: (coordText?: string) => void
}

export default function CoordinatesDialog({
  open,
  onOpenChange,
  location,
  reportTitle,
  onSave,
}: CoordinatesDialogProps) {
  const [coordText, setCoordText] = useState('')
  const [noCoords, setNoCoords] = useState(false)

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setCoordText('')
      setNoCoords(false)
    }
    onOpenChange(val)
  }

  const handleSave = () => {
    if (noCoords) {
      onSave()
      handleOpenChange(false)
      return
    }
    onSave(coordText.trim())
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Location Coordinates</DialogTitle>
          <DialogDescription className="space-y-1">
            <div className="line-clamp-2">{location}</div>
            <div className="italic opacity-70 line-clamp-1">{reportTitle}</div>
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Label className="text-xs">Coordinates</Label>
          <Input
            value={coordText}
            onChange={(e) => setCoordText(e.target.value)}
            placeholder={`14°35'08.1"N 120°35'18.7"E`}
            className="h-9 mt-1.5"
            disabled={noCoords}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Enter coordinates in any format (decimal, DMS, etc.)
          </p>
        </div>
        <div className="flex items-center gap-2 -mt-1">
          <Checkbox
            id="no-coords"
            checked={noCoords}
            onCheckedChange={(checked) => setNoCoords(checked === true)}
          />
          <Label htmlFor="no-coords" className="text-xs cursor-pointer">
            No coordinates available
          </Label>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {noCoords ? 'Confirm' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
