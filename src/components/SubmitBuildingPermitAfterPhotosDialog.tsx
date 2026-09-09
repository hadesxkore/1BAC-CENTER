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
                    className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 text-center"
                  >
                    <HugeiconsIcon icon={Image02Icon} className="w-10 h-10 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Click to select after photos</p>
                    <p className="text-xs text-muted-foreground mt-1">Upload photos verifying building permit resolution</p>
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
