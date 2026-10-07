import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  SparklesIcon,
  Copy01Icon,
  Tick01Icon,
  Share01Icon,
  FilterIcon,
  AlertCircleIcon,
} from '@hugeicons/core-free-icons'
import { format, parseISO, isValid } from 'date-fns'
import { BATAAN_DISTRICTS } from '@/data/municipalities'
import { toast } from '@/components/ui/sonner'

export interface SummaryItem {
  id: string
  location: string
  reportTitle: string
  dateReported: string
  municipality: string
  status: string
  category?: string
}

interface GenerateMessengerSummaryDialogProps {
  concerns: SummaryItem[]
  selectedRowIds?: Record<string, boolean>
  buttonText?: string
  dialogTitle?: string
  dialogSubtitle?: string
  defaultIntroText?: string
  defaultDistrict?: string
  showCategoryFilter?: boolean
}

// Helper to determine district from municipality name
const getDistrict = (muni: string): 'District I' | 'District II' | 'District III' | 'Other' => {
  if (!muni) return 'Other'
  const m = muni.trim().toLowerCase()
  if (BATAAN_DISTRICTS['Second District'].some((d) => d.toLowerCase() === m)) return 'District II'
  if (BATAAN_DISTRICTS['First District'].some((d) => d.toLowerCase() === m)) return 'District I'
  if (BATAAN_DISTRICTS['Third District'].some((d) => d.toLowerCase() === m)) return 'District III'
  return 'Other'
}

const DISTRICT_HEADERS: Record<string, { title: string; subtitle: string }> = {
  'District II': {
    title: 'DISTRICT II',
    subtitle: '(Balanga City, Orion, Pilar, Limay)',
  },
  'District I': {
    title: 'DISTRICT I',
    subtitle: '(Abucay, Orani, Samal, Hermosa)',
  },
  'District III': {
    title: 'DISTRICT III',
    subtitle: '(Bagac, Dinalupihan, Mariveles, Morong)',
  },
  all: {
    title: 'ALL DISTRICTS - PROVINCE OF BATAAN',
    subtitle: '(District I, District II, District III)',
  },
}

