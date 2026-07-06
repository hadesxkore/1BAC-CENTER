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

interface CoordinatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  location: string
  reportTitle: string
  onSave: (lat: number, lng: number) => void
}

export default function CoordinatesDialog({
  open,
  onOpenChange,
  location,
  reportTitle,
  onSave,
}: CoordinatesDialogProps) {
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [error, setError] = useState('')

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setLat('')
      setLng('')
      setError('')
    }
    onOpenChange(val)
  }

  const handleSave = () => {
    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)
    if (isNaN(latNum) || isNaN(lngNum)) {
      setError('Enter valid numeric coordinates')
      return
    }
    if (latNum < -90 || latNum > 90) {
      setError('Latitude must be between -90 and 90')
      return
    }
    if (lngNum < -180 || lngNum > 180) {
      setError('Longitude must be between -180 and 180')
      return
    }
    setError('')
    onSave(latNum, lngNum)
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Location Coordinates</DialogTitle>
          <DialogDescription className="space-y-1">
            <div className="line-clamp-2">{location}</div>
            <div className="italic opacity-70 line-clamp-1">{reportTitle}</div>
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Latitude</Label>
            <Input
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="14.6760"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Longitude</Label>
            <Input
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="120.9762"
              className="h-9"
            />
          </div>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Skip
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
