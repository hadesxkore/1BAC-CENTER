import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { DatePicker } from '@/components/ui/date-picker'

import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, Image02Icon, Delete02Icon } from '@hugeicons/core-free-icons'
import { BATAAN_MUNICIPALITIES } from '@/data/municipalities'
import { uploadMultipleToCloudinary, compressImage } from '@/config/cloudinary'
import { db } from '@/config/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { useAppStore } from '@/store'
import { toast } from '@/components/ui/sonner'
import { format } from 'date-fns'

const BUILDING_PERMIT_TITLE_SUGGESTIONS = [
  'ALLEGED UNPERMITTED CONSTRUCTION',
  'COMMERCIAL BUILDING PERMIT',
  'RESIDENTIAL BUILDING PERMIT',
  'FENCE / ENCLOSURE PERMIT',
  'OCCUPANCY PERMIT VIOLATION',
  'RENOVATION / ALTERATION WITHOUT PERMIT',
  'ANCILLARY PERMIT ISSUES',
  'EXCAVATION / GRADING PERMIT VIOLATION',
  'DEMOLITION PERMIT VIOLATION',
  'OTHER BUILDING PERMIT REPORT',
]

interface PhotoImage {
  url: string
  publicId: string
  file?: File
}

export function AddBuildingPermitDialog() {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isCompressing, setIsCompressing] = useState(false)
  const { user } = useAppStore()
  
  // Form fields
  const [dateReported, setDateReported] = useState<Date | undefined>(undefined)
  const [municipality, setMunicipality] = useState('')
  const [reportTitle, setReportTitle] = useState('')
  const [location, setLocation] = useState('')
  const [remarks, setRemarks] = useState('')
  const [status, setStatus] = useState<'pending' | 'for-validation' | 'completed'>('pending')
  const [beforePhotos, setBeforePhotos] = useState<PhotoImage[]>([])
  const [afterPhotos, setAfterPhotos] = useState<PhotoImage[]>([])
  const [afterNotes, setAfterNotes] = useState('')
  const [actionDate, setActionDate] = useState<Date | undefined>(undefined)
  
  const beforeFileInputRef = useRef<HTMLInputElement>(null)
  const afterFileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (files: FileList | null, type: 'before' | 'after') => {
    if (!files) return
    
    const currentPhotos = type === 'before' ? beforePhotos : afterPhotos
    const setPhotos = type === 'before' ? setBeforePhotos : setAfterPhotos
    
    setIsCompressing(true)
    const newImages: PhotoImage[] = []
    
    for (let i = 0; i < Math.min(files.length, 5 - currentPhotos.length); i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        const fileSizeInMB = file.size / 1024 / 1024
        let processedFile = file
        
        if (fileSizeInMB > 1.5) {
          toast.info(`Compressing ${file.name}...`)
          processedFile = await compressImage(file)
          const compressedSizeInMB = processedFile.size / 1024 / 1024
          toast.success(`Compressed from ${fileSizeInMB.toFixed(2)}MB to ${compressedSizeInMB.toFixed(2)}MB`)
        }
        
        const url = URL.createObjectURL(processedFile)
        newImages.push({ url, publicId: '', file: processedFile })
      }
    }
    
    setPhotos([...currentPhotos, ...newImages])
    setIsCompressing(false)
    
    if (files.length + currentPhotos.length > 5) {
      toast.warning('Maximum 5 images allowed per section')
    }
  }

  const handlePaste = async (e: React.ClipboardEvent | { clipboardData: DataTransfer }, type: 'before' | 'after') => {
    const clipboardData = e.clipboardData
    if (!clipboardData) return
    
    const files: File[] = []

    // 1. Direct image files in clipboard
    if (clipboardData.items) {
      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i]
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }
    }

    // 2. Extract image URL or HTML <img> tag if copied from another website
    if (files.length === 0) {
      const htmlText = clipboardData.getData('text/html')
      const plainText = clipboardData.getData('text/plain')
      let imageUrl: string | null = null

      if (htmlText) {
        const match = htmlText.match(/<img[^>]+src=["']([^"']+)["']/i)
        if (match && match[1]) {
          imageUrl = match[1]
        }
      }

      if (!imageUrl && plainText) {
        const trimmed = plainText.trim()
        if (trimmed.startsWith('data:image/') || /^https?:\/\/.+/i.test(trimmed)) {
          imageUrl = trimmed
        }
      }

      if (imageUrl) {
        try {
          toast.info('Fetching image from pasted URL...')
          let blob: Blob | null = null

          if (imageUrl.startsWith('data:image/')) {
            const res = await fetch(imageUrl)
            blob = await res.blob()
          } else {
            const res = await fetch(imageUrl).catch(() => null)
            if (res && res.ok) {
              blob = await res.blob()
            }
          }

          if (blob && blob.type.startsWith('image/')) {
            const ext = blob.type.split('/')[1] || 'jpg'
            const file = new File([blob], `pasted-image-${Date.now()}.${ext}`, { type: blob.type })
            files.push(file)
          } else {
            toast.error('Could not load image directly. Try right-clicking image -> "Copy Image".')
          }
        } catch (err) {
          console.error('Failed to fetch pasted image:', err)
          toast.error('Failed to load image from URL')
        }
      }
    }
    
    if (files.length > 0) {
      const dt = new DataTransfer()
      files.forEach(file => dt.items.add(file))
      handleFileSelect(dt.files, type)
      toast.success(`Pasted image to ${type} photos!`)
    }
  }

  const removeImage = (index: number, type: 'before' | 'after') => {
    const photos = type === 'before' ? beforePhotos : afterPhotos
    const setPhotos = type === 'before' ? setBeforePhotos : setAfterPhotos
    
    const imageToRemove = photos[index]
    if (imageToRemove.url.startsWith('blob:')) {
      URL.revokeObjectURL(imageToRemove.url)
    }
    setPhotos(photos.filter((_, i) => i !== index))
  }

  useEffect(() => {
    return () => {
      beforePhotos.forEach(image => {
        if (image.url.startsWith('blob:')) {
          URL.revokeObjectURL(image.url)
        }
      })
      afterPhotos.forEach(image => {
        if (image.url.startsWith('blob:')) {
          URL.revokeObjectURL(image.url)
        }
      })
    }
  }, [beforePhotos, afterPhotos])

  const [hoveredSection, setHoveredSection] = useState<'before' | 'after' | null>(null)

  // Global paste handler when modal is open
  useEffect(() => {
    if (!open) return

    const handleGlobalPaste = (e: ClipboardEvent) => {
      const activeElement = document.activeElement
      const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'
      if (isInput) return

      if (e.clipboardData) {
        // Automatically target the hovered section if hovering over before or after zone
        const targetType = hoveredSection || (beforePhotos.length < 5 ? 'before' : 'after')
        handlePaste({ clipboardData: e.clipboardData }, targetType)
      }
    }

    window.addEventListener('paste', handleGlobalPaste)
    return () => window.removeEventListener('paste', handleGlobalPaste)
  }, [open, hoveredSection, beforePhotos.length, afterPhotos.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!dateReported) {
      toast.error('Please select date reported')
      return
    }

    if (!municipality) {
      toast.error('Please select a municipality')
      return
    }

    if (!reportTitle.trim()) {
      toast.error('Please enter permit title')
      return
    }
    
    if (beforePhotos.length === 0) {
      toast.error('Please upload at least one before photo')
      return
    }

    if (afterPhotos.length > 0 && !actionDate) {
      toast.error('Please select action date for after photos')
      return
    }
    
    setIsSubmitting(true)
    setUploadProgress(0)
    
    try {
      const totalImages = beforePhotos.length + afterPhotos.length
      const beforeFiles = beforePhotos.map(photo => photo.file!).filter(Boolean)
      const afterFiles = afterPhotos.map(photo => photo.file!).filter(Boolean)

      const beforeResults = await uploadMultipleToCloudinary(beforeFiles, (completed, total, stage) => {
        if (stage === 'compressing') {
          const progress = (completed / totalImages) * 50
          setUploadProgress(progress)
          if (completed === 0) {
            toast.info(`Compressing before photos...`)
          }
        } else {
          const progress = 50 + (completed / totalImages) * 50
          setUploadProgress(progress)
          if (completed === 0) {
            toast.info(`Uploading before photos...`)
          }
        }
      })

      const failedBeforeUploads = beforeResults.filter(r => !r.success)
      if (failedBeforeUploads.length > 0) {
        throw new Error(`Failed to upload ${failedBeforeUploads.length} before photo(s)`)
      }

      const uploadedBeforePhotos = beforeResults.map(r => ({
        url: r.url!,
        publicId: r.publicId!,
      }))

      let uploadedAfterPhotos: { url: string; publicId: string }[] = []
      
      if (afterFiles.length > 0) {
        const afterResults = await uploadMultipleToCloudinary(afterFiles, (completed, total, stage) => {
          const baseProgress = (beforeFiles.length / totalImages) * 100
          if (stage === 'compressing') {
            const progress = baseProgress + (completed / totalImages) * 50
            setUploadProgress(progress)
            if (completed === 0) {
              toast.info(`Compressing after photos...`)
            }
          } else {
            const progress = baseProgress + 50 + (completed / totalImages) * 50
            setUploadProgress(progress)
            if (completed === 0) {
              toast.info(`Uploading after photos...`)
            }
          }
        })

        const failedAfterUploads = afterResults.filter(r => !r.success)
        if (failedAfterUploads.length > 0) {
          throw new Error(`Failed to upload ${failedAfterUploads.length} after photo(s)`)
        }

        uploadedAfterPhotos = afterResults.map(r => ({
          url: r.url!,
          publicId: r.publicId!,
        }))
      }

      const determinedStatus = afterPhotos.length > 0 ? 'completed' : status
      
      const reportData: any = {
        dateReported: format(dateReported, 'yyyy-MM-dd'),
        dateUploaded: serverTimestamp(),
        municipality,
        reportTitle,
        location,
        remarks,
        beforePhotos: uploadedBeforePhotos,
        status: determinedStatus,
        reportedBy: user?.name || 'Unknown',
        createdAt: serverTimestamp(),
        createdBy: user?.id || '',
      }

      if (uploadedAfterPhotos.length > 0) {
        reportData.afterPhotos = {
          photos: uploadedAfterPhotos,
          notes: afterNotes,
          actionDate: actionDate ? format(actionDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
          submittedBy: user?.name || 'Unknown',
          submittedAt: new Date().toISOString(),
        }
      } else {
        reportData.afterPhotos = null
      }
      
      await addDoc(collection(db, 'building_permit_reports'), reportData)
      
      toast.success('Building permit report created successfully!')
      resetForm()
      setOpen(false)
    } catch (error: any) {
      console.error('Error adding building permit report:', error)
      toast.error(error.message || 'Failed to create building permit report')
    } finally {
      setIsSubmitting(false)
      setUploadProgress(0)
    }
  }

  const resetForm = () => {
    setDateReported(undefined)
    setMunicipality('')
    setReportTitle('')
    setLocation('')
    setRemarks('')
    setStatus('pending')
    setBeforePhotos([])
    setAfterPhotos([])
    setAfterNotes('')
    setActionDate(undefined)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90">
          <HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" />
          Add Building Permit
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <DialogTitle>Add Building Permit Report</DialogTitle>
          <DialogDescription>
            Enter details and upload before/after photos for the building permit report.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6">
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateReported">
                    Date Reported <span className="text-red-500">*</span>
                  </Label>
                  <DatePicker
                    date={dateReported}
                    onDateChange={setDateReported}
                    placeholder="Select date reported"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="municipality">
                    Municipality <span className="text-red-500">*</span>
                  </Label>
                  <Select value={municipality} onValueChange={setMunicipality}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select municipality" />
                    </SelectTrigger>
                    <SelectContent>
                      {BATAAN_MUNICIPALITIES.map((mun) => (
                        <SelectItem key={mun} value={mun}>
                          {mun}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Title, Location & Initial Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="reportTitle">
                    Permit / Report Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="reportTitle"
                    list="permit-title-suggestions"
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    placeholder="e.g. ALLEGED UNPERMITTED CONSTRUCTION"
                    autoComplete="off"
                  />
                  <datalist id="permit-title-suggestions">
                    {BUILDING_PERMIT_TITLE_SUGGESTIONS.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Initial Status</Label>
                  <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="for-validation">For Validation</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location / Address</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Specific address, barangay, or landmark"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks / Description</Label>
                <Textarea
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Additional details or notes about the building permit report"
                  rows={3}
                />
              </div>

              {/* Before Photos Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">
                    Before Photos <span className="text-red-500">*</span>
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {beforePhotos.length}/5 images
                  </span>
                </div>

                <div
                  onPaste={(e) => handlePaste(e, 'before')}
                  onMouseEnter={() => setHoveredSection('before')}
                  onMouseLeave={() => setHoveredSection((prev) => (prev === 'before' ? null : prev))}
                  tabIndex={0}
                  className={`border-2 border-dashed rounded-lg p-4 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    hoveredSection === 'before'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                >
                  <input
                    ref={beforeFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files, 'before')}
                  />
                  
                  {beforePhotos.length === 0 ? (
                    <div
                      onClick={() => beforeFileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center py-6 cursor-pointer text-center"
                    >
                      <HugeiconsIcon icon={Image02Icon} className={`w-10 h-10 mb-2 transition-colors ${hoveredSection === 'before' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <p className="text-sm font-medium">Click or hover & paste (Ctrl+V)</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {hoveredSection === 'before' ? '📋 Ready! Press Ctrl+V to paste into Before photos' : 'Copy an image or image URL from web and press Ctrl+V while hovering'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {beforePhotos.map((photo, idx) => (
                        <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
                          <img src={photo.url} alt={`Before ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImage(idx, 'before')}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <HugeiconsIcon icon={Delete02Icon} className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {beforePhotos.length < 5 && (
                        <button
                          type="button"
                          onClick={() => beforeFileInputRef.current?.click()}
                          className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg aspect-square hover:bg-muted/50 transition-colors"
                        >
                          <HugeiconsIcon icon={Add01Icon} className="w-6 h-6 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground mt-1">Add</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* After Photos Section (Optional) */}
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold">After Photos (Optional)</Label>
                    <p className="text-xs text-muted-foreground">Upload resolved/compliance photos if available</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {afterPhotos.length}/5 images
                  </span>
                </div>

                <div
                  onPaste={(e) => handlePaste(e, 'after')}
                  onMouseEnter={() => setHoveredSection('after')}
                  onMouseLeave={() => setHoveredSection((prev) => (prev === 'after' ? null : prev))}
                  tabIndex={0}
                  className={`border-2 border-dashed rounded-lg p-4 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    hoveredSection === 'after'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                >
                  <input
                    ref={afterFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files, 'after')}
                  />
                  
                  {afterPhotos.length === 0 ? (
                    <div
                      onClick={() => afterFileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center py-6 cursor-pointer text-center"
                    >
                      <HugeiconsIcon icon={Image02Icon} className={`w-10 h-10 mb-2 transition-colors ${hoveredSection === 'after' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <p className="text-sm font-medium">Click or hover & paste (Ctrl+V)</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {hoveredSection === 'after' ? '📋 Ready! Press Ctrl+V to paste into After photos' : 'Copy compliance photo from web and press Ctrl+V while hovering'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        {afterPhotos.map((photo, idx) => (
                          <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
                            <img src={photo.url} alt={`After ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeImage(idx, 'after')}
                              className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <HugeiconsIcon icon={Delete02Icon} className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        {afterPhotos.length < 5 && (
                          <button
                            type="button"
                            onClick={() => afterFileInputRef.current?.click()}
                            className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg aspect-square hover:bg-muted/50 transition-colors"
                          >
                            <HugeiconsIcon icon={Add01Icon} className="w-6 h-6 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground mt-1">Add</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Action Date</Label>
                          <DatePicker
                            date={actionDate}
                            onDateChange={setActionDate}
                            placeholder="Select action date"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Action Notes</Label>
                          <Input
                            value={afterNotes}
                            onChange={(e) => setAfterNotes(e.target.value)}
                            placeholder="e.g. Permit issued / Compliance verified"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {isSubmitting && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Uploading...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}
            </div>
            </div>
          </ScrollArea>

          <div className="flex items-center justify-end gap-3 p-4 border-t bg-muted/40 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting || isCompressing}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isCompressing}>
              {isSubmitting ? 'Saving...' : 'Create Building Permit Report'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
