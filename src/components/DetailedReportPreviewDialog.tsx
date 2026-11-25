import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type jsPDF from 'jspdf'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { HugeiconsIcon } from '@hugeicons/react'
import { Download01Icon, File02Icon } from '@hugeicons/core-free-icons'
import { toast } from '@/components/ui/sonner'
import type { Action } from '@/data/sampleActions'
import { generateDetailedReportPDF, type DetailedReportMeta } from '@/utils/generateDetailedReportPDF'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  concerns: Action[]
  meta: DetailedReportMeta
  fileName: string
}

type Topic = 'all' | 'quarry' | 'cutting'
const TOPICS: { key: Topic; label: string; desc: string }[] = [
  { key: 'all', label: 'All Reports', desc: 'Every report in the current filters' },
  { key: 'quarry', label: 'Quarry', desc: 'Reports with "quarry" in the title' },
  { key: 'cutting', label: 'Cutting', desc: 'Reports with "cutting" in the title' },
]
const matchTopic = (c: Action, t: Topic) => t === 'all' || (c.reportTitle || '').toLowerCase().includes(t)

export default function DetailedReportPreviewDialog({ open, onOpenChange, concerns: allConcerns, meta: baseMeta, fileName: baseFileName }: Props) {
  const [step, setStep] = useState<'select' | 'preview'>('select')
  const [topic, setTopic] = useState<Topic>('all')
  const concerns = allConcerns.filter(c => matchTopic(c, topic))
  const topicLabel = TOPICS.find(t => t.key === topic)!.label
  const meta = { ...baseMeta, title: topic === 'all' ? baseMeta.title : `${baseMeta.title} — ${topicLabel}` }
  const fileName = topic === 'all' ? baseFileName : baseFileName.replace('detailed_report', `${topic}_detailed_report`)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [failed, setFailed] = useState(false)
  const pdfRef = useRef<jsPDF | null>(null)

  useEffect(() => {
    if (!open || step !== 'preview') return
    let cancelled = false
    let url: string | null = null
    setIsGenerating(true)
    setFailed(false)
    generateDetailedReportPDF(concerns, meta)
      .then(doc => {
        if (cancelled) return
        pdfRef.current = doc
        url = URL.createObjectURL(doc.output('blob'))
        setPdfUrl(url)
      })
      .catch(err => {
        console.error('Detailed PDF error:', err)
        if (!cancelled) {
          setFailed(true)
          toast.error('Failed to generate report preview')
        }
      })
      .finally(() => !cancelled && setIsGenerating(false))

    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
      pdfRef.current = null
      setPdfUrl(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, topic])

  const handleDownload = () => {
    if (!pdfRef.current) return
    pdfRef.current.save(fileName)
    toast.success('Downloaded successfully!', { description: fileName })
  }

  const handleOpenChange = (o: boolean) => {
    if (!o) setStep('select')
    onOpenChange(o)
  }

  if (step === 'select') {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export Detailed PDF</DialogTitle>
            <DialogDescription>Choose which reports to include.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {TOPICS.map(t => {
              const n = allConcerns.filter(c => matchTopic(c, t.key)).length
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTopic(t.key)}
                  className={`w-full flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                    topic === t.key ? 'border-red-500 bg-red-50 dark:bg-red-950/30' : 'hover:bg-muted'
                  }`}
                >
                  <div>
                    <p className="font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                  <span className="text-sm font-semibold">{n}</span>
                </button>
              )
            })}
          </div>
          <Button
            disabled={concerns.length === 0}
            onClick={() => setStep('preview')}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            {concerns.length === 0 ? 'No matching reports' : `Generate Preview (${concerns.length})`}
          </Button>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[92vw] sm:max-w-[92vw] h-[92vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between gap-4 pr-8">
            <div>
              <DialogTitle>{meta.title} — Detailed Report</DialogTitle>
              <DialogDescription>
                Preview of {concerns.length} report(s) with concern photos, action taken photos, notes and status
              </DialogDescription>
            </div>
            <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('select')}>Change selection</Button>
            <Button onClick={handleDownload} disabled={!pdfUrl || isGenerating} className="bg-red-600 hover:bg-red-700 text-white">
              <HugeiconsIcon icon={Download01Icon} className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-900">
          {isGenerating ? (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-14 h-14 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4"
                />
                <p className="text-lg font-medium">Generating detailed report...</p>
                <p className="text-sm text-muted-foreground mt-2">Loading photos for {concerns.length} report(s)</p>
              </div>
            </div>
          ) : pdfUrl && !failed ? (
            <iframe src={pdfUrl} className="w-full h-full border-0" title="Detailed Report Preview" />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-center">
              <div>
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