export function GenerateMessengerSummaryDialog({
  concerns,
  selectedRowIds = {},
  buttonText = 'GC Pending Summary',
  dialogTitle = 'Messenger Group Chat Summary Generator',
  dialogSubtitle = 'Generate formatted status announcements ready to copy and forward directly to Messenger group chats.',
  defaultIntroText = 'Magandang umaga po sa ating lahat! Paalala lang po regarding sa mga reported cases na kailangan nating ma-monitor at ma-follow up:',
  defaultDistrict = 'District II',
  showCategoryFilter = true,
}: GenerateMessengerSummaryDialogProps) {
  const [open, setOpen] = useState(false)
  const [districtFilter, setDistrictFilter] = useState<string>(defaultDistrict)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [useSelectedOnly, setUseSelectedOnly] = useState<boolean>(false)

  // Message template customization
  const [greeting, setGreeting] = useState('Good morning po, @everyone! 🌞')
  const [introText, setIntroText] = useState(defaultIntroText)
  const [closingText, setClosingText] = useState(
    'Kindly check and follow up po ang mga areas na ito and provide updates once completed.\n\nMaraming salamat po sa inyong cooperation and continuous support! 🙏\nMagandang araw po sa ating lahat! 🌿'
  )

  // Track excluded item IDs (rather than syncing included IDs via useEffect to prevent re-render loops)
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)
  const [editedSummaryText, setEditedSummaryText] = useState<string | null>(null)

  const selectedRowsCount = useMemo(() => {
    return Object.keys(selectedRowIds).filter((k) => selectedRowIds[k]).length
  }, [selectedRowIds])

  // Filter eligible concerns based on drop-down criteria
  const eligibleConcerns = useMemo(() => {
    return concerns.filter((item) => {
      // Row selection override
      if (useSelectedOnly && selectedRowsCount > 0) {
        if (!selectedRowIds[item.id]) return false
      }

      // District filter
      if (districtFilter !== 'all') {
        const itemDistrict = getDistrict(item.municipality)
        if (itemDistrict !== districtFilter) return false
      }

      // Status filter
      if (statusFilter === 'pending' && item.status !== 'pending') return false
      if (statusFilter === 'under-action' && item.status !== 'under-action' && item.status !== 'in-progress') return false
      if (statusFilter === 'for-validation' && item.status !== 'for-validation') return false
      if (
        statusFilter === 'pending-or-action' &&
        item.status !== 'pending' &&
        item.status !== 'under-action' &&
        item.status !== 'in-progress' &&
        item.status !== 'for-validation'
      ) return false

      // Category filter (if enabled)
      if (showCategoryFilter && categoryFilter !== 'all' && item.category && item.category !== categoryFilter) {
        return false
      }

      return true
    })
  }, [concerns, districtFilter, statusFilter, categoryFilter, showCategoryFilter, useSelectedOnly, selectedRowIds, selectedRowsCount])

  // Items included in the final text
  const selectedItems = useMemo(() => {
    return eligibleConcerns.filter((c) => !excludedIds.has(c.id))
  }, [eligibleConcerns, excludedIds])

  // Auto-set useSelectedOnly if table rows were selected when opening dialog
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      setExcludedIds(new Set())
      if (selectedRowsCount > 0) {
        setUseSelectedOnly(true)
      } else {
        setUseSelectedOnly(false)
      }
      setEditedSummaryText(null)
      setCopied(false)
    }
  }

  // Format single date string cleanly
  const formatDate = (dateStr: string) => {
    try {
      if (!dateStr) return 'N/A'
      const parsed = parseISO(dateStr)
      if (isValid(parsed)) return format(parsed, 'MMMM d, yyyy')
      const fallback = new Date(dateStr)
      if (isValid(fallback)) return format(fallback, 'MMMM d, yyyy')
      return dateStr
    } catch {
      return dateStr
    }
  }

  // Generated message string
  const autoGeneratedText = useMemo(() => {
    const headerInfo = DISTRICT_HEADERS[districtFilter] || {
      title: districtFilter.toUpperCase(),
      subtitle: '',
    }

    let text = `${greeting}\n\n`
    text += `${headerInfo.title}\n`
    if (headerInfo.subtitle) {
      text += `${headerInfo.subtitle}\n`
    }
    text += `\n${introText}\n\n`

    if (selectedItems.length === 0) {
      text += `[No pending items matched the selected filters]\n\n`
    } else {
      selectedItems.forEach((item) => {
        const formattedDate = formatDate(item.dateReported)
        text += `📍 ${item.location} – ${item.reportTitle}\n`
        text += `📅 Date Reported: ${formattedDate}\n\n`
      })
    }

    text += `${closingText}`

    return text
  }, [greeting, districtFilter, introText, closingText, selectedItems])

  // Final display text (edited or auto)
  const finalSummaryText = editedSummaryText !== null ? editedSummaryText : autoGeneratedText

  const toggleSelectAll = () => {
    if (excludedIds.size === 0) {
      // Exclude all
      setExcludedIds(new Set(eligibleConcerns.map((c) => c.id)))
    } else {
      // Include all
      setExcludedIds(new Set())
    }
    setEditedSummaryText(null)
  }

  const toggleItem = (id: string) => {
    const next = new Set(excludedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setExcludedIds(next)
    setEditedSummaryText(null)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(finalSummaryText)
    setCopied(true)
    toast.success('Summary copied to clipboard!', {
      description: 'Ready to paste into your Messenger Group Chat.',
    })
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700/60 dark:hover:bg-emerald-900/60 font-medium cursor-pointer shadow-sm transition-all"
        >
          <HugeiconsIcon icon={SparklesIcon} className="w-4 h-4 mr-1.5 text-emerald-600 dark:text-emerald-400" />
          {buttonText}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-6xl w-[94vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-6 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white border-b border-emerald-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-white">
                <HugeiconsIcon icon={Share01Icon} className="w-5 h-5 text-emerald-200" />
                {dialogTitle}
              </DialogTitle>
              <DialogDescription className="text-xs text-emerald-100">
                {dialogSubtitle}
              </DialogDescription>
            </div>
            {selectedRowsCount > 0 && (
              <Badge className="bg-white/20 text-white hover:bg-white/30 border-none px-3 py-1">
                {selectedRowsCount} item(s) selected in table
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50 dark:bg-slate-950">
          {/* Left Column: Controls & Item Selection */}
          <div className="lg:col-span-5 space-y-4">
            {/* Filter Settings Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3.5 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <HugeiconsIcon icon={FilterIcon} className="w-3.5 h-3.5 text-emerald-600" />
                Filter Options
              </h3>

              {selectedRowsCount > 0 && (
                <div className="flex items-center space-x-2 bg-emerald-50 dark:bg-emerald-950/50 p-2.5 rounded-md border border-emerald-200 dark:border-emerald-800/60">
                  <Checkbox
                    id="useSelected"
                    checked={useSelectedOnly}
                    onCheckedChange={(checked) => {
                      setUseSelectedOnly(!!checked)
                      setEditedSummaryText(null)
                    }}
                  />
                  <Label htmlFor="useSelected" className="text-xs font-medium cursor-pointer text-emerald-900 dark:text-emerald-200">
                    Use only table checked rows ({selectedRowsCount})
                  </Label>
                </div>
              )}

              {/* District Filter */}
              <div className="space-y-1">
                <Label className="text-xs font-medium">District Filter</Label>
                <Select value={districtFilter} onValueChange={(v) => { setDistrictFilter(v); setEditedSummaryText(null); }}>
                  <SelectTrigger className="h-8 text-xs bg-slate-50 dark:bg-slate-800/50">
                    <SelectValue placeholder="Select District" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="District II">District II (Balanga, Orion, Pilar, Limay)</SelectItem>
                    <SelectItem value="District I">District I (Abucay, Hermosa, Orani, Samal)</SelectItem>
                    <SelectItem value="District III">District III (Bagac, Dinalupihan, Mariveles, Morong)</SelectItem>
                    <SelectItem value="all">All Districts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status & Category Filters */}
              <div className={showCategoryFilter ? "grid grid-cols-2 gap-2" : "space-y-1"}>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Status</Label>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setEditedSummaryText(null); }}>
                    <SelectTrigger className="h-8 text-xs bg-slate-50 dark:bg-slate-800/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending Only</SelectItem>
                      <SelectItem value="for-validation">For Validation Only</SelectItem>
                      <SelectItem value="under-action">Under Action Only</SelectItem>
                      <SelectItem value="pending-or-action">Pending & Under Action/Validation</SelectItem>
                      <SelectItem value="all">All Statuses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {showCategoryFilter && (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Category</Label>
                    <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setEditedSummaryText(null); }}>
                      <SelectTrigger className="h-8 text-xs bg-slate-50 dark:bg-slate-800/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="environmental">Environmental</SelectItem>
                        <SelectItem value="agricultural">Agricultural</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Custom Messages Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Message Customization
              </h3>
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Header Greeting</Label>
                <Input
                  value={greeting}
                  onChange={(e) => {
                    setGreeting(e.target.value)
                    setEditedSummaryText(null)
                  }}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Intro Message</Label>
                <Textarea
                  value={introText}
                  onChange={(e) => {
                    setIntroText(e.target.value)
                    setEditedSummaryText(null)
                  }}
                  rows={2}
                  className="text-xs min-h-[50px] resize-none"
                />
              </div>
            </div>

            {/* Included Concerns Checkbox List */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Items to Include ({selectedItems.length} / {eligibleConcerns.length})
                </h3>
                {eligibleConcerns.length > 0 && (
                  <Button variant="ghost" size="xs" onClick={toggleSelectAll} className="h-6 text-[11px] px-2">
                    {excludedIds.size === 0 ? 'Deselect All' : 'Select All'}
                  </Button>
                )}
              </div>

              {eligibleConcerns.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 border border-dashed rounded-md bg-slate-50 dark:bg-slate-800/30">
                  <HugeiconsIcon icon={AlertCircleIcon} className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                  No items match the current filter options.
                </div>
              ) : (
                <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1">
                  {eligibleConcerns.map((item) => {
                    const isIncluded = !excludedIds.has(item.id)
                    return (
                      <label
                        key={item.id}
                        className={`flex items-start gap-2.5 p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                          isIncluded
                            ? 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/60'
                            : 'bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-800 opacity-60'
                        }`}
                      >
                        <Checkbox
                          checked={isIncluded}
                          onCheckedChange={() => toggleItem(item.id)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                            📍 {item.location}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">{item.reportTitle}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Live Formatted Message Preview */}
          <div className="lg:col-span-7 flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Messenger Group Chat Preview (Editable)
              </Label>
              <span className="text-[11px] text-slate-400">
                Directly edit text before copying if needed
              </span>
            </div>

            <div className="flex-1 flex flex-col relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-sm">
              <Textarea
                value={finalSummaryText}
                onChange={(e) => setEditedSummaryText(e.target.value)}
                className="w-full h-full min-h-[360px] flex-1 font-sans text-xs sm:text-sm leading-relaxed p-3 bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-md resize-none focus-visible:ring-emerald-500"
                placeholder="Message preview will appear here..."
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('https://www.messenger.com', '_blank')}
              className="text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              <HugeiconsIcon icon={Share01Icon} className="w-3.5 h-3.5 mr-1.5" />
              Open Messenger
            </Button>

            <Button
              onClick={handleCopy}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 shadow-md transition-all"
            >
              <HugeiconsIcon icon={copied ? Tick01Icon : Copy01Icon} className="w-4 h-4 mr-1.5" />
              {copied ? 'Copied to Clipboard!' : 'Copy Summary to Clipboard'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
