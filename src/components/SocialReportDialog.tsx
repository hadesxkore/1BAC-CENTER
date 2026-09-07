import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Download01Icon,
  Copy01Icon,
  Share01Icon,
  CheckmarkCircle01Icon,
  Location01Icon,
  Calendar01Icon,
  SparklesIcon,
} from '@hugeicons/core-free-icons'
import type { Action, ConcernImage } from '@/data/sampleActions'
import { format } from 'date-fns'
import { toast } from '@/components/ui/sonner'
import { toPng, toBlob } from 'html-to-image'
import html2canvas from 'html2canvas'
import logo1 from '@/assets/logo1.png'
import logo2 from '@/assets/logo2.png'

interface SocialReportDialogProps {
  concern: Action | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ThemePreset = 'navy' | 'minimal' | 'emerald' | 'dark'

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  resolved: { label: 'RESOLVED', bg: 'bg-emerald-600', text: 'text-white', icon: '✓' },
  completed: { label: 'COMPLETED', bg: 'bg-emerald-600', text: 'text-white', icon: '✓' },
  closed: { label: 'RESOLVED & CLOSED', bg: 'bg-emerald-700', text: 'text-white', icon: '✓' },
  'under-action': { label: 'ACTION IN PROGRESS', bg: 'bg-amber-500', text: 'text-white', icon: '⚡' },
  'in-progress': { label: 'ACTION IN PROGRESS', bg: 'bg-amber-500', text: 'text-white', icon: '⚡' },
  pending: { label: 'UNDER VERIFICATION', bg: 'bg-blue-600', text: 'text-white', icon: '⏳' },
  unlocated: { label: 'FOR LOCATION', bg: 'bg-slate-600', text: 'text-white', icon: '📍' },
}

