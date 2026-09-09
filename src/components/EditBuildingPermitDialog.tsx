import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { DatePicker } from '@/components/ui/date-picker'
import { HugeiconsIcon } from '@hugeicons/react'
import { Edit02Icon, Image02Icon, Delete02Icon, Add01Icon } from '@hugeicons/core-free-icons'
import { BATAAN_MUNICIPALITIES } from '@/data/municipalities'
import { uploadMultipleToCloudinary, compressImage } from '@/config/cloudinary'
import { db } from '@/config/firebase'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { toast } from '@/components/ui/sonner'
import { format } from 'date-fns'

interface BuildingPermitReport {
  id: string
  dateReported: string
  municipality: string
  reportTitle: string
  location: string
  remarks: string
  beforePhotos: { url: string; publicId: string }[]
  afterPhotos: {
    photos: { url: string; publicId: string }[]
    notes: string
    actionDate: string
    submittedBy: string
    submittedAt: string
  } | null
  status: 'pending' | 'for-validation' | 'completed'
}

interface PhotoImage {
  url: string
  publicId: string
  file?: File
}

interface EditBuildingPermitDialogProps {
  report: BuildingPermitReport
}

export function EditBuildingPermitDialog({ report }: EditBuildingPermitDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isCompressing, setIsCompressing] = useState(false)
  
  // Form fields
  const [dateReported, setDateReported] = useState<Date | undefined>(
    report.dateReported ? new Date(report.dateReported) : undefined
  )
  const [municipality, setMunicipality] = useState(report.municipality)
  const [reportTitle, setReportTitle] = useState(report.reportTitle)
  const [location, setLocation] = useState(report.location)
  const [remarks, setRemarks] = useState(report.remarks)
  const [status, setStatus] = useState<'pending' | 'for-validation' | 'completed'>(report.status)
  const [beforePhotos, setBeforePhotos] = useState<PhotoImage[]>(report.beforePhotos)
  const [afterPhotos, setAfterPhotos] = useState<PhotoImage[]>(report.afterPhotos?.photos || [])
  const [afterNotes, setAfterNotes] = useState(report.afterPhotos?.notes || '')
  const [actionDate, setActionDate] = useState<Date | undefined>(
    report.afterPhotos?.actionDate ? new Date(report.afterPhotos.actionDate) : undefined
  )
  
  const beforeFileInputRef = useRef<HTMLInputElement>(null)
  const afterFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setDateReported(report.dateReported ? new Date(report.dateReported) : undefined)
      setMunicipality(report.municipality)
      setReportTitle(report.reportTitle)
      setLocation(report.location)
      setRemarks(report.remarks)
      setStatus(report.status)
      setBeforePhotos(report.beforePhotos)
      setAfterPhotos(report.afterPhotos?.photos || [])
      setAfterNotes(report.afterPhotos?.notes || '')
      setActionDate(report.afterPhotos?.actionDate ? new Date(report.afterPhotos.actionDate) : undefined)
    }
  }, [open, report])

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
        }
        
        const url = URL.createObjectURL(processedFile)
        newImages.push({ url, publicId: '', file: processedFile })
      }
    }
    
    setPhotos([...currentPhotos, ...newImages])
    setIsCompressing(false)
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

  const [hoveredSection, setHoveredSection] = useState<'before' | 'after' | null>(null)

  // Global paste handler when modal is open
  useEffect(() => {
    if (!open) return

    const handleGlobalPaste = (e: ClipboardEvent) => {
      const activeElement = document.activeElement
      const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'
      if (isInput) return

      if (e.clipboardData) {
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
      toast.error('Please select municipality')
      return
    }
    if (!reportTitle.trim()) {
      toast.error('Please enter report title')
      return
    }
    if (beforePhotos.length === 0) {
      toast.error('Please upload at least one before photo')
      return
    }

    setIsSubmitting(true)
    setUploadProgress(0)

    try {
      // Process before photos: keep existing ones (without file), upload new ones (with file)
      const existingBeforePhotos = beforePhotos.filter(p => !p.file)
      const newBeforeFiles = beforePhotos.filter(p => p.file).map(p => p.file!)

      let uploadedBeforePhotos = existingBeforePhotos.map(p => ({ url: p.url, publicId: p.publicId }))

      if (newBeforeFiles.length > 0) {
        const beforeResults = await uploadMultipleToCloudinary(newBeforeFiles, (completed, total) => {
          setUploadProgress((completed / total) * 50)
        })
        const newUploaded = beforeResults.map(r => ({ url: r.url!, publicId: r.publicId! }))
        uploadedBeforePhotos = [...uploadedBeforePhotos, ...newUploaded]
      }

      // Process after photos
      const existingAfterPhotos = afterPhotos.filter(p => !p.file)
      const newAfterFiles = afterPhotos.filter(p => p.file).map(p => p.file!)

      let uploadedAfterPhotos = existingAfterPhotos.map(p => ({ url: p.url, publicId: p.publicId }))

      if (newAfterFiles.length > 0) {
        const afterResults = await uploadMultipleToCloudinary(newAfterFiles, (completed, total) => {
          setUploadProgress(50 + (completed / total) * 50)
        })
        const newUploaded = afterResults.map(r => ({ url: r.url!, publicId: r.publicId! }))
        uploadedAfterPhotos = [...uploadedAfterPhotos, ...newUploaded]
      }

      const updateData: any = {
        dateReported: format(dateReported, 'yyyy-MM-dd'),
        municipality,
        reportTitle,
        location,
        remarks,
        status,
        beforePhotos: uploadedBeforePhotos,
        updatedAt: serverTimestamp(),
      }

      if (uploadedAfterPhotos.length > 0) {
        updateData.afterPhotos = {
          photos: uploadedAfterPhotos,
          notes: afterNotes,
          actionDate: actionDate ? format(actionDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
          submittedBy: report.afterPhotos?.submittedBy || 'Admin',
          submittedAt: report.afterPhotos?.submittedAt || new Date().toISOString(),
        }
      } else {
        updateData.afterPhotos = null
      }

      const reportRef = doc(db, 'building_permit_reports', report.id)
      await updateDoc(reportRef, updateData)

      toast.success('Building permit report updated successfully!')
      setOpen(false)
    } catch (error: any) {
      console.error('Error updating building permit report:', error)
      toast.error(error.message || 'Failed to update report')
    } finally {
      setIsSubmitting(false)
      setUploadProgress(0)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start">
          <HugeiconsIcon icon={Edit02Icon} className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>Edit Building Permit Report</DialogTitle>
          <DialogDescription>
            Update building permit details, photo records, or status.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date Reported</Label>
                  <DatePicker date={dateReported} onDateChange={setDateReported} />
                </div>
                <div className="space-y-2">
                  <Label>Municipality</Label>
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Permit / Report Title</Label>
                  <Input value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                    <SelectTrigger>
                      <SelectValue />
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
                <Label>Location / Address</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Remarks / Description</Label>
                <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} />
              </div>

              {/* Before Photos */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Before Photos</Label>
                  <span className="text-xs text-muted-foreground">{beforePhotos.length}/5 images</span>
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
                          <img src={photo.url} alt={`Before ${idx}`} className="w-full h-full object-cover" />
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
                          className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg aspect-square hover:bg-muted/50"
                        >
                          <HugeiconsIcon icon={Add01Icon} className="w-6 h-6 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground mt-1">Add</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* After Photos */}
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">After Photos</Label>
                  <span className="text-xs text-muted-foreground">{afterPhotos.length}/5 images</span>
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {afterPhotos.map((photo, idx) => (
                        <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
                          <img src={photo.url} alt={`After ${idx}`} className="w-full h-full object-cover" />
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
                          className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg aspect-square hover:bg-muted/50"
                        >
                          <HugeiconsIcon icon={Add01Icon} className="w-6 h-6 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground mt-1">Add</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {afterPhotos.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <div className="space-y-2">
                      <Label>Action Date</Label>
                      <DatePicker date={actionDate} onDateChange={setActionDate} />
                    </div>
                    <div className="space-y-2">
                      <Label>Action Notes</Label>
                      <Input value={afterNotes} onChange={(e) => setAfterNotes(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>

              {isSubmitting && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-end gap-3 p-4 border-t bg-muted/40">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting || isCompressing}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isCompressing}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
