import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { HugeiconsIcon } from '@hugeicons/react'
import { File02Icon, Download01Icon } from '@hugeicons/core-free-icons'
import type { Action } from '@/data/sampleActions'
import { generatePGOReport } from '@/utils/generatePGOReport'
import { toast } from '@/components/ui/sonner'
import { motion } from 'framer-motion'
import type jsPDF from 'jspdf'

interface GeneratePGOReportDialogProps {
  concerns: Action[]
}

export function GeneratePGOReportDialog({ concerns }: GeneratePGOReportDialogProps) {
  const [open, setOpen] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  // Keep the generated jsPDF instance around so Download can reuse it
  // instead of re-running the whole report generation a second time.
  const pdfRef = useRef<jsPDF | null>(null)

  const pgoInvolvedConcerns = concerns.filter(c => c.pgoInvolved)

  const handleGenerate = async () => {
    if (pgoInvolvedConcerns.length === 0) {
      toast.error('No PGO-involved concerns found')
      return
    }

    setIsGenerating(true)
    try {
      const pdf = await generatePGOReport(pgoInvolvedConcerns)
      pdfRef.current = pdf
      const blob = pdf.output('blob')
      const url = URL.createObjectURL(blob)
      setPdfUrl(url)

      toast.success('PGO Report Generated!', {
        description: `${pgoInvolvedConcerns.length} concern(s) included`,
      })
    } catch (error) {
      console.error('Error generating PGO report:', error)
      toast.error('Failed to generate report', {
        description: error instanceof Error ? error.message : 'Please try again'
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = () => {
    // Reuse the PDF we already built for the preview — no need to
    // regenerate it (which was re-fetching every image again).
    if (!pdfRef.current) return

    try {
      const fileName = `PGO_Report_${new Date().toISOString().split('T')[0]}.pdf`
      pdfRef.current.save(fileName)

      toast.success('Downloaded successfully!', {
        description: fileName
      })
    } catch (error) {
      console.error('Error downloading:', error)
      toast.error('Failed to download')
    }
  }

  const handleOpenDialog = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      // Generate PDF when dialog opens
      handleGenerate()
    } else {
      // Cleanup
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
        setPdfUrl(null)
      }
      pdfRef.current = null
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenDialog}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-purple-500 text-purple-700 hover:bg-purple-50 dark:border-purple-400 dark:text-purple-300 dark:hover:bg-purple-950"
        >
          <HugeiconsIcon icon={File02Icon} className="mr-2 h-4 w-4" />
          Generate PGO Report
          {pgoInvolvedConcerns.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full text-xs font-semibold">
              {pgoInvolvedConcerns.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[90vw] h-[90vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>PGO Action Taken Report</DialogTitle>
              <DialogDescription>
                Preview and download PDF report for {pgoInvolvedConcerns.length} PGO-involved concern(s)
              </DialogDescription>
            </div>
            <Button
              onClick={handleDownload}
              disabled={!pdfUrl || isGenerating}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <HugeiconsIcon icon={Download01Icon} className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-900">
          {isGenerating ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"
                />
                <p className="text-lg font-medium">Generating PGO Report...</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Processing {pgoInvolvedConcerns.length} concern(s)
                </p>
              </div>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              title="PGO Report Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <HugeiconsIcon icon={File02Icon} className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Failed to generate preview</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}