export function SocialReportDialog({ concern, open, onOpenChange }: SocialReportDialogProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [theme, setTheme] = useState<ThemePreset>('navy')
  const [selectedConcernPhotoIndex, setSelectedConcernPhotoIndex] = useState<number>(0)
  const [selectedActionPhotoIndex, setSelectedActionPhotoIndex] = useState<number>(0)
  const [showCaseRemarks, setShowCaseRemarks] = useState<boolean>(true)
  const [showFooterWatermark, setShowFooterWatermark] = useState<boolean>(true)
  const [showCoordinates, setShowCoordinates] = useState<boolean>(true)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [isCopied, setIsCopied] = useState<boolean>(false)
  const [isCaptionCopied, setIsCaptionCopied] = useState<boolean>(false)
  const [cachedImages, setCachedImages] = useState<Record<string, string>>({})
  const [isLoadingImages, setIsLoadingImages] = useState<boolean>(false)

  // Extract photos
  const concernPhotos = useMemo(() => concern?.concernPhotos || [], [concern])
  
  const actionPhotos = useMemo(() => {
    if (!concern) return []
    const deptActions = concern.actionHistory?.filter(a => a.actionType === 'department') || []
    const legacyAction = !deptActions.length && concern.actionTaken ? concern.actionTaken : null
    const deptRecord = deptActions[deptActions.length - 1] || legacyAction
    const pgoActions = concern.actionHistory?.filter(a => a.actionType === 'pgo') || []
    const pgoRecord = pgoActions[pgoActions.length - 1]

    const allActionImgs: ConcernImage[] = []
    if (deptRecord?.photos) {
      allActionImgs.push(...deptRecord.photos.filter(p => p.fileType !== 'document'))
    }
    if (pgoRecord?.photos) {
      allActionImgs.push(...pgoRecord.photos.filter(p => p.fileType !== 'document'))
    }
    return allActionImgs
  }, [concern])

  // Get action details text
  const actionDetails = useMemo(() => {
    if (!concern) return null
    const deptActions = concern.actionHistory?.filter(a => a.actionType === 'department') || []
    const pgoActions = concern.actionHistory?.filter(a => a.actionType === 'pgo') || []
    const latestDept = deptActions[deptActions.length - 1]
    const latestPgo = pgoActions[pgoActions.length - 1]
    const legacyAction = concern.actionTaken

    const notes = latestPgo?.notes || latestDept?.notes || legacyAction?.notes || ''
    const otherInfo = latestPgo?.otherInfo || latestDept?.otherInfo || legacyAction?.otherInfo || ''
    const agency = concern.pgoInvolved 
      ? 'Provincial Government of Bataan & Partner Agencies' 
      : (concern.answeredBy || concern.assignedTo || '1BAC Action Team')
    const actionDate = latestPgo?.actionDate || latestDept?.actionDate || concern.actionDate || null

    return { notes, otherInfo, agency, actionDate }
  }, [concern])

  // Preload and convert all image URLs to base64 Data URLs to guarantee clean canvas exports with no CORS issues
  useEffect(() => {
    if (!open || !concern) return

    let isMounted = true
    setIsLoadingImages(true)

    const urlsToCache: string[] = [logo1, logo2]
    concernPhotos.forEach(p => { if (p.url) urlsToCache.push(p.url) })
    actionPhotos.forEach(p => { if (p.url) urlsToCache.push(p.url) })

    const convertToBase64 = async (url: string): Promise<string> => {
      try {
        const response = await fetch(url, { mode: 'cors' })
        if (!response.ok) throw new Error('Network response not ok')
        const blob = await response.blob()
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
      } catch (e) {
        return url
      }
    }

    Promise.all(
      urlsToCache.map(async url => {
        const b64 = await convertToBase64(url)
        return { url, b64 }
      })
    ).then(results => {
      if (!isMounted) return
      const map: Record<string, string> = {}
      results.forEach(r => { map[r.url] = r.b64 })
      setCachedImages(map)
      setIsLoadingImages(false)
    }).catch(() => {
      if (isMounted) setIsLoadingImages(false)
    })

    return () => { isMounted = false }
  }, [open, concern, concernPhotos, actionPhotos])

  if (!concern) return null

  const activeConcernPhoto = concernPhotos[selectedConcernPhotoIndex] || concernPhotos[0]
  const activeActionPhoto = actionPhotos[selectedActionPhotoIndex] || actionPhotos[0]
  const statusInfo = STATUS_CONFIG[concern.status] || STATUS_CONFIG['under-action']

  // Auto-generate official social media caption
  const socialCaption = `📢 [1BAC ACTION UPDATE | PUBLIC INFORMATION OFFICE]

📌 SUBJECT: ${concern.reportTitle}
📍 LOCATION: ${concern.location}, ${concern.municipality}
🏷️ CATEGORY: ${concern.category ? concern.category.toUpperCase() : 'PUBLIC CONCERN'}
🔖 STATUS: ${statusInfo.label}

${concern.caseRemarks ? `📝 CONCERN DETAILS:\n${concern.caseRemarks}\n\n` : ''}${actionDetails?.notes ? `✅ ACTION TAKEN & RESOLUTION:\n${actionDetails.notes}\n` : ''}${actionDetails?.otherInfo ? `ℹ️ ADDITIONAL INFO:\n${actionDetails.otherInfo}\n` : ''}
🏛️ Implementing Agency: ${actionDetails?.agency || '1BAC Action Team'}
📅 Date Logged: ${format(new Date(concern.dateReported || concern.createdAt), 'MMMM dd, yyyy')}

#1Bataan #1BACActionCenter #SerbisyongMayMalasakit #BataanPIO #LalawiganNgBataan #CitizenFirst`

  // High-Resolution Export Handler
  const generateCanvasImage = async (formatType: 'blob' | 'dataUrl' = 'dataUrl') => {
    if (!cardRef.current) throw new Error('Card ref not found')
    
    try {
      if (formatType === 'blob') {
        const blob = await toBlob(cardRef.current, {
          quality: 0.98,
          pixelRatio: 2.5,
          cacheBust: true,
        })
        if (blob) return blob
      } else {
        const dataUrl = await toPng(cardRef.current, {
          quality: 0.98,
          pixelRatio: 2.5,
          cacheBust: true,
        })
        return dataUrl
      }
    } catch (err) {
      console.warn('html-to-image fallback to html2canvas', err)
      const canvas = await html2canvas(cardRef.current, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: null,
      })
      if (formatType === 'blob') {
        return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
      }
      return canvas.toDataURL('image/png')
    }
  }

  const handleDownload = async () => {
    setIsExporting(true)
    try {
      const dataUrl = await generateCanvasImage('dataUrl') as string
      if (!dataUrl) throw new Error('Failed to generate image data')

      const link = document.createElement('a')
      const cleanTitle = concern.reportTitle.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)
      const dateStr = format(new Date(), 'yyyyMMdd_HHmm')
      link.download = `PIO_POST_${concern.municipality}_${cleanTitle}_${dateStr}.png`
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('Social Graphic Downloaded!', {
        description: 'High-resolution PNG generated ready for PIO social media posting.',
      })
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Failed to download graphic. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleCopyToClipboard = async () => {
    setIsExporting(true)
    try {
      const blob = await generateCanvasImage('blob') as Blob
      if (!blob) throw new Error('Failed to create image blob')

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ])

      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2500)
      toast.success('Image Copied to Clipboard!', {
        description: 'You can now paste (Ctrl+V) directly into Facebook, Viber, or Messenger.',
      })
    } catch (error) {
      console.error('Clipboard error:', error)
      toast.error('Could not copy image to clipboard. Use Download instead.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(socialCaption)
    setIsCaptionCopied(true)
    setTimeout(() => setIsCaptionCopied(false), 2500)
    toast.success('Social Media Caption Copied!', {
      description: 'Post caption with official hashtags is copied to your clipboard.',
    })
  }

  // Theme styling definitions
  const getThemeStyles = () => {
    switch (theme) {
      case 'navy':
        return {
          wrapper: 'bg-gradient-to-b from-[#091834] via-[#0d2248] to-[#061024] text-white border-blue-900/50',
          headerBg: 'bg-[#102a58]/95 border-blue-400/30',
          titleColor: 'text-white',
          subtitleColor: 'text-blue-200/80',
          cardBg: 'bg-white/10 text-white border-white/15',
          actionCardBg: 'bg-gradient-to-r from-blue-950 to-indigo-950 text-white border-blue-500/40',
          actionAccent: 'text-cyan-300',
          badgeTheme: 'bg-blue-600/40 text-blue-100 border-blue-400/40',
          footerBg: 'border-white/15 text-blue-200/70',
        }
      case 'minimal':
        return {
          wrapper: 'bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900 border-slate-300 shadow-2xl',
          headerBg: 'bg-white border-slate-300 shadow-xs',
          titleColor: 'text-slate-950',
          subtitleColor: 'text-slate-600',
          cardBg: 'bg-slate-100 text-slate-900 border-slate-200',
          actionCardBg: 'bg-slate-900 text-white border-slate-800 shadow-md',
          actionAccent: 'text-blue-400',
          badgeTheme: 'bg-slate-200 text-slate-800 border-slate-300',
          footerBg: 'border-slate-300 text-slate-600',
        }
      case 'emerald':
        return {
          wrapper: 'bg-gradient-to-b from-[#042f1f] via-[#063d2a] to-[#021d13] text-white border-emerald-900/50',
          headerBg: 'bg-[#0a4d35]/95 border-emerald-400/30',
          titleColor: 'text-white',
          subtitleColor: 'text-emerald-200/80',
          cardBg: 'bg-white/10 text-white border-white/15',
          actionCardBg: 'bg-gradient-to-r from-emerald-950 to-teal-950 text-white border-emerald-500/40',
          actionAccent: 'text-emerald-300',
          badgeTheme: 'bg-emerald-600/40 text-emerald-100 border-emerald-400/40',
          footerBg: 'border-white/15 text-emerald-200/70',
        }
      case 'dark':
        return {
          wrapper: 'bg-gradient-to-b from-[#090d16] via-[#111827] to-[#05070c] text-white border-slate-800 shadow-2xl',
          headerBg: 'bg-slate-900/95 border-slate-700/80',
          titleColor: 'text-white',
          subtitleColor: 'text-slate-400',
          cardBg: 'bg-slate-900/80 text-white border-slate-800',
          actionCardBg: 'bg-gradient-to-r from-slate-950 to-blue-950 text-white border-blue-600/40',
          actionAccent: 'text-cyan-400',
          badgeTheme: 'bg-slate-800 text-slate-200 border-slate-700',
          footerBg: 'border-slate-800 text-slate-400',
        }
    }
  }

  const themeStyles = getThemeStyles()
  const hasBothPhotos = !!activeConcernPhoto && !!activeActionPhoto

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-6xl w-full h-[92vh] max-h-[92vh] p-0 flex flex-col gap-0 overflow-hidden bg-background">
        
        {/* Modal Header */}
        <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between space-y-0 bg-muted/40 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-blue-600 text-white">
                <HugeiconsIcon icon={Share01Icon} className="w-4 h-4" />
              </span>
              <DialogTitle className="text-base sm:text-lg font-bold">
                PIO Social Media Report Graphic Generator
              </DialogTitle>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 text-xs hidden sm:inline-flex">
                Official PIO Standard
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Generate a high-resolution, modern minimalist social media graphic for Public Information Office posting.
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyToClipboard}
              disabled={isExporting || isLoadingImages}
              className="h-9 px-3 text-xs font-medium cursor-pointer"
            >
              <HugeiconsIcon icon={isCopied ? CheckmarkCircle01Icon : Copy01Icon} className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
              {isCopied ? 'Copied Image!' : 'Copy Image'}
            </Button>
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={isExporting || isLoadingImages}
              className="h-9 px-4 text-xs font-semibold bg-[#1a3a6b] hover:bg-[#122a4f] text-white shadow-sm cursor-pointer"
            >
              <HugeiconsIcon icon={Download01Icon} className="w-4 h-4 mr-1.5" />
              {isExporting ? 'Generating...' : 'Download PNG'}
            </Button>
          </div>
        </DialogHeader>

        {/* Content Body: Split layout with Left Controls and Right Live Preview */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-0">
          
          {/* LEFT: Controls & Customization Panel (5 cols) */}
          <div className="lg:col-span-5 border-r bg-muted/10 p-5 overflow-y-auto space-y-4">
            
            {/* Theme Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                1. Visual Theme & Style
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'navy', name: '1BAC Executive', color: 'from-[#091834] to-[#0d2248]', border: 'border-blue-700' },
                  { id: 'minimal', name: 'Clean Editorial', color: 'from-slate-100 to-white', border: 'border-slate-300' },
                  { id: 'emerald', name: 'Eco Nature', color: 'from-[#042f1f] to-[#063d2a]', border: 'border-emerald-700' },
                  { id: 'dark', name: 'Obsidian Dark', color: 'from-slate-900 to-black', border: 'border-slate-700' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id as ThemePreset)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                      theme === t.id
                        ? 'border-primary bg-primary/10 font-semibold ring-1 ring-primary'
                        : 'border-border bg-card hover:bg-muted/60'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full bg-gradient-to-br ${t.color} border ${t.border} shrink-0`} />
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Photo Selectors */}
            <div className="space-y-3 p-3.5 rounded-lg border bg-card/60">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>2. Featured Photographic Evidence</span>
                <span className="text-[11px] font-normal lowercase text-muted-foreground">
                  {concernPhotos.length} concern / {actionPhotos.length} action
                </span>
              </Label>

              {/* Concern Photo Selector */}
              {concernPhotos.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium text-muted-foreground">Concern Photo (Before):</div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {concernPhotos.map((photo, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedConcernPhotoIndex(idx)}
                        className={`relative w-14 h-14 rounded-md overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                          selectedConcernPhotoIndex === idx
                            ? 'border-blue-600 ring-2 ring-blue-500/40 scale-95'
                            : 'border-border opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={photo.url} alt={`Concern ${idx + 1}`} className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] px-1 font-mono">
                          #{idx + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Photo Selector */}
              {actionPhotos.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium text-muted-foreground">Action Photo (After):</div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {actionPhotos.map((photo, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedActionPhotoIndex(idx)}
                        className={`relative w-14 h-14 rounded-md overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                          selectedActionPhotoIndex === idx
                            ? 'border-emerald-600 ring-2 ring-emerald-500/40 scale-95'
                            : 'border-border opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={photo.url} alt={`Action ${idx + 1}`} className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] px-1 font-mono">
                          #{idx + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Display Toggles */}
            <div className="space-y-2.5 p-3.5 rounded-lg border bg-card/60">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                3. Layout & Content Options
              </Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs">Show Citizen Remarks</span>
                  <Switch checked={showCaseRemarks} onCheckedChange={setShowCaseRemarks} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Show Geographic Coordinates</span>
                  <Switch checked={showCoordinates} onCheckedChange={setShowCoordinates} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Include Official Footer Watermark</span>
                  <Switch checked={showFooterWatermark} onCheckedChange={setShowFooterWatermark} />
                </div>
              </div>
            </div>

            {/* Social Caption Helper */}
            <div className="space-y-2 p-3.5 rounded-lg border bg-card/60">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <HugeiconsIcon icon={SparklesIcon} className="w-3.5 h-3.5 text-amber-500" />
                  Social Media Caption
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyCaption}
                  className="h-7 text-xs text-blue-600 hover:text-blue-700 px-2 cursor-pointer"
                >
                  <HugeiconsIcon icon={isCaptionCopied ? CheckmarkCircle01Icon : Copy01Icon} className="w-3 h-3 mr-1" />
                  {isCaptionCopied ? 'Copied' : 'Copy Text'}
                </Button>
              </div>
              <textarea
                readOnly
                value={socialCaption}
                className="w-full h-20 p-2 text-[11px] rounded border bg-muted/40 font-mono text-muted-foreground resize-none leading-relaxed focus:outline-hidden"
              />
            </div>

          </div>

          {/* RIGHT: Live Interactive Social Media Canvas Preview (7 cols) */}
          <div className="lg:col-span-7 bg-slate-950 p-4 md:p-6 overflow-y-auto flex flex-col items-center justify-start min-h-0">
            
            <div className="text-xs text-slate-400 mb-3 flex items-center gap-2 self-center shrink-0">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Graphic Canvas Preview (High-Resolution 600px Standard)
            </div>

            {/* THE SOCIAL GRAPHIC CARD (Clean, generous, never clipped) */}
            <div
              ref={cardRef}
              className={`w-full max-w-[580px] ${themeStyles.wrapper} rounded-2xl border p-5 md:p-6 flex flex-col gap-4 shadow-2xl font-sans select-none shrink-0`}
              style={{
                boxSizing: 'border-box',
              }}
            >
              
              {/* Top Bar / Government Branding Header */}
              <div className={`flex items-center justify-between p-3 rounded-xl ${themeStyles.headerBg} border gap-2`}>
                
                {/* Left: Official Logos & Seal */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={cachedImages[logo1] || logo1}
                    alt="1Bataan Logo"
                    className="h-10 w-auto object-contain shrink-0"
                    crossOrigin="anonymous"
                  />
                  <img
                    src={cachedImages[logo2] || logo2}
                    alt="Bataan Seal"
                    className="h-10 w-auto object-contain shrink-0"
                    crossOrigin="anonymous"
                  />
                  <div className="border-l border-white/20 pl-2.5 leading-tight min-w-0">
                    <div className="text-xs font-black uppercase tracking-wider truncate">
                      1BAC ACTION CENTER
                    </div>
                    <div className="text-[9.5px] opacity-80 font-medium truncate">
                      Provincial Government of Bataan
                    </div>
                  </div>
                </div>

                {/* Right: Status Pill & Reference Code */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1 shadow-sm ${statusInfo.bg} ${statusInfo.text}`}>
                    <span>{statusInfo.icon}</span>
                    <span>{statusInfo.label}</span>
                  </div>
                  <div className="text-[9px] font-mono opacity-75">
                    ID: #{concern.id.slice(0, 8).toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Report Main Title & Location Strip */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${themeStyles.badgeTheme} border`}>
                    {concern.category ? concern.category.toUpperCase() : 'GENERAL CONCERN'}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-950/50 border border-amber-500/40 px-2 py-0.5 rounded-md">
                    <HugeiconsIcon icon={Location01Icon} className="w-3 h-3 shrink-0" />
                    {concern.municipality}
                  </span>
                  <span className="text-[10px] opacity-80 ml-auto flex items-center gap-1 font-medium">
                    <HugeiconsIcon icon={Calendar01Icon} className="w-3 h-3 shrink-0" />
                    {format(new Date(concern.dateReported || concern.createdAt), 'MMMM dd, yyyy')}
                  </span>
                </div>

                <h3 className={`text-lg md:text-xl font-black leading-tight tracking-tight ${themeStyles.titleColor}`}>
                  {concern.reportTitle}
                </h3>

                {/* Location snippet */}
                <div className="text-xs opacity-90 leading-snug flex items-start gap-1">
                  <span className="font-bold shrink-0">Location:</span>
                  <span>{concern.location}</span>
                </div>

                {showCoordinates && concern.coordinates && (
                  <div className="text-[10px] font-mono opacity-70 flex items-center gap-1">
                    <span>Coordinates:</span>
                    <span>{concern.coordinates}</span>
                  </div>
                )}

                {showCaseRemarks && concern.caseRemarks && (
                  <div className={`p-2.5 rounded-lg ${themeStyles.cardBg} text-xs italic opacity-95 border leading-relaxed`}>
                    &quot;{concern.caseRemarks}&quot;
                  </div>
                )}
              </div>

              {/* Middle Section: Side-by-Side Before & After Photographic Evidence */}
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest opacity-80 flex items-center justify-between">
                  <span>Photographic Documentation</span>
                  <span className="text-[9px] font-normal opacity-70">Official Verification Records</span>
                </div>

                {hasBothPhotos ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Before / Concern Photo */}
                    <div className="relative rounded-xl overflow-hidden border border-white/20 bg-black/40 h-44 shadow-md">
                      <img
                        src={cachedImages[activeConcernPhoto.url] || activeConcernPhoto.url}
                        alt="Concern Before"
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-red-600/90 text-white text-[9px] font-extrabold tracking-wider shadow-sm">
                        BEFORE • CITIZEN REPORT
                      </div>
                    </div>

                    {/* After / Action Taken Photo */}
                    <div className="relative rounded-xl overflow-hidden border border-emerald-500/40 bg-black/40 h-44 shadow-md">
                      <img
                        src={cachedImages[activeActionPhoto.url] || activeActionPhoto.url}
                        alt="Action Taken After"
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-emerald-600/90 text-white text-[9px] font-extrabold tracking-wider shadow-sm">
                        AFTER • ACTION TAKEN
                      </div>
                    </div>
                  </div>
                ) : activeConcernPhoto || activeActionPhoto ? (
                  <div className="relative rounded-xl overflow-hidden border border-white/20 bg-black/40 h-48 shadow-md">
                    <img
                      src={
                        activeActionPhoto
                          ? (cachedImages[activeActionPhoto.url] || activeActionPhoto.url)
                          : (cachedImages[activeConcernPhoto.url] || activeConcernPhoto.url)
                      }
                      alt="Evidence Photo"
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-blue-600/90 text-white text-[9px] font-extrabold tracking-wider shadow-sm">
                      {activeActionPhoto ? 'ACTION TAKEN EVIDENCE' : 'CONCERN DOCUMENTATION'}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/20 p-4 text-center text-xs opacity-60">
                    No photo documentation attached
                  </div>
                )}
              </div>

              {/* Action Taken Resolution Card */}
              <div className={`p-3.5 rounded-xl ${themeStyles.actionCardBg} border shadow-lg space-y-2`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className={`text-[11px] font-black uppercase tracking-wider ${themeStyles.actionAccent}`}>
                      Government Response & Resolution
                    </span>
                  </div>
                  {actionDetails?.actionDate && (
                    <span className="text-[10px] opacity-80 font-mono">
                      Acted: {actionDetails.actionDate}
                    </span>
                  )}
                </div>

                <div className="text-xs leading-relaxed opacity-95">
                  {actionDetails?.notes || 'Action verified and processed under standard 1BAC provincial operational protocol.'}
                </div>

                <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] opacity-85">
                  <span>Implementing Agency: <strong>{actionDetails?.agency}</strong></span>
                  {concern.answeredBy && <span>Officer: {concern.answeredBy}</span>}
                </div>
              </div>

              {/* Bottom Official Watermark Banner */}
              {showFooterWatermark && (
                <div className={`pt-2 border-t flex items-center justify-between text-[9.5px] ${themeStyles.footerBg}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold">1BAC ACTION HOTLINE</span>
                    <span>•</span>
                    <span>1Bataan Serbisyong May Malasakit</span>
                  </div>
                  <div className="font-bold uppercase tracking-wider opacity-90">
                    PUBLIC INFORMATION OFFICE (PIO)
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
