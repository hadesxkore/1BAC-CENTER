import React, { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Download01Icon,
  Folder01Icon,
  Image01Icon,
  CheckmarkCircle01Icon,
  Location01Icon,
  Calendar01Icon,
  Cancel01Icon,
  RefreshIcon,
} from '@hugeicons/core-free-icons'
import type { Action, ConcernImage } from '@/data/sampleActions'
import { format } from 'date-fns'
import { toast } from '@/components/ui/sonner'
import JSZip from 'jszip'

interface PioPhotosExportDialogProps {
  concerns: Action[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onClearSelection?: () => void
}

interface PhotoItem {
  id: string
  url: string
  type: 'BEFORE' | 'AFTER'
  concernTitle: string
  municipality: string
  category: string
  concernId: string
  concernIndex: number
  photoIndex: number
  originalFileName?: string
}

export function PioPhotosExportDialog({
  concerns,
  open,
  onOpenChange,
  onClearSelection,
}: PioPhotosExportDialogProps) {
  const [folderName, setFolderName] = useState('')
  const [organizationMode, setOrganizationMode] = useState<'by-concern' | 'by-type' | 'flat'>('by-concern')
  const [isDownloading, setIsDownloading] = useState(false)
  const [progressText, setProgressText] = useState('')
  const [excludedPhotoIds, setExcludedPhotoIds] = useState<Set<string>>(new Set())

  // Reset excluded photos whenever dialog opens with new concerns
  useEffect(() => {
    if (open) {
      setExcludedPhotoIds(new Set())
    }
  }, [open, concerns])

  // Extract all photos (Before & After) from selected concerns
  const allPhotos = useMemo(() => {
    const list: PhotoItem[] = []

    concerns.forEach((concern, cIdx) => {
      let beforeIdx = 1
      let afterIdx = 1

      // 1. BEFORE Photos (Concern Photos)
      if (concern.concernPhotos && concern.concernPhotos.length > 0) {
        concern.concernPhotos.forEach((photo) => {
          if (photo.url && photo.fileType !== 'document') {
            list.push({
              id: `${concern.id}-before-${beforeIdx}-${photo.url}`,
              url: photo.url,
              type: 'BEFORE',
              concernTitle: concern.reportTitle,
              municipality: concern.municipality,
              category: concern.category,
              concernId: concern.id,
              concernIndex: cIdx + 1,
              photoIndex: beforeIdx++,
              originalFileName: photo.fileName,
            })
          }
        })
      }

      // 2. AFTER Photos (Action Taken Photos from department and PGO)
      const deptActions = concern.actionHistory?.filter((a) => a.actionType === 'department') || []
      const legacyAction = !deptActions.length && concern.actionTaken ? concern.actionTaken : null
      const deptRecord = deptActions[deptActions.length - 1] || legacyAction
      const pgoActions = concern.actionHistory?.filter((a) => a.actionType === 'pgo') || []
      const pgoRecord = pgoActions[pgoActions.length - 1]

      const afterPhotos: ConcernImage[] = []
      if (deptRecord?.photos) {
        afterPhotos.push(...deptRecord.photos.filter((p) => p.fileType !== 'document'))
      }
      if (pgoRecord?.photos) {
        afterPhotos.push(...pgoRecord.photos.filter((p) => p.fileType !== 'document'))
      }

      afterPhotos.forEach((photo) => {
        if (photo.url) {
          list.push({
            id: `${concern.id}-after-${afterIdx}-${photo.url}`,
            url: photo.url,
            type: 'AFTER',
            concernTitle: concern.reportTitle,
            municipality: concern.municipality,
            category: concern.category,
            concernId: concern.id,
            concernIndex: cIdx + 1,
            photoIndex: afterIdx++,
            originalFileName: photo.fileName,
          })
        }
      })
    })

    return list
  }, [concerns])

  // Active photos to be packaged (excluding user-removed photos)
  const activePhotos = useMemo(() => {
    return allPhotos.filter((p) => !excludedPhotoIds.has(p.id))
  }, [allPhotos, excludedPhotoIds])

  const beforeCount = useMemo(() => activePhotos.filter((p) => p.type === 'BEFORE').length, [activePhotos])
  const afterCount = useMemo(() => activePhotos.filter((p) => p.type === 'AFTER').length, [activePhotos])
  const removedCount = excludedPhotoIds.size

  // Set default intelligent folder name based on selected concerns
  useEffect(() => {
    if (open && concerns.length > 0) {
      const dateStr = format(new Date(), 'yyyy-MM-dd')
      const categories = [...new Set(concerns.map((c) => c.category).filter(Boolean))]
      const municipalities = [...new Set(concerns.map((c) => c.municipality).filter(Boolean))]

      let defaultName = 'PIO_PHOTOS'
      if (categories.length === 1) {
        defaultName = `PIO_${categories[0].toUpperCase()}_PHOTOS`
      }
      if (municipalities.length === 1) {
        defaultName += `_${municipalities[0].toUpperCase().replace(/\s+/g, '_')}`
      } else if (municipalities.length > 1 && municipalities.length <= 3) {
        defaultName += `_${municipalities.map((m) => m.toUpperCase().slice(0, 4)).join('_')}`
      }
      defaultName += `_${dateStr}`

      setFolderName(defaultName)
    }
  }, [open, concerns])

  const cleanFilename = (str: string) => {
    return str
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 50)
  }

