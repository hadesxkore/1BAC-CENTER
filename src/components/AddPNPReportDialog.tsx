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
import { Autocomplete } from '@/components/ui/autocomplete'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, Image02Icon, Delete02Icon } from '@hugeicons/core-free-icons'
import { BATAAN_MUNICIPALITIES } from '@/data/municipalities'
import { uploadToCloudinary, compressImage } from '@/config/cloudinary'
import { db } from '@/config/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { useAppStore } from '@/store'
import { toast } from 'sonner'
import { format } from 'date-fns'

const PNP_REPORT_TITLE_SUGGESTIONS = [
  'ALLEGED ILLEGAL PATULO',
  'ALLEGED ILLEGAL GAMBLING',
  'ALLEGED ILLEGAL GRO BAR',
  'ALLEGED ILLEGAL TUPADA',
  'ALLEGED ILLEGAL PUSHER',
  'ALLEGED ILLEGAL USER',
  'ALLEGED ILLEGAL SELLING',
  'ALLEGED ILLEGAL USER & PUSHER',
  'ALLEGED ILLEGAL USER & PUSHER & SELLING',
  'ALLEGED ILLEGAL POSSESSION OF AMMUNITION',
  'ALLEGED ILLEGAL FIREARMS',
]

interface PhotoImage {
  url: string
  publicId: string
  file?: File
}

export function AddPNPReportDialog() {
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
    setPhotos(photos.filter((_, i) => i !== index))
  }

  // Cleanup object URLs when component unmounts or dialog closes
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

    if (afterPhotos.length > 0 && !actionDate) {
      toast.error('Please select action date for after photos')
      return
    }
    
    setIsSubmitting(true)
    setUploadProgress(0)
    
    try {
      // Upload before photos
      const uploadedBeforePhotos: { url: string; publicId: string }[] = []
      const totalBeforeImages = beforePhotos.length
      
      for (let i = 0; i < beforePhotos.length; i++) {
        const image = beforePhotos[i]
        if (image.file) {
          toast.info(`Uploading before photo ${i + 1} of ${totalBeforeImages}...`)
          const result = await uploadToCloudinary(image.file)
          if (result.success) {
            uploadedBeforePhotos.push({
              url: result.url!,
              publicId: result.publicId!,
            })
            setUploadProgress(((i + 1) / (totalBeforeImages + afterPhotos.length)) * 100)
          } else {
            throw new Error(`Failed to upload before photo ${i + 1}`)
          }
        }
      }
      
      // Upload after photos (if any)
      const uploadedAfterPhotos: { url: string; publicId: string }[] = []
      const totalAfterImages = afterPhotos.length
      
      for (let i = 0; i < afterPhotos.length; i++) {
        const image = afterPhotos[i]
        if (image.file) {
          toast.info(`Uploading after photo ${i + 1} of ${totalAfterImages}...`)
          const result = await uploadToCloudinary(image.file)
          if (result.success) {
            uploadedAfterPhotos.push({
              url: result.url!,
              publicId: result.publicId!,
            })
            setUploadProgress(((totalBeforeImages + i + 1) / (totalBeforeImages + totalAfterImages)) * 100)
          } else {
            throw new Error(`Failed to upload after photo ${i + 1}`)
          }
        }
      }
      
      // Save to Firestore
      const reportData: any = {
        dateReported: format(dateReported, 'yyyy-MM-dd'),
        dateUploaded: serverTimestamp(),
        municipality,
        reportTitle,
        location,
        remarks,
        beforePhotos: uploadedBeforePhotos,
        status: afterPhotos.length > 0 ? 'completed' : 'pending',
        reportedBy: user?.name || 'Unknown',
        createdAt: serverTimestamp(),
        createdBy: user?.id || '',
      }
      
      // Only add afterPhotos if there are photos
      if (uploadedAfterPhotos.length > 0 && actionDate) {
        reportData.afterPhotos = {
          photos: uploadedAfterPhotos,
          notes: afterNotes.trim() || 'Initial completion',
          actionDate: format(actionDate, 'yyyy-MM-dd'),
          submittedBy: user?.name || 'Unknown',
          submittedAt: new Date().toISOString(),
        }
      } else {
        reportData.afterPhotos = null
      }
      
      await addDoc(collection(db, 'pnp_reports'), reportData)
      
      toast.success('PNP Report Submitted Successfully!', {
        description: 'Your report has been submitted',
      })
      
      // Reset form
      setDateReported(undefined)
      setMunicipality('')
      setReportTitle('')
      setLocation('')
      setRemarks('')
      setBeforePhotos([])
      setAfterPhotos([])
      setAfterNotes('')
      setActionDate(undefined)
      setUploadProgress(0)
      setOpen(false)
      
    } catch (error) {
      console.error('Error submitting PNP report:', error)
      toast.error('Failed to submit report', {
        description: error instanceof Error ? error.message : 'Please try again'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <HugeiconsIcon icon={Add01Icon} className="w-4 h-4 mr-2" />
          Add PNP Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[95vw] lg:max-w-5xl h-[90vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-blue-200">
          <DialogTitle className="text-blue-700">Add New PNP Report</DialogTitle>
          <DialogDescription>
            Fill in the details below to submit a new PNP report
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
                  <Autocomplete
                    value={reportTitle}
                    onValueChange={setReportTitle}
                    options={PNP_REPORT_TITLE_SUGGESTIONS}
                    placeholder="Select or type report title..."
                    searchPlaceholder="Search or type custom title..."
                    emptyText="No suggestions found. Type your custom title."
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Select from suggestions or type your own custom title
                  </p>
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
                      <Label htmlFor="afterNotes">Action Notes (Optional)</Label>
                      <Textarea
                        id="afterNotes"
                        placeholder="Describe the action taken..."
                        value={afterNotes}
                        onChange={(e) => setAfterNotes(e.target.value)}
                        disabled={isSubmitting}
                        rows={4}
                      />
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
                      'Submit Report'
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
