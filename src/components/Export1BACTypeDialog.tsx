import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { FileDownloadIcon } from '@hugeicons/core-free-icons'

interface Export1BACTypeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExport: (type: 'overall' | 'per-district') => void
  isLoading: boolean
}

export default function Export1BACTypeDialog({
  open,
  onOpenChange,
  onExport,
  isLoading,
}: Export1BACTypeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Export 1BAC Summary Report</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Choose the type of summary report you want to generate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Button
              onClick={() => {
                onExport('overall')
                onOpenChange(false)
              }}
              disabled={isLoading}
              className="w-full h-auto py-4 bg-purple-600 hover:bg-purple-700 flex flex-col items-start gap-1"
            >
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={FileDownloadIcon} className="w-5 h-5" />
                <span className="font-semibold text-base">Overall Summary</span>
              </div>
              <span className="text-xs text-purple-100 font-normal">
                Combined data for all districts with overall statistics
              </span>
            </Button>

            <Button
              onClick={() => {
                onExport('per-district')
                onOpenChange(false)
              }}
              disabled={isLoading}
              className="w-full h-auto py-4 bg-indigo-600 hover:bg-indigo-700 flex flex-col items-start gap-1"
            >
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={FileDownloadIcon} className="w-5 h-5" />
                <span className="font-semibold text-base">Per District Summary</span>
              </div>
              <span className="text-xs text-indigo-100 font-normal">
                Detailed breakdown for each district with individual statistics
              </span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
