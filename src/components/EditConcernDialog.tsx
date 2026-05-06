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
import { HugeiconsIcon } from '@hugeicons/react'
import { Edit02Icon, Image02Icon, Delete02Icon } from '@hugeicons/core-free-icons'
import { BATAAN_MUNICIPALITIES } from '@/data/municipalities'
import { uploadToCloudinary, compressImage } from '@/config/cloudinary'
import { db } from '@/config/firebase'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { toast } from 'sonner'
import type { Action, ActionCategory } from '@/data/sampleActions'

const ENVIRONMENTAL_OFFICERS = [
  'Juan Dela Cruz - MENRO',
  'Pedro Garcia - PENRO',
  'Miguel Torres - CENRO',
  'Iza Santos - PGENRO',
]

interface ConcernImage {
  url: string
  publicId: string
  file?: File
}

interface EditConcernDialogProps {
  concern: Action
  collectionName?: string
}

export function EditConcernDialog({ concern, collectionName = 'concerns' }: EditConcernDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isCompressing, setIsCompressing] = useState(false)
  
  // Form fields
  const [dateReported, setDateReported] = useState(concern.dateReported)
  const [municipality, setMunicipality] = useState(concern.municipality)
  const [category, setCategory] = useState<ActionCategory>(concern.category)
  const [assignedTo, setAssignedTo] = useState(concern.assignedTo)
  const [reportTitle, setReportTitle] = useState(concern.reportTitle)
  const [location, setLocation] = useState(concern.location)
  const [caseRemarks, setCaseRemarks] = useState(concern.caseRemarks)
  const [images, setImages] = useState<ConcernImage[]>(concern.concernPhotos)
  
  // Action taken fields
  const [actionPhotos, setActionPhotos] = useState<ConcernImage[]>(
    concern.actionTaken?.photos || []
  )
  const [actionNotes, setActionNotes] = useState(concern.actionTaken?.notes || '')
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const actionFileInputRef = useRef<HTMLInputElement>(null)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setDateReported(concern.dateReported)
      setMunicipality(concern.municipality)
      setCategory(concern.category)
      setAssignedTo(concern.assignedTo)
      setReportTitle(concern.reportTitle)
      setLocation(concern.location)
      setCaseRemarks(concern.caseRemarks)
      setImages(concern.concernPhotos)
      setActionPhotos(concern.actionTaken?.photos || [])
      setActionNotes(concern.actionTaken?.notes || '')
    }
  }, [open, concern])

  // Auto-assign based on category
  const handleCategoryChange = (value: ActionCategory) => {
    setCategory(value)
    if (value === 'agricultural' && municipality) {
      const municipalityName = municipality.replace(' City', '').toUpperCase()
      setAssignedTo(`AGRI-${municipalityName}`)
    } else {
      setAssignedTo('')
    }
  }

  const handleMunicipalityChange = (value: string) => {
    setMunicipality(value)
    if (category === 'agricultural') {
      const municipalityName = value.replace(' City', '').toUpperCase()
      setAssignedTo(`AGRI-${municipalityName}`)
    }
  }

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return
    
    setIsCompressing(true)
    const newImages: (ConcernImage & { file?: File })[] = []
    
    for (let i = 0; i < Math.min(files.length, 5 - images.length); i++) {
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

  const handleActionFileSelect = async (files: FileList | null) => {
    if (!files) return
    
    setIsCompressing(true)
    const newImages: (ConcernImage & { file?: File })[] = []
    
    for (let i = 0; i < Math.min(files.length, 5 - actionPhotos.length); i++) {
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
    
    setActionPhotos([...actionPhotos, ...newImages] as ConcernImage[])
    setIsCompressing(false)
    
    if (files.length + actionPhotos.length > 5) {
      toast.warning('Maximum 5 action photos allowed')
    }
  }

  const removeActionPhoto = (index: number) => {
    const imageToRemove = actionPhotos[index]
    // Clean up object URL to prevent memory leak
    if (imageToRemove.url.startsWith('blob:')) {
      URL.revokeObjectURL(imageToRemove.url)
    }
    setActionPhotos(actionPhotos.filter((_, i) => i !== index))
  }

  // Cleanup object URLs when component unmounts
  useEffect(() => {
    return () => {
      // Clean up all blob URLs
      images.forEach(image => {
        if (image.url.startsWith('blob:')) {
          URL.revokeObjectURL(image.url)
        }
      })
      actionPhotos.forEach(image => {
        if (image.url.startsWith('blob:')) {
          URL.revokeObjectURL(image.url)
        }
      })
    }
  }, [images, actionPhotos])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (images.length === 0) {
      toast.error('Please upload at least one image')
      return
    }
    
    setIsSubmitting(true)
    setUploadProgress(0)
    
    try {
      // Upload new concern images to Cloudinary
      const uploadedImages: { url: string; publicId: string }[] = []
      const newImagesToUpload = images.filter(img => (img as ConcernImage & { file?: File }).file)
      const existingImages = images.filter(img => !(img as ConcernImage & { file?: File }).file)
      
      // Add existing images
      uploadedImages.push(...existingImages)
      
      // Upload new concern images
      if (newImagesToUpload.length > 0) {
        const totalImages = newImagesToUpload.length
        
        for (let i = 0; i < newImagesToUpload.length; i++) {
          const image = newImagesToUpload[i]
          const file = (image as ConcernImage & { file?: File }).file
          if (file) {
            toast.info(`Uploading concern image ${i + 1} of ${totalImages}...`)
            const result = await uploadToCloudinary(file)
            if (result.success) {
              uploadedImages.push({
                url: result.url!,
                publicId: result.publicId!,
              })
              setUploadProgress(((i + 1) / totalImages) * 50) // First 50% for concern images
            } else {
              throw new Error(`Failed to upload concern image ${i + 1}`)
            }
          }
        }
      }
      
      // Upload new action photos to Cloudinary
      const uploadedActionPhotos: { url: string; publicId: string }[] = []
      const newActionPhotosToUpload = actionPhotos.filter(img => (img as ConcernImage & { file?: File }).file)
      const existingActionPhotos = actionPhotos.filter(img => !(img as ConcernImage & { file?: File }).file)
      
      // Add existing action photos
      uploadedActionPhotos.push(...existingActionPhotos)
      
      // Upload new action photos
      if (newActionPhotosToUpload.length > 0) {
        const totalActionPhotos = newActionPhotosToUpload.length
        
        for (let i = 0; i < newActionPhotosToUpload.length; i++) {
          const image = newActionPhotosToUpload[i]
          const file = (image as ConcernImage & { file?: File }).file
          if (file) {
            toast.info(`Uploading action photo ${i + 1} of ${totalActionPhotos}...`)
            const result = await uploadToCloudinary(file)
            if (result.success) {
              uploadedActionPhotos.push({
                url: result.url!,
                publicId: result.publicId!,
              })
              setUploadProgress(50 + ((i + 1) / totalActionPhotos) * 50) // Last 50% for action photos
            } else {
              throw new Error(`Failed to upload action photo ${i + 1}`)
            }
          }
        }
      }
      
      // Prepare update data
      const updateData: any = {
        dateReported,
        municipality,
        category,
        assignedTo,
        reportTitle,
        location,
        caseRemarks,
        concernPhotos: uploadedImages,
        updatedAt: serverTimestamp(),
      }
      
      // Update action taken if there are action photos or notes
      if (uploadedActionPhotos.length > 0 || actionNotes.trim()) {
        updateData.actionTaken = {
          photos: uploadedActionPhotos,
          notes: actionNotes.trim(),
          submittedBy: concern.actionTaken?.submittedBy || 'Unknown',
          submittedAt: concern.actionTaken?.submittedAt || new Date().toISOString(),
        }
      }
      
      // Update Firestore
      const concernRef = doc(db, collectionName, concern.id)
      await updateDoc(concernRef, updateData)
      
      toast.success('Concern Updated Successfully!', {
        description: 'Your changes have been saved',
      })
      
      setUploadProgress(0)
      setOpen(false)
      
    } catch (error) {
      console.error('Error updating concern:', error)
      toast.error('Failed to update concern', {
        description: error instanceof Error ? error.message : 'Please try again'
      })
    } finally {
      setIsSubmitting(false)
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
      <DialogContent className="max-w-[95vw] sm:max-w-[95vw] lg:max-w-5xl h-[90vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Edit Concern</DialogTitle>
          <DialogDescription>
            Update the concern details below
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <form onSubmit={handleSubmit} className="px-6 py-6">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateReported">Date Reported *</Label>
                    <Input
                      id="dateReported"
                      type="date"
                      value={dateReported}
                      onChange={(e) => setDateReported(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="municipality">Municipality *</Label>
                    <Select value={municipality} onValueChange={handleMunicipalityChange} disabled={isSubmitting}>
                      <SelectTrigger id="municipality">
                        <SelectValue placeholder="Select municipality" />
                      </SelectTrigger>
                      <SelectContent>
                        {BATAAN_MUNICIPALITIES.map((muni) => (
                          <SelectItem key={muni} value={muni}>
                            {muni}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select value={category} onValueChange={handleCategoryChange} disabled={isSubmitting}>
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="environmental">Environmental</SelectItem>
                        <SelectItem value="agricultural">Agricultural</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {category === 'environmental' && (
                    <div className="space-y-2">
                      <Label htmlFor="assignedTo">Assign To *</Label>
                      <Select value={assignedTo} onValueChange={setAssignedTo} disabled={isSubmitting}>
                        <SelectTrigger id="assignedTo">
                          <SelectValue placeholder="Select officer" />
                        </SelectTrigger>
                        <SelectContent>
                          {ENVIRONMENTAL_OFFICERS.map((officer) => (
                            <SelectItem key={officer} value={officer}>
                              {officer}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {category === 'agricultural' && municipality && (
                    <div className="space-y-2">
                      <Label htmlFor="assignedTo">Assigned To</Label>
                      <Input
                        id="assignedTo"
                        value={assignedTo}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reportTitle">Report Title *</Label>
                  <Input
                    id="reportTitle"
                    placeholder="Brief title of the concern"
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Complete Location Address *</Label>
                  <Input
                    id="location"
                    placeholder="Brgy., Street, Municipality, Province"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="caseRemarks">Case Remarks *</Label>
                  <Textarea
                    id="caseRemarks"
                    placeholder="Detailed description of the concern..."
                    value={caseRemarks}
                    onChange={(e) => setCaseRemarks(e.target.value)}
                    required
                    disabled={isSubmitting}
                    rows={4}
                  />
                </div>

                <div className="space-y-2" onPaste={handlePaste}>
                  <Label>Concern Images * (Max 5, Ctrl+V to paste)</Label>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                    {images.map((image, index) => (
                      <Card key={index} className="relative p-2">
                        <img src={image.url} alt={`Concern ${index + 1}`} className="w-full h-24 object-cover rounded" />
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
                          <p className="text-xs text-muted-foreground mt-1">Add Image</p>
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

                {/* Action Taken Photos Section */}
                {concern.actionTaken && (
                  <>
                    <div className="border-t pt-6">
                      <h3 className="text-lg font-semibold mb-4">Action Taken</h3>
                    </div>

                    <div className="space-y-2">
                      <Label>Action Photos (Max 5)</Label>
                      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                        {actionPhotos.map((image, index) => (
                          <Card key={index} className="relative p-2">
                            <img src={image.url} alt={`Action ${index + 1}`} className="w-full h-24 object-cover rounded" />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon-xs"
                              className="absolute top-1 right-1"
                              onClick={() => removeActionPhoto(index)}
                              disabled={isSubmitting}
                            >
                              <HugeiconsIcon icon={Delete02Icon} className="w-3 h-3" />
                            </Button>
                          </Card>
                        ))}
                        
                        {actionPhotos.length < 5 && (
                          <Card
                            className="p-2 h-28 flex items-center justify-center cursor-pointer hover:bg-muted transition-colors"
                            onClick={() => actionFileInputRef.current?.click()}
                          >
                            <div className="text-center">
                              <HugeiconsIcon icon={Image02Icon} className="w-8 h-8 mx-auto text-muted-foreground" />
                              <p className="text-xs text-muted-foreground mt-1">Add Photo</p>
                            </div>
                          </Card>
                        )}
                      </div>
                      <input
                        ref={actionFileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleActionFileSelect(e.target.files)}
                        disabled={isSubmitting}
                      />
                      <p className="text-xs text-muted-foreground">
                        Click to add, remove, or replace action photos
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="actionNotes">Action Notes</Label>
                      <Textarea
                        id="actionNotes"
                        placeholder="Update action notes..."
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                        disabled={isSubmitting}
                        rows={4}
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-2 pt-4 border-t">
                  <Button type="submit" disabled={isSubmitting || isCompressing} className="flex-1">
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
                        />
                        <span>Updating...</span>
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
                      'Update Concern'
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
