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
import { Edit02Icon, Image02Icon, Delete02Icon } from '@hugeicons/core-free-icons'
import { BATAAN_MUNICIPALITIES } from '@/data/municipalities'
import { uploadToCloudinary, compressImage } from '@/config/cloudinary'
import { db } from '@/config/firebase'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface PNPReport {
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
  status: 'pending' | 'completed'
}

interface PhotoImage {
  url: string
  publicId: string
  file?: File
}

interface EditPNPReportDialogProps {
  report: PNPReport
}

export function EditPNPReportDialog({ report }: EditPNPReportDialogProps) {
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
  const [beforePhotos, setBeforePhotos] = useState<PhotoImage[]>(report.beforePhotos)
  const [afterPhotos, setAfterPhotos] = useState<PhotoImage[]>(report.afterPhotos?.photos || [])
  const [afterNotes, setAfterNotes] = useState(report.afterPhotos?.notes || '')
  const [actionDate, setActionDate] = useState<Date | undefined>(
    report.afterPhotos?.actionDate ? new Date(report.afterPhotos.actionDate) : undefined
  )
  
  const beforeFileInputRef = useRef<HTMLInputElement>(null)
  const afterFileInputRef = useRef<HTMLInputElement>(null)

  // Reset form when dialog opens (only when opening, not when report updates)
  useEffect(() => {
    if (open) {
      setDateReported(report.dateReported ? new Date(report.dateReported) : undefined)
      setMunicipality(report.municipality)
      setReportTitle(report.reportTitle)
      setLocation(report.location)
      setRemarks(report.remarks)
      setBeforePhotos(report.beforePhotos)
      setAfterPhotos(report.afterPhotos?.photos || [])
      setAfterNotes(report.afterPhotos?.notes || '')
      setActionDate(report.afterPhotos?.actionDate ? new Date(report.afterPhotos.actionDate) : undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]) // Only depend on 'open', not 'report'

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

  const handlePaste = (e: React.ClipboardEvent, type: 'before' | 'after') => {
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
      handleFileSelect(dt.files, type)
    }
  }

  const removeImage = (index: number, type: 'before' | 'after') => {
    const photos = type === 'before' ? beforePhotos : afterPhotos
    const setPhotos = type === 'before' ? setBeforePhotos : setAfterPhotos
    
    const imageToRemove = photos[index]
    if (imageToRemove.url.startsWith('blob:')) {
      URL.revokeObjectURL(imageToRemove.url)
    }
    const newPhotos = photos.filter((_, i) => i !== index)
    setPhotos(newPhotos)
    
    // If removing the last after photo, also clear after notes and action date
    if (type === 'after' && newPhotos.length === 0) {
      setAfterNotes('')
      setActionDate(undefined)
      toast.info('All after photos cleared - status will be set to pending')
    }
  }

  // Cleanup object URLs when component unmounts
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!dateReported) {
      toast.error('Please select date reported')
      return
    }
    
    if (beforePhotos.length === 0) {
      toast.error('Please upload at least one before photo')
      return
    }
    
    setIsSubmitting(true)
    setUploadProgress(0)
    
    try {
      // Upload new before photos
      const uploadedBeforePhotos: { url: string; publicId: string }[] = []
      const newBeforePhotos = beforePhotos.filter(img => img.file)
      const existingBeforePhotos = beforePhotos.filter(img => !img.file)
      
      uploadedBeforePhotos.push(...existingBeforePhotos)
      
      if (newBeforePhotos.length > 0) {
        const totalImages = newBeforePhotos.length
        for (let i = 0; i < newBeforePhotos.length; i++) {
          const image = newBeforePhotos[i]
          if (image.file) {
            toast.info(`Uploading before photo ${i + 1} of ${totalImages}...`)
            const result = await uploadToCloudinary(image.file)
            if (result.success) {
              uploadedBeforePhotos.push({
                url: result.url!,
                publicId: result.publicId!,
              })
              setUploadProgress(((i + 1) / (newBeforePhotos.length + afterPhotos.filter(img => img.file).length)) * 100)
            } else {
              throw new Error(`Failed to upload before photo ${i + 1}`)
            }
          }
        }
      }
      
      // Upload new after photos
      const uploadedAfterPhotos: { url: string; publicId: string }[] = []
      const newAfterPhotos = afterPhotos.filter(img => img.file)
      const existingAfterPhotos = afterPhotos.filter(img => !img.file)
      
      uploadedAfterPhotos.push(...existingAfterPhotos)
      
      if (newAfterPhotos.length > 0) {
        const totalImages = newAfterPhotos.length
        for (let i = 0; i < newAfterPhotos.length; i++) {
          const image = newAfterPhotos[i]
          if (image.file) {
            toast.info(`Uploading after photo ${i + 1} of ${totalImages}...`)
            const result = await uploadToCloudinary(image.file)
            if (result.success) {
              uploadedAfterPhotos.push({
                url: result.url!,
                publicId: result.publicId!,
              })
              setUploadProgress(((newBeforePhotos.length + i + 1) / (newBeforePhotos.length + newAfterPhotos.length)) * 100)
            } else {
              throw new Error(`Failed to upload after photo ${i + 1}`)
            }
          }
        }
      }
      
      // Update Firestore
      const reportRef = doc(db, 'pnp_reports', report.id)
      const updateData: any = {
        dateReported: format(dateReported, 'yyyy-MM-dd'),
        municipality,
        reportTitle,
        location,
        remarks,
        beforePhotos: uploadedBeforePhotos,
        updatedAt: serverTimestamp(),
      }
      
      // Check if user has any after data
      const hasAfterData = uploadedAfterPhotos.length > 0 || afterNotes.trim().length > 0
      
      // Update or remove afterPhotos
      if (hasAfterData) {
        // User has after data - update it
        updateData.afterPhotos = {
          photos: uploadedAfterPhotos,
          notes: afterNotes.trim(),
          actionDate: actionDate ? format(actionDate, 'yyyy-MM-dd') : (report.afterPhotos?.actionDate || new Date().toISOString().split('T')[0]),
          submittedBy: report.afterPhotos?.submittedBy || 'Unknown',
          submittedAt: report.afterPhotos?.submittedAt || new Date().toISOString(),
        }
        updateData.status = 'completed'
      } else {
        // No after data - explicitly remove it and set status to pending
        updateData.afterPhotos = null
        updateData.status = 'pending'
      }
      
      await updateDoc(reportRef, updateData)
      
      toast.success('PNP Report Updated Successfully!', {
        description: 'Your changes have been saved',
      })
      
      setUploadProgress(0)
      setOpen(false)
      
    } catch (error) {
      console.error('Error updating PNP report:', error)
      toast.error('Failed to update report', {
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
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-blue-200">
          <DialogTitle className="text-blue-700">Edit PNP Report</DialogTitle>
          <DialogDescription>
            Update the report details below
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <form onSubmit={handleSubmit} className="px-6 py-6">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateReported">Date Reported *</Label>
                    <DatePicker
                      date={dateReported}
                      onDateChange={setDateReported}
                      placeholder="Select date reported"
                      disabled={isSubmitting}
                      maxDate={new Date()}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="municipality">Municipality *</Label>
                    <Select value={municipality} onValueChange={setMunicipality} disabled={isSubmitting}>
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reportTitle">Report Title *</Label>
                  <Input
                    id="reportTitle"
                    placeholder="Brief title of the report"
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
                  <Label htmlFor="remarks">Remarks *</Label>
                  <Textarea
                    id="remarks"
                    placeholder="Detailed description of the report..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    required
                    disabled={isSubmitting}
                    rows={4}
                  />
                </div>

                {/* Before Photos */}
                <div className="space-y-2" onPaste={(e) => handlePaste(e, 'before')}>
                  <Label>Before Photos * (Max 5, Ctrl+V to paste)</Label>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                    {beforePhotos.map((image, index) => (
                      <Card key={index} className="relative p-2 border-blue-200">
                        <img src={image.url} alt={`Before ${index + 1}`} className="w-full h-24 object-cover rounded" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-xs"
                          className="absolute top-1 right-1"
                          onClick={() => removeImage(index, 'before')}
                          disabled={isSubmitting}
                        >
                          <HugeiconsIcon icon={Delete02Icon} className="w-3 h-3" />
                        </Button>
                      </Card>
                    ))}
                    
                    {beforePhotos.length < 5 && (
                      <Card
                        className="p-2 h-28 flex items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors border-blue-200"
                        onClick={() => beforeFileInputRef.current?.click()}
                      >
                        <div className="text-center">
                          <HugeiconsIcon icon={Image02Icon} className="w-8 h-8 mx-auto text-blue-600" />
                          <p className="text-xs text-blue-600 mt-1">Add Before</p>
                        </div>
                      </Card>
                    )}
                  </div>
                  <input
                    ref={beforeFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files, 'before')}
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Click to upload or paste images (Ctrl+V)
                  </p>
                </div>

                {/* After Photos */}
                <div className="space-y-2" onPaste={(e) => handlePaste(e, 'after')}>
                  <Label>After Photos (Optional, Max 5, Ctrl+V to paste)</Label>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                    {afterPhotos.map((image, index) => (
                      <Card key={index} className="relative p-2 border-green-200">
                        <img src={image.url} alt={`After ${index + 1}`} className="w-full h-24 object-cover rounded" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-xs"
                          className="absolute top-1 right-1"
                          onClick={() => removeImage(index, 'after')}
                          disabled={isSubmitting}
                        >
                          <HugeiconsIcon icon={Delete02Icon} className="w-3 h-3" />
                        </Button>
                      </Card>
                    ))}
                    
                    {afterPhotos.length < 5 && (
                      <Card
                        className="p-2 h-28 flex items-center justify-center cursor-pointer hover:bg-green-50 transition-colors border-green-200"
                        onClick={() => afterFileInputRef.current?.click()}
                      >
                        <div className="text-center">
                          <HugeiconsIcon icon={Image02Icon} className="w-8 h-8 mx-auto text-green-600" />
                          <p className="text-xs text-green-600 mt-1">Add After</p>
                        </div>
                      </Card>
                    )}
                  </div>
                  <input
                    ref={afterFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files, 'after')}
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    If after photos are provided, status will be marked as completed
                  </p>
                </div>

                {/* After Notes (only show if there are after photos) */}
                {afterPhotos.length > 0 && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="afterNotes">Action Notes</Label>
                      <Textarea
                        id="afterNotes"
                        placeholder="Describe the action taken..."
                        value={afterNotes}
                        onChange={(e) => setAfterNotes(e.target.value)}
                        disabled={isSubmitting}
                        rows={4}
                      />
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
                  </>
                )}

                <div className="flex gap-2 pt-4 border-t">
                  <Button type="submit" disabled={isSubmitting || isCompressing} className="flex-1 bg-blue-600 hover:bg-blue-700">
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
                      'Update Report'
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
