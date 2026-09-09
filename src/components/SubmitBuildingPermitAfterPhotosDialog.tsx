import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { DatePicker } from '@/components/ui/date-picker'
import { HugeiconsIcon } from '@hugeicons/react'
import { Image02Icon, Delete02Icon, Add01Icon } from '@hugeicons/core-free-icons'
import { uploadMultipleToCloudinary, compressImage } from '@/config/cloudinary'
import { db } from '@/config/firebase'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { useAppStore } from '@/store'
import { toast } from '@/components/ui/sonner'
import { format } from 'date-fns'

interface PhotoImage {
  url: string
  publicId: string
  file?: File
}

interface SubmitBuildingPermitAfterPhotosDialogProps {
  reportId: string
  reportTitle: string
  currentStatus?: string
}

export function SubmitBuildingPermitAfterPhotosDialog({ reportId, reportTitle }: SubmitBuildingPermitAfterPhotosDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isCompressing, setIsCompressing] = useState(false)
  const [notes, setNotes] = useState('')
  const [actionDate, setActionDate] = useState<Date | undefined>(undefined)
  const [afterPhotos, setAfterPhotos] = useState<PhotoImage[]>([])
  const { user } = useAppStore()
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isHovered, setIsHovered] = useState(false)

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return
    
    setIsCompressing(true)
    const newImages: PhotoImage[] = []
    
    for (let i = 0; i < Math.min(files.length, 5 - afterPhotos.length); i++) {
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
    
    setAfterPhotos([...afterPhotos, ...newImages])
    setIsCompressing(false)
  }

  const handlePaste = async (e: React.ClipboardEvent | { clipboardData: DataTransfer }) => {
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

    // 2. Extract image URL or HTML <img> tag if copied from web
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
      await handleFileSelect(dt.files)
      toast.success(`Pasted ${files.length} after photo(s)!`)
    }
  }

  // Global paste handler when modal is open
  useEffect(() => {
    if (!open) return

    const handleGlobalPaste = (e: ClipboardEvent) => {
      const activeElement = document.activeElement
      const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'
      if (isInput) return

      if (e.clipboardData) {
        handlePaste({ clipboardData: e.clipboardData })
      }
    }

    window.addEventListener('paste', handleGlobalPaste)
    return () => window.removeEventListener('paste', handleGlobalPaste)
  }, [open])

  const removeImage = (index: number) => {
    const imageToRemove = afterPhotos[index]
    if (imageToRemove.url.startsWith('blob:')) {
      URL.revokeObjectURL(imageToRemove.url)
    }
    setAfterPhotos(afterPhotos.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (afterPhotos.length === 0) {
      toast.error('Please upload at least one after photo')
      return
    }

    if (!actionDate) {
      toast.error('Please select action date')
      return
    }

    setIsSubmitting(true)
    setUploadProgress(0)

    try {
      const filesToUpload = afterPhotos.map(p => p.file!).filter(Boolean)

      const uploadResults = await uploadMultipleToCloudinary(filesToUpload, (completed, total) => {
        setUploadProgress((completed / total) * 100)
      })

      const failedUploads = uploadResults.filter(r => !r.success)
      if (failedUploads.length > 0) {
        throw new Error(`Failed to upload ${failedUploads.length} photo(s)`)
      }

      const uploadedPhotos = uploadResults.map(r => ({
        url: r.url!,
        publicId: r.publicId!,
      }))

      const reportRef = doc(db, 'building_permit_reports', reportId)
      await updateDoc(reportRef, {
        status: 'completed',
        afterPhotos: {
          photos: uploadedPhotos,
          notes: notes,
          actionDate: format(actionDate, 'yyyy-MM-dd'),
          submittedBy: user?.name || 'Unknown',
          submittedAt: new Date().toISOString(),
        },
        updatedAt: serverTimestamp(),
      })

      toast.success('After photos submitted and status updated to Completed!')
      setOpen(false)
      resetForm()
    } catch (error: any) {
      console.error('Error submitting after photos:', error)
      toast.error(error.message || 'Failed to submit after photos')
    } finally {
      setIsSubmitting(false)
      setUploadProgress(0)
    }
  }

  const resetForm = () => {
    setNotes('')
    setActionDate(undefined)
    setAfterPhotos([])
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50">
          <HugeiconsIcon icon={Image02Icon} className="mr-2 h-4 w-4" />
          Submit After Photos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>Submit After Photos</DialogTitle>
          <DialogDescription>
            Upload compliance/resolution photos for <span className="font-semibold text-foreground">"{reportTitle}"</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>
                  Action / Resolution Date <span className="text-red-500">*</span>
                </Label>
                <DatePicker date={actionDate} onDateChange={setActionDate} placeholder="Select date of action" />
              </div>

              <div className="space-y-2">
                <Label>Resolution Notes / Remarks</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe building permit compliance status or action taken..."
                  rows={3}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">
                    After Photos <span className="text-red-500">*</span>
                  </Label>
                  <span className="text-xs text-muted-foreground">{afterPhotos.length}/5</span>
                </div>

                <div
                  onPaste={handlePaste}
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                  tabIndex={0}
                  className={`border-2 border-dashed rounded-lg p-4 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                    isHovered
                      ? 'border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/30'
                      : 'border-muted-foreground/25 hover:border-emerald-500/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files)}
                  />

                  {afterPhotos.length === 0 ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center py-6 cursor-pointer text-center"
                    >
                      <HugeiconsIcon icon={Image02Icon} className={`w-10 h-10 mb-2 transition-colors ${isHovered ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
                      <p className="text-sm font-medium">Click or hover & paste (Ctrl+V)</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {isHovered ? '📋 Ready! Press Ctrl+V to paste after photos' : 'Copy compliance photo from web and press Ctrl+V while hovering'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {afterPhotos.map((photo, idx) => (
                        <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
                          <img src={photo.url} alt={`After ${idx}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <HugeiconsIcon icon={Delete02Icon} className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {afterPhotos.length < 5 && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
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
            <Button type="submit" disabled={isSubmitting || isCompressing} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSubmitting ? 'Uploading...' : 'Complete Report'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
