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
import { Checkbox } from '@/components/ui/checkbox'
import { HugeiconsIcon } from '@hugeicons/react'
import { Image02Icon, Delete02Icon, File02Icon, FileAttachmentIcon } from '@hugeicons/core-free-icons'
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
  const [compressingFileName, setCompressingFileName] = useState('')
  const [notes, setNotes] = useState('')
  const [actionDate, setActionDate] = useState<Date | undefined>(undefined)
  const [actionStatus, setActionStatus] = useState<'in-progress' | 'completed'>('completed')
  const [skipActionDate, setSkipActionDate] = useState(false)
  const [images, setImages] = useState<ConcernImage[]>([])
  const { user } = useAppStore()
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return
    
    setIsCompressing(true)
    const newImages: (ConcernImage & { file?: File })[] = []
    
    for (let i = 0; i < Math.min(files.length, 5 - images.length); i++) {
      const file = files[i]
      const fileSizeInMB = file.size / 1024 / 1024
      
      // Check if it's an image or document
      const isImage = file.type.startsWith('image/')
      const isPDF = file.type === 'application/pdf'
      const isDocument = isPDF || 
                        file.type.includes('document') || 
                        file.type.includes('word') ||
                        file.type.includes('sheet') ||
                        file.type.includes('text') ||
                        file.type.includes('msword') ||
                        file.type.includes('officedocument')
      
      if (isImage || isDocument) {
        let processedFile = file
        
        // Compress images if larger than 3MB
        if (isImage && fileSizeInMB > 3) {
          setCompressingFileName(file.name)
          toast.info(`Compressing ${file.name}... (${fileSizeInMB.toFixed(2)}MB)`, {
            duration: 5000
          })
          processedFile = await compressImage(file)
          const compressedSizeInMB = processedFile.size / 1024 / 1024
          toast.success(`✓ Compressed to ${compressedSizeInMB.toFixed(2)}MB`)
        }
        // PDFs: Strict 2MB limit (browser compression not effective for PDFs with images)
        else if (isPDF && fileSizeInMB > 2) {
          toast.error(
            `PDF too large: ${file.name} (${fileSizeInMB.toFixed(2)}MB). Maximum size is 2MB.`,
            {
              duration: 10000,
              description: 'Please compress your PDF using external tools first',
              action: {
                label: 'Compress PDF',
                onClick: () => window.open('https://www.ilovepdf.com/compress_pdf', '_blank')
              }
            }
          )
          continue // Skip this file
        }
        // Reject other documents if larger than 2MB
        else if (isDocument && !isPDF && fileSizeInMB > 2) {
          toast.error(`Document too large: ${file.name} (${fileSizeInMB.toFixed(2)}MB). Maximum size is 2MB.`, {
            duration: 5000
          })
          continue // Skip this file
        }
        
        const url = URL.createObjectURL(processedFile)
        newImages.push({ 
          url, 
          publicId: '', 
          file: processedFile,
          fileType: isImage ? 'image' : 'document',
          fileName: file.name,
          fileSize: processedFile.size
        })
      } else {
        toast.error(`Unsupported file type: ${file.name}`)
      }
    }
    
    setImages([...images, ...newImages] as ConcernImage[])
    setIsCompressing(false)
    setCompressingFileName('')
    
    if (files.length + images.length > 5) {
      toast.warning('Maximum 5 files allowed')
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

    if (!notes.trim()) {
      toast.error('Please provide action notes')
      return
    }

    if (!skipActionDate && !actionDate) {
      toast.error('Please select action date or check "No specific date"')
      return
    }
    
    setIsSubmitting(true)
    setUploadProgress(0)
    
    try {
      let uploadedImages: { url: string; publicId: string }[] = []
      
      // Only upload images if there are any
      if (images.length > 0) {
        const totalImages = images.length
        
        // Prepare files for parallel upload
        const files = images.map(img => (img as ConcernImage & { file?: File }).file!).filter(Boolean)
        
        // Upload images with progress tracking
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
          throw new Error(`Failed to upload ${failedUploads.length} image(s)`)
        }
        
        uploadedImages = results.map((r, index) => ({
          url: r.url!,
          publicId: r.publicId!,
          fileType: images[index].fileType,
          fileName: images[index].fileName,
          fileSize: images[index].fileSize,
        }))
      }
      
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
        actionDate: skipActionDate ? 'Ongoing' : format(actionDate!, 'yyyy-MM-dd'),
        status: actionStatus,
        updatedAt: serverTimestamp(),
      })
      
      // Call parent callback if provided
      if (onSubmit) {
        onSubmit(actionTakenData)
      }
      
      const statusText = actionStatus === 'completed' ? 'completed' : 'in progress'
      const photoText = images.length > 0 
        ? `Uploaded ${images.length} image(s) and marked as ${statusText}` 
        : `Marked as ${statusText} (photos to follow)`
      
      toast.success('Action Submitted Successfully!', {
        description: photoText,
      })
      
      // Reset form
      setNotes('')
      setActionDate(undefined)
      setSkipActionDate(false)
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
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="px-6 py-6">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="actionDate">Action Date {!skipActionDate && '*'}</Label>
                    <DatePicker
                      date={actionDate}
                      onDateChange={setActionDate}
                      placeholder="Select action date"
                      disabled={isSubmitting || skipActionDate}
                      maxDate={new Date()}
                    />
                    <div className="flex items-center space-x-2 mt-2">
                      <Checkbox 
                        id="skipDate" 
                        checked={skipActionDate}
                        onCheckedChange={(checked) => {
                          setSkipActionDate(checked as boolean)
                          if (checked) setActionDate(undefined)
                        }}
                        disabled={isSubmitting}
                      />
                      <label
                        htmlFor="skipDate"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        No specific date (Ongoing)
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {skipActionDate 
                        ? 'Action date will be marked as "Ongoing"' 
                        : 'Select the date when the action was taken'}
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
                  <Label>Action Files (Optional - Max 5, Images/Documents)</Label>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                    {images.map((image, index) => (
                      <Card key={index} className="relative p-2">
                        {image.fileType === 'document' ? (
                          <div className="w-full h-24 flex flex-col items-center justify-center bg-muted rounded">
                            <HugeiconsIcon icon={File02Icon} className="w-8 h-8 text-blue-600" />
                            <p className="text-[10px] text-center mt-1 px-1 truncate w-full">
                              {image.fileName || 'Document'}
                            </p>
                            <p className="text-[9px] text-muted-foreground">
                              {((image.fileSize || 0) / 1024 / 1024).toFixed(2)}MB
                            </p>
                          </div>
                        ) : (
                          <img src={image.url} alt={`Action ${index + 1}`} className="w-full h-24 object-cover rounded" />
                        )}
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
                          <HugeiconsIcon icon={FileAttachmentIcon} className="w-8 h-8 mx-auto text-muted-foreground" />
                          <p className="text-xs text-muted-foreground mt-1">Add File</p>
                        </div>
                      </Card>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files)}
                    disabled={isSubmitting || isCompressing}
                  />
                  <p className="text-xs text-muted-foreground">
                    Files are optional - Supports images and documents (PDF, Word, Excel, Text). Images &gt; 3MB will be compressed. PDFs must be under 2MB (use iLovePDF if needed).
                  </p>
                  
                  {/* Compression Loading Animation */}
                  <AnimatePresence>
                    {isCompressing && compressingFileName && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800"
                      >
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            Compressing file...
                          </p>
                          <p className="text-xs text-blue-700 dark:text-blue-300 truncate">
                            {compressingFileName}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
          </div>
        </div>
      </form>
      </DialogContent>
    </Dialog>
  )
}
