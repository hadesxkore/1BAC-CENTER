import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { HugeiconsIcon } from '@hugeicons/react'
import { FileDownloadIcon } from '@hugeicons/core-free-icons'

interface ExportSummaryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExport: (category: 'agricultural' | 'environmental') => void
  isLoading?: boolean
}

export default function ExportSummaryDialog({
  open,
  onOpenChange,
  onExport,
  isLoading = false,
}: ExportSummaryDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState<'agricultural' | 'environmental' | ''>('')

  const handleExport = () => {
    if (selectedCategory) {
      onExport(selectedCategory as 'agricultural' | 'environmental')
      onOpenChange(false)
      setSelectedCategory('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Export Summary Report</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Select the category to generate a detailed summary report organized by district and status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="category" className="text-sm font-medium">
              Report Category
            </Label>
            <Select
              value={selectedCategory}
              onValueChange={(value) => setSelectedCategory(value as 'agricultural' | 'environmental')}
            >
              <SelectTrigger id="category" className="w-full">
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agricultural">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <span>Agricultural Concerns</span>
                  </div>
                </SelectItem>
                <SelectItem value="environmental">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span>Environmental Concerns</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedCategory && (
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-medium">Report will include:</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Overview and statistics</li>
                <li>• Data organized by district</li>
                <li>• Separated by status (Pending, In Progress, Completed)</li>
                <li>• Detailed concern listings</li>
              </ul>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              setSelectedCategory('')
            }}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={!selectedCategory || isLoading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <HugeiconsIcon icon={FileDownloadIcon} className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
