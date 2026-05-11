import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { DatePicker } from '@/components/ui/date-picker'
import { HugeiconsIcon } from '@hugeicons/react'
import { Image02Icon, Delete02Icon } from '@hugeicons/core-free-icons'
import { uploadToCloudinary, uploadMultipleToCloudinary, compressImage } from '@/config/cloudinary'
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

interface SubmitAfterPhotosDialogProps {
  reportId: string
  reportTitle: string
}

export function SubmitAfterPhotosDialog({ reportId, reportTitle }: SubmitAfterPhotosDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isCompressing, setIsCompressing] = useState(false)
  const [notes, setNotes] = useState('')
  const [actionDate, setActionDate] = useState<Date | undefined>(undefined)
  const [afterPhotos, setAfterPhotos] = useState<PhotoImage[]>([])
  const { user } = useAppStore()
  
  const fileInputRef = useRef<HTMLInputElement>(null)

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
          const compressedSizeInMB = processedFile.size / 1024 / 1024
          toast.success(`Compressed from ${fileSizeInMB.toFixed(2)}MB to ${compressedSizeInMB.toFixed(2)}MB`)
        }
        
        const url = URL.createObjectURL(processedFile)
        newImages.push({ url, publicId: '', file: processedFile })
      }
    }
    
    setAfterPhotos([...afterPhotos, ...newImages])
    setIsCompressing(false)
    
    if (files.length + afterPhotos.length > 5) {
      toast.warning('Maximum 5 images allowed')
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    
    const files: File[] = []
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile()
        if (file) files.push(file)
      }
    }
    
    if (files.length > 0) {
      const dt = new DataTransfer()
      files.forEach(file => dt.items.add(file))
      handleFileSelect(dt.files)
    }
  }

  const removeImage = (index: number) => {
    const imageToRemove = afterPhotos[index]
    if (imageToRemove.url.startsWith('blob:')) {
      URL.revokeObjectURL(imageToRemove.url)
    }
    setAfterPhotos(afterPhotos.filter((_, i) => i !== index))
  }

  // Cleanup object URLs when component unmounts or dialog closes
  useEffect(() => {
    return () => {
      afterPhotos.forEach(image => {
        if (image.url.startsWith('blob:')) {
          URL.revokeObjectURL(image.url)
        }
      })
    }
  }, [afterPhotos])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!notes.trim()) {
      toast.error('Please provide action notes')
      return
    }

    if (!actionDate) {
      toast.error('Please select action date')
      return
    }
    
    setIsSubmitting(true)
    setUploadProgress(0)
    
    try {
      let uploadedAfterPhotos: { url: string; publicId: string }[] = []
      
      // Only upload photos if there are any
      if (afterPhotos.length > 0) {
        const totalImages = afterPhotos.length
        
        // Prepare files for parallel upload
        const files = afterPhotos.map(photo => photo.file!).filter(Boolean)
        
        // Upload after photos with progress tracking
        const results = await uploadMultipleToCloudinary(files, (completed, total, stage) => {
          if (stage === 'compressing') {
            const progress = (completed / total) * 50
            setUploadProgress(progress)
            if (completed === 0) {
              toast.info(`Compressing ${totalImages} images...`)
            }
          } else {
            const progress = 50 + (completed / total) * 50
            setUploadProgress(progress)
            if (completed === 0) {
              toast.info(`Uploading ${totalImages} images...`)
            }
          }
        })
        
        // Check if all uploads were successful
        const failedUploads = results.filter(r => !r.success)
        if (failedUploads.length > 0) {
          throw new Error(`Failed to upload ${failedUploads.length} after photo(s)`)
        }
        
        uploadedAfterPhotos = results.map(r => ({
          url: r.url!,
          publicId: r.publicId!,
        }))
      }
      
      // Prepare after photos data with metadata
      const afterPhotosData = {
        photos: uploadedAfterPhotos,
        notes: notes.trim(),
        actionDate: format(actionDate, 'yyyy-MM-dd'),
        submittedBy: user?.name || 'Unknown',
        submittedAt: new Date().toISOString(),
      }
      
      // Update Firestore document
      const reportRef = doc(db, 'pnp_reports', reportId)
      await updateDoc(reportRef, {
        afterPhotos: afterPhotosData,
        status: 'completed',
        updatedAt: serverTimestamp(),
      })
      
      const photoText = afterPhotos.length > 0 
        ? `Uploaded ${afterPhotos.length} image(s) and marked as completed` 
        : 'Marked as completed (photos to follow)'
      
      toast.success('After Photos Submitted Successfully!', {
        description: photoText,
      })
      
      // Reset form
      setNotes('')
      setActionDate(undefined)
      setAfterPhotos([])
      setUploadProgress(0)
      setOpen(false)
      
    } catch (error) {
      console.error('Error submitting after photos:', error)
      toast.error('Failed to submit after photos', {
        description: error instanceof Error ? error.message : 'Please try again'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-green-200 text-green-700 hover:bg-green-50">
          Submit After Photos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[95vw] lg:max-w-2xl h-auto max-h-[85vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-green-200">
          <DialogTitle className="text-green-700">Submit After Photos</DialogTitle>
          <DialogDescription>
            Upload after photos for: <strong className="text-foreground">{reportTitle}</strong>
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="px-6 py-6">
              <div className="space-y-6">
                <div className="space-y-2" onPaste={handlePaste}>
                  <Label>After Photos (Optional - Max 5, Ctrl+V to paste)</Label>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                    {afterPhotos.map((image, index) => (
                      <Card key={index} className="relative p-2 border-green-200">
                        <img src={image.url} alt={`After ${index + 1}`} className="w-full h-24 object-cover rounded" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-xs"
                          className="absolute top-1 right-1"
                          onClick={() => removeImage(index)}
                          disabled={isSubmitting}
                        >
                          <HugeiconsIcon icon={Delete02Icon} className="w-3 h-3" />
                        </Button>
                      </Card>
                    ))}
                    
                    {afterPhotos.length < 5 && (
                      <Card
                        className="p-2 h-28 flex items-center justify-center cursor-pointer hover:bg-green-50 transition-colors border-green-200"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="text-center">
                          <HugeiconsIcon icon={Image02Icon} className="w-8 h-8 mx-auto text-green-600" />
                          <p className="text-xs text-green-600 mt-1">Add Photo</p>
                        </div>
                      </Card>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files)}
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Click to upload or paste images (Ctrl+V)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="actionDate">Action Date *</Label>
                  <DatePicker
                    date={actionDate}
                    onDateChange={setActionDate}
                    placeholder="Select action date"
                    disabled={isSubmitting}
                    maxDate={new Date()}
                  />
                  <p className="text-xs text-muted-foreground">
                    Select the date when the action was taken
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Action Notes *</Label>
                  <Textarea
                    id="notes"
                    placeholder="Describe the action taken to complete this report..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    required
                    disabled={isSubmitting}
                    rows={5}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>

        {/* Buttons - Fixed at bottom, outside ScrollArea */}
        <div className="px-6 py-4 border-t bg-background">
          <div className="space-y-4">
            {/* Upload Progress */}
            <AnimatePresence>
              {isSubmitting && uploadProgress > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Uploading images...</span>
                    <span className="font-medium">{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting || isCompressing} className="flex-1 bg-green-600 hover:bg-green-700">
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
                    />
                    <span>Uploading...</span>
                  </div>
                ) : isCompressing ? (
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
                    />
                    <span>Compressing...</span>
                  </div>
                ) : (
                  'Submit & Complete'
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting || isCompressing}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </form>
      </DialogContent>
    </Dialog>
  )
}
