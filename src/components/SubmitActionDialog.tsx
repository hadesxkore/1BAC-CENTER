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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HugeiconsIcon } from '@hugeicons/react'
import { Image02Icon, Delete02Icon } from '@hugeicons/core-free-icons'
import { uploadToCloudinary, uploadMultipleToCloudinary, compressImage } from '@/config/cloudinary'
import { db } from '@/config/firebase'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { useAppStore } from '@/store'
import { toast } from 'sonner'
import { format } from 'date-fns'
import type { ConcernImage } from '@/data/sampleActions'

interface SubmitActionDialogProps {
  concernId: string
  concernTitle: string
  collectionName?: string
  onSubmit?: (actionData: { photos: ConcernImage[]; notes: string }) => void
}

export function SubmitActionDialog({ concernId, concernTitle, collectionName = 'concerns', onSubmit }: SubmitActionDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isCompressing, setIsCompressing] = useState(false)
  const [notes, setNotes] = useState('')
  const [actionDate, setActionDate] = useState<Date | undefined>(undefined)
  const [actionStatus, setActionStatus] = useState<'in-progress' | 'completed'>('completed')
  const [images, setImages] = useState<ConcernImage[]>([])
  const { user } = useAppStore()
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return
    
    setIsCompressing(true)
    const newImages: (ConcernImage & { file?: File })[] = []
    
    for (let i = 0; i < Math.min(files.length, 5 - images.length); i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        // Check if compression is needed
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
    
    setImages([...images, ...newImages] as ConcernImage[])
    setIsCompressing(false)
    
    if (files.length + images.length > 5) {
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
    const imageToRemove = images[index]
    // Clean up object URL to prevent memory leak
    if (imageToRemove.url.startsWith('blob:')) {
      URL.revokeObjectURL(imageToRemove.url)
    }
    setImages(images.filter((_, i) => i !== index))
  }

  // Cleanup object URLs when component unmounts or dialog closes
  useEffect(() => {
    return () => {
      // Clean up all blob URLs
      images.forEach(image => {
        if (image.url.startsWith('blob:')) {
          URL.revokeObjectURL(image.url)
        }
      })
    }
  }, [images])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (images.length === 0) {
      toast.error('Please upload at least one action photo')
      return
    }

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
      const totalImages = images.length
      
      // Prepare files for parallel upload
      const files = images.map(img => (img as ConcernImage & { file?: File }).file!).filter(Boolean)
      
      toast.info(`Uploading ${totalImages} images in parallel...`)
      
      // Upload images in parallel
      const results = await uploadMultipleToCloudinary(files, (completed, total) => {
        setUploadProgress((completed / total) * 100)
      })
      
      // Check if all uploads were successful
      const failedUploads = results.filter(r => !r.success)
      if (failedUploads.length > 0) {
        throw new Error(`Failed to upload ${failedUploads.length} image(s)`)
      }
      
      const uploadedImages = results.map(r => ({
        url: r.url!,
        publicId: r.publicId!,
      }))
      
      // Prepare action taken data
      const actionTakenData = {
        photos: uploadedImages,
        notes: notes.trim(),
        submittedBy: user?.name || 'Unknown',
        submittedAt: new Date().toISOString(),
      }

      // Update Firestore document
      const concernRef = doc(db, collectionName, concernId)
      await updateDoc(concernRef, {
        actionTaken: actionTakenData,
        actionDate: format(actionDate, 'yyyy-MM-dd'), // Use selected date
        status: actionStatus,
        updatedAt: serverTimestamp(),
      })
      
      // Call parent callback if provided
      if (onSubmit) {
        onSubmit(actionTakenData)
      }
      
      toast.success('Action Submitted Successfully!', {
        description: `Uploaded ${totalImages} images and marked as completed`,
      })
      
      // Reset form
      setNotes('')
      setActionDate(undefined)
      setImages([])
      setUploadProgress(0)
      setOpen(false)
      
    } catch (error) {
      console.error('Error submitting action:', error)
      toast.error('Failed to submit action', {
        description: error instanceof Error ? error.message : 'Please try again'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Submit Action Taken
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[95vw] lg:max-w-2xl h-auto max-h-[85vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Submit Action Taken</DialogTitle>
          <DialogDescription>
            Upload photos and notes for: <strong className="text-foreground">{concernTitle}</strong>
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <form onSubmit={handleSubmit} className="px-6 py-6">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <Label htmlFor="actionStatus">Action Status *</Label>
                    <Select value={actionStatus} onValueChange={(value: 'in-progress' | 'completed') => setActionStatus(value)} disabled={isSubmitting}>
                      <SelectTrigger id="actionStatus">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Select "In Progress" if more work/photos will follow
                    </p>
                  </div>
                </div>

                <div className="space-y-2" onPaste={handlePaste}>
                  <Label>Action Photos * (Max 5, Ctrl+V to paste)</Label>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                    {images.map((image, index) => (
                      <Card key={index} className="relative p-2">
                        <img src={image.url} alt={`Action ${index + 1}`} className="w-full h-24 object-cover rounded" />
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
                    
                    {images.length < 5 && (
                      <Card
                        className="p-2 h-28 flex items-center justify-center cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="text-center">
                          <HugeiconsIcon icon={Image02Icon} className="w-8 h-8 mx-auto text-muted-foreground" />
                          <p className="text-xs text-muted-foreground mt-1">Add Photo</p>
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
                  <Label htmlFor="notes">Action Notes *</Label>
                  <Textarea
                    id="notes"
                    placeholder="Describe the action taken to resolve this concern..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    required
                    disabled={isSubmitting}
                    rows={5}
                  />
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button type="submit" disabled={isSubmitting || isCompressing} className="flex-1">
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
                      'Submit Action'
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting || isCompressing}>
                    Cancel
                  </Button>
                </div>

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
              </div>
            </form>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