  const getExtensionFromMimeOrUrl = (url: string, mimeType?: string): string => {
    if (mimeType) {
      if (mimeType.includes('png')) return 'png'
      if (mimeType.includes('webp')) return 'webp'
      if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg'
    }
    const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/)
    if (match && ['jpg', 'jpeg', 'png', 'webp'].includes(match[1].toLowerCase())) {
      return match[1].toLowerCase()
    }
    return 'jpg'
  }

  // Remove a specific photo
  const handleRemovePhoto = (photoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setExcludedPhotoIds((prev) => {
      const next = new Set(prev)
      next.add(photoId)
      return next
    })
    toast.info('Photo removed from ZIP package')
  }

  // Restore all removed photos
  const handleRestoreAllPhotos = () => {
    setExcludedPhotoIds(new Set())
    toast.success('All removed photos restored')
  }

  // Robust image blob loader with cache busting and multiple fallbacks
  const fetchImageBlob = async (url: string): Promise<{ blob: Blob; ext: string }> => {
    // 1. Data URLs
    if (url.startsWith('data:')) {
      const res = await fetch(url)
      const blob = await res.blob()
      const ext = getExtensionFromMimeOrUrl(url, blob.type)
      return { blob, ext }
    }

    // 2. Build cache-busted URL to prevent Service Worker opaque cache interception
    const cacheBustParam = `dl_pio=${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const cleanUrl = url.split('?')[0]
    const originalQuery = url.includes('?') ? url.split('?')[1] : ''
    const fullQuery = originalQuery ? `${originalQuery}&${cacheBustParam}` : cacheBustParam
    const bypassedUrl = `${cleanUrl}?${fullQuery}`

    // Strategy A: Direct fetch with cache: 'no-store' and credentials: 'omit'
    try {
      const res = await fetch(bypassedUrl, {
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
      })
      if (res.ok) {
        const blob = await res.blob()
        if (blob.size > 0 && blob.type.startsWith('image/')) {
          const ext = getExtensionFromMimeOrUrl(url, blob.type)
          return { blob, ext }
        }
      }
    } catch (err) {
      console.warn(`[PIO Export] Cache-busted fetch failed for ${url}:`, err)
    }

    // Strategy B: Original URL direct fetch
    try {
      const res = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
      })
      if (res.ok) {
        const blob = await res.blob()
        if (blob.size > 0) {
          const ext = getExtensionFromMimeOrUrl(url, blob.type)
          return { blob, ext }
        }
      }
    } catch (err) {
      console.warn(`[PIO Export] Direct fetch fallback failed for ${url}:`, err)
    }

    // Strategy C: XMLHttpRequest with blob response
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('GET', bypassedUrl, true)
        xhr.responseType = 'blob'
        xhr.onload = () => {
          if (xhr.status === 200 && xhr.response instanceof Blob && xhr.response.size > 0) {
            resolve(xhr.response)
          } else {
            reject(new Error(`XHR returned status ${xhr.status}`))
          }
        }
        xhr.onerror = () => reject(new Error('XHR error'))
        xhr.send()
      })
      const ext = getExtensionFromMimeOrUrl(url, blob.type)
      return { blob, ext }
    } catch (xhrErr) {
      console.warn(`[PIO Export] XHR failed for ${url}:`, xhrErr)
    }

    // Strategy D: Image Element + Canvas
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth || img.width || 800
          canvas.height = img.naturalHeight || img.height || 600
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('No 2d context')
          ctx.drawImage(img, 0, 0)
          canvas.toBlob(
            (b) => {
              if (b && b.size > 0) {
                resolve({ blob: b, ext: 'jpg' })
              } else {
                reject(new Error('Canvas toBlob returned empty blob'))
              }
            },
            'image/jpeg',
            0.95
          )
        } catch (canvasErr) {
          reject(canvasErr)
        }
      }
      img.onerror = () => reject(new Error(`Failed to load image element: ${url}`))
      img.src = bypassedUrl
    })
  }

  const handleDownloadZip = async () => {
    if (activePhotos.length === 0) {
      toast.error('No photos left to package. Please restore photos or select other concerns.')
      return
    }

    const targetFolderName = cleanFilename(folderName.trim()) || `PIO_PHOTOS_${format(new Date(), 'yyyyMMdd')}`

    setIsDownloading(true)
    setProgressText(`Preparing to download ${activePhotos.length} photos...`)

    try {
      const zip = new JSZip()
      const mainFolder = zip.folder(targetFolderName) || zip

      let completed = 0
      let failed = 0

      // Map concern subfolders so all photos belonging to the same concern go into ONE subfolder
      const concernFoldersMap = new Map<string, JSZip>()

      // Download images with concurrency of 4
      const concurrency = 4
      const downloadTasks = activePhotos.map((photo) => async () => {
        try {
          const { blob, ext } = await fetchImageBlob(photo.url)
          const cleanTitle = cleanFilename(photo.concernTitle || 'Concern')
          const muni = cleanFilename(photo.municipality || 'Bataan')
          const photoIdxStr = String(photo.photoIndex).padStart(2, '0')
          const concernIdxStr = String(photo.concernIndex).padStart(2, '0')

          if (organizationMode === 'by-concern') {
            // Group by concern folder: [TargetFolder]/01_Morong_Quarry/BEFORE_01.jpg
            const folderKey = `${concernIdxStr}_${muni}_${cleanTitle}`
            let subfolder = concernFoldersMap.get(folderKey)
            if (!subfolder) {
              subfolder = mainFolder.folder(folderKey) || mainFolder
              concernFoldersMap.set(folderKey, subfolder)
            }
            subfolder.file(`${photo.type}_${photoIdxStr}.${ext}`, blob)
          } else if (organizationMode === 'by-type') {
            // Subfolders by type: [TargetFolder]/BEFORE/01_Morong_Quarry_01.jpg
            const typeSubfolder = mainFolder.folder(photo.type) || mainFolder
            typeSubfolder.file(`${concernIdxStr}_${muni}_${cleanTitle}_${photoIdxStr}.${ext}`, blob)
          } else {
            // Flat single folder: [TargetFolder]/BEFORE_01_Morong_Quarry_01.jpg
            mainFolder.file(`${photo.type}_${concernIdxStr}_${muni}_${cleanTitle}_${photoIdxStr}.${ext}`, blob)
          }

          completed++
          setProgressText(`Downloaded ${completed} of ${activePhotos.length} photos...`)
        } catch (err) {
          failed++
          console.error(`Failed to fetch photo: ${photo.url}`, err)
        }
      })

      // Run concurrency
      for (let i = 0; i < downloadTasks.length; i += concurrency) {
        const chunk = downloadTasks.slice(i, i + concurrency)
        await Promise.all(chunk.map((fn) => fn()))
      }

      if (completed === 0) {
        throw new Error('Unable to download any photos from server. Please check your network connection.')
      }

      setProgressText(`Packaging ${completed} photos into ZIP archive...`)
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      })

      // Trigger browser download
      const downloadUrl = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `${targetFolderName}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)

      toast.success('ZIP Folder Downloaded!', {
        description: `Successfully packaged ${completed} photos into "${targetFolderName}.zip" ready for PIO submission.${
          failed > 0 ? ` (${failed} photo(s) failed to fetch)` : ''
        }`,
      })

      onOpenChange(false)
    } catch (error) {
      console.error('ZIP generation error:', error)
      toast.error('Failed to create ZIP package', {
        description: error instanceof Error ? error.message : 'Please try again',
      })
    } finally {
      setIsDownloading(false)
      setProgressText('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl w-full max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden bg-background">
        
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-muted/40 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-blue-600 text-white shadow-xs">
              <HugeiconsIcon icon={Folder01Icon} className="w-5 h-5" />
            </span>
            <div>
              <DialogTitle className="text-lg font-bold">
                Export Photos Folder for PIO (Social Media Posting)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Package raw Before & After photos into a named ZIP folder. You can remove unwanted photos before downloading.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* Summary Stats Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl border bg-card text-center shadow-xs">
              <div className="text-xs font-medium text-muted-foreground">Selected Concerns</div>
              <div className="text-2xl font-black text-foreground mt-1">{concerns.length}</div>
            </div>
            <div className="p-3 rounded-xl border bg-red-500/10 border-red-500/20 text-center shadow-xs">
              <div className="text-xs font-semibold text-red-600 dark:text-red-400">BEFORE Photos</div>
              <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{beforeCount}</div>
            </div>
            <div className="p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-center shadow-xs">
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">AFTER Photos</div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{afterCount}</div>
            </div>
          </div>

          {/* Folder Name Input */}
          <div className="space-y-2 p-4 rounded-xl border bg-muted/20">
            <Label htmlFor="folder-name" className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <HugeiconsIcon icon={Folder01Icon} className="w-4 h-4 text-blue-600" />
              Folder / ZIP Archive Name (Customizable for PIO)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="folder-name"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="e.g. ENVIRONMENTAL_MORONG_QUARRY_PHOTOS"
                className="font-mono text-xs bg-background h-10 font-bold"
              />
              <span className="text-xs font-mono text-muted-foreground font-bold shrink-0">.zip</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Rename this folder to clearly describe the content (e.g. category, municipality, or subject) so the PIO team can easily identify the images.
            </p>
          </div>

          {/* Folder Structure Selector */}
          <div className="space-y-2.5 p-4 rounded-xl border bg-muted/20">
            <Label className="text-xs font-bold uppercase tracking-wider text-foreground">
              Folder Organization Structure
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                {
                  id: 'by-concern',
                  title: 'Separate Subfolders per Concern',
                  desc: 'Creates a dedicated folder for each concern with BEFORE and AFTER inside.',
                },
                {
                  id: 'by-type',
                  title: 'BEFORE / AFTER Folders',
                  desc: 'Organizes all before photos into /BEFORE and all after photos into /AFTER.',
                },
                {
                  id: 'flat',
                  title: 'Single Flat Folder',
                  desc: 'All photos in one folder with descriptive prefixes (e.g. BEFORE_01_Morong).',
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setOrganizationMode(opt.id as any)}
                  className={`p-3 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                    organizationMode === opt.id
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 font-semibold ring-1 ring-blue-600'
                      : 'border-border bg-card hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <div className="font-bold text-foreground">{opt.title}</div>
                  <div className="text-[10.5px] opacity-80 mt-1 leading-snug">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Photos Preview & Removal Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <HugeiconsIcon icon={Image01Icon} className="w-4 h-4 text-emerald-600" />
                Photos to be Packaged ({activePhotos.length} of {allPhotos.length} Included)
              </Label>
              {removedCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRestoreAllPhotos}
                  className="h-7 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
                >
                  <HugeiconsIcon icon={RefreshIcon} className="w-3.5 h-3.5 mr-1" />
                  Restore {removedCount} Removed Photo(s)
                </Button>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground">
              Hover over any photo and click the <strong className="text-red-500 font-bold">✕</strong> icon to exclude that specific photo from the ZIP folder.
            </p>

            {activePhotos.length === 0 ? (
              <div className="p-6 text-center border rounded-xl bg-muted/10 text-xs text-muted-foreground space-y-2">
                <div>All photos have been excluded from this package.</div>
                {removedCount > 0 && (
                  <Button size="sm" variant="outline" onClick={handleRestoreAllPhotos} className="cursor-pointer text-xs">
                    Restore All {removedCount} Photos
                  </Button>
                )}
              </div>
            ) : (
              <div className="border rounded-xl p-3 bg-muted/10 max-h-60 overflow-y-auto">
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                  {activePhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="relative group rounded-lg overflow-hidden border bg-background shadow-2xs aspect-square"
                    >
                      <img
                        src={photo.url}
                        alt="Photo"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />

                      {/* Type Badge */}
                      <div
                        className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8.5px] font-black text-white shadow-xs ${
                          photo.type === 'BEFORE' ? 'bg-red-600' : 'bg-emerald-600'
                        }`}
                      >
                        {photo.type}
                      </div>

                      {/* REMOVE BUTTON (✕) */}
                      <button
                        type="button"
                        onClick={(e) => handleRemovePhoto(photo.id, e)}
                        title="Remove photo from package"
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/75 hover:bg-red-600 text-white flex items-center justify-center transition-all cursor-pointer opacity-90 group-hover:opacity-100 shadow-sm"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} className="w-3 h-3 stroke-[2.5]" />
                      </button>

                      {/* Location & Details footer */}
                      <div className="absolute inset-x-0 bottom-0 p-1 bg-black/75 text-white text-[8px] truncate">
                        {photo.municipality} • #{photo.photoIndex}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/40 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-muted-foreground font-medium">
            {isDownloading ? (
              <span className="text-blue-600 font-bold animate-pulse">{progressText}</span>
            ) : (
              <span>
                Ready to package <strong>{activePhotos.length}</strong> photo(s) into <strong>{folderName || 'PIO_PHOTOS'}.zip</strong>
                {removedCount > 0 && ` (${removedCount} photo(s) excluded)`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isDownloading}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadZip}
              disabled={isDownloading || activePhotos.length === 0}
              className="bg-[#1a3a6b] hover:bg-[#122a4f] text-white font-bold cursor-pointer shadow-sm px-5"
            >
              <HugeiconsIcon icon={Download01Icon} className="w-4 h-4 mr-1.5" />
              {isDownloading ? 'Packaging ZIP...' : `Download ZIP (${activePhotos.length} Photos)`}
            </Button>
          </div>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  )
}
