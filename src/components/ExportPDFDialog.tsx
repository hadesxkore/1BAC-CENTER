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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'

interface ExportPDFDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  totalCount: number
  onExport: (selectedStatuses: string[], dateFrom?: Date, dateTo?: Date) => void
}

const STATUS_GROUPS = [
  { value: 'pending', label: 'Pending' },
  { value: 'under-action', label: 'Under Action' },
  { value: 'completed', label: 'Completed' },
  { value: 'unlocated', label: 'Unlocated' },
] as const

export default function ExportPDFDialog({
  open,
  onOpenChange,
  totalCount,
  onExport,
}: ExportPDFDialogProps) {
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      setSelectedStatuses(STATUS_GROUPS.map((s) => s.value))
    } else {
      setSelectedStatuses([])
    }
  }

  const handleStatusToggle = (value: string, checked: boolean) => {
    const updated = checked
      ? [...selectedStatuses, value]
      : selectedStatuses.filter((s) => s !== value)
    setSelectedStatuses(updated)
    setSelectAll(updated.length === STATUS_GROUPS.length)
  }

  const handleExport = () => {
    onExport(
      selectedStatuses.length > 0 ? selectedStatuses : ['all'],
      dateFrom,
      dateTo
    )
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Export PDF Report</DialogTitle>
          <DialogDescription>
            Set a date range and select statuses to include ({totalCount} total records).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Date Range */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground font-medium">
              Date Range (by Date Reported)
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">From</Label>
                <DatePicker
                  date={dateFrom}
                  onDateChange={setDateFrom}
                  placeholder="Start date"
                />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <DatePicker
                  date={dateTo}
                  onDateChange={setDateTo}
                  placeholder="End date"
                />
              </div>
            </div>
          </div>

          {/* Statuses */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground font-medium">
              Status Groups
            </Label>
            <div className="flex items-center gap-3">
              <Checkbox
                id="select-all"
                checked={selectAll}
                onCheckedChange={(checked) => handleSelectAll(checked === true)}
              />
              <Label htmlFor="select-all" className="font-medium cursor-pointer text-sm">
                All Statuses
              </Label>
            </div>
            <div className="border-t pt-3 space-y-3 pl-1">
              {STATUS_GROUPS.map((status) => (
                <div key={status.value} className="flex items-center gap-3">
                  <Checkbox
                    id={`status-${status.value}`}
                    checked={selectedStatuses.includes(status.value)}
                    onCheckedChange={(checked) =>
                      handleStatusToggle(status.value, checked === true)
                    }
                  />
                  <Label
                    htmlFor={`status-${status.value}`}
                    className="cursor-pointer text-sm"
                  >
                    {status.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport}>
            Export PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
