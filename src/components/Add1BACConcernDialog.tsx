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
import { uploadToCloudinary, uploadMultipleToCloudinary, compressImage } from '@/config/cloudinary'
import { db } from '@/config/firebase'
import { collection, addDoc, serverTimestamp, query, getDocs, orderBy, limit, where } from 'firebase/firestore'
import { useAppStore } from '@/store'
import { toast } from '@/components/ui/sonner'
import { format } from 'date-fns'
import type { ActionCategory } from '@/data/sampleActions'

interface ConcernImage {
  url: string
  publicId: string
  file?: File
  fileType?: 'image' | 'document'
  fileName?: string
  fileSize?: number
}

interface Add1BACConcernDialogProps {
  collectionName?: string
}

export function Add1BACConcernDialog({ collectionName = '1bac_concerns' }: Add1BACConcernDialogProps = {}) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isCompressing, setIsCompressing] = useState(false)
  const [compressingFileName, setCompressingFileName] = useState('')
  const { user } = useAppStore()
  
  // Load existing report titles from Firestore
  const [savedTitles, setSavedTitles] = useState<string[]>([])
  
  // Form fields
  const [dateReported, setDateReported] = useState<Date | undefined>(undefined)
  const [municipality, setMunicipality] = useState('')
  const [reportTitle, setReportTitle] = useState('')
  const [location, setLocation] = useState('')
  const [caseRemarks, setCaseRemarks] = useState('')
  const [images, setImages] = useState<ConcernImage[]>([])
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load existing report titles from Firestore when dialog opens
  useEffect(() => {
    if (open) {
      loadReportTitles()
    }
  }, [open])

  const loadReportTitles = async () => {
    try {
      const q = query(
        collection(db, collectionName),
        orderBy('createdAt', 'desc'),
        limit(100) // Get last 100 reports
      )
      const snapshot = await getDocs(q)
      
      // Extract unique report titles
      const titles = new Set<string>()
      snapshot.docs.forEach(doc => {
        const title = doc.data().reportTitle
        if (title && title.trim()) {
          titles.add(title.trim())
        }
      })
      
      setSavedTitles(Array.from(titles))
    } catch (error) {
      console.error('Error loading report titles:', error)
      // Silently fail - not critical
    }
  }

  // Generate tracking number: 1BAC-{YEAR}-{SEQUENTIAL}
  const generateTrackingNo = async (): Promise<string> => {
    const year = new Date().getFullYear().toString()
    const prefix = `1BAC-${year}-`

    const q = query(
      collection(db, collectionName),
      orderBy('trackingNo', 'desc'),
      limit(1)
    )

    const snapshot = await getDocs(q)

    if (snapshot.empty) {
      return `${prefix}001`
    }

    const lastTrackingNo = snapshot.docs[0].data().trackingNo
    if (!lastTrackingNo || !lastTrackingNo.startsWith(prefix)) {
      return `${prefix}001`
    }

    const lastSeq = parseInt(lastTrackingNo.split('-')[2], 10)
    const newSeq = lastSeq + 1
    return `${prefix}${String(newSeq).padStart(3, '0')}`
  }

  // Auto-assign based on municipality
  const handleMunicipalityChange = (value: string) => {
    setMunicipality(value)
  }

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return
    
    setIsCompressing(true)
    const newImages: ConcernImage[] = []
    
    for (let i = 0; i < Math.min(files.length, 5 - images.length); i++) {
      const file = files[i]
      const fileSizeInMB = file.size / 1024 / 1024
      
      // Check if it's an image or document
      const isImage = file.type.startsWith('image/')
      const isDocument = file.type.includes('pdf') || 
                        file.type.includes('document') || 
                        file.type.includes('word') ||
                        file.type.includes('sheet') ||
                        file.type.includes('text')
      
      if (isImage || isDocument) {
        let processedFile = file
        
        // Compress if file is larger than 3MB
        if (fileSizeInMB > 3) {
          setCompressingFileName(file.name)
          toast.info(`Compressing ${file.name}... (${fileSizeInMB.toFixed(2)}MB)`)
          
          if (isImage) {
            // Compress image
            processedFile = await compressImage(file)
            const compressedSizeInMB = processedFile.size / 1024 / 1024
            toast.success(`Compressed to ${compressedSizeInMB.toFixed(2)}MB`)
          } else {
            // For documents, we can't compress them the same way
            // Just show a warning
            toast.warning(`Large file: ${file.name} (${fileSizeInMB.toFixed(2)}MB)`)
          }
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
    
    setImages([...images, ...newImages])
    setIsCompressing(false)
    setCompressingFileName('')
    
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
    
    if (!dateReported) {
      toast.error('Please select date reported')
      return
    }
    
    if (images.length === 0) {
      toast.error('Please upload at least one image')
      return
    }
    
    setIsSubmitting(true)
    setUploadProgress(0)
    
    try {
      const totalImages = images.length
      
      // Prepare files for parallel upload
      const files = images.map(img => img.file!).filter(Boolean)
      
      // Upload images with progress tracking
      const results = await uploadMultipleToCloudinary(files, (completed, total, stage) => {
        if (stage === 'compressing') {
          const progress = (completed / total) * 50 // First 50% for compression
          setUploadProgress(progress)
          if (completed === 0) {
            toast.info(`Compressing ${totalImages} images...`)
          }
        } else {
          const progress = 50 + (completed / total) * 50 // Last 50% for upload
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
      
      const uploadedImages = results.map(r => ({
        url: r.url!,
        publicId: r.publicId!,
      }))
      
      toast.info('Saving to database...')
      
      // Save to Firestore
      const trackingNo = await generateTrackingNo()
      const concernData = {
        trackingNo,
        dateReported: format(dateReported, 'yyyy-MM-dd'),
        dateUploaded: serverTimestamp(),
        municipality,
        category: '1BAC', // Default category for 1BAC concerns
        assignedTo: `1BAC-${municipality.replace(' City', '').toUpperCase()}`, // Auto-generate from municipality
        reportTitle,
        location,
        caseRemarks,
        concernPhotos: uploadedImages,
        answeredBy: user?.name || 'Unknown',
        reportedBy: user?.name || 'Unknown',
        actionTaken: null,
        actionDate: null,
        status: 'under-action',
        createdAt: serverTimestamp(),
        createdBy: user?.id || '',
      }
      
      await addDoc(collection(db, collectionName), concernData)
      
      toast.success('Concern Reported Successfully!', {
        description: `Uploaded ${totalImages} images and saved report`,
      })
      
      // Reset form
      setDateReported(undefined)
      setMunicipality('')
      setReportTitle('')
      setLocation('')
      setCaseRemarks('')
      setImages([])
      setUploadProgress(0)
      setOpen(false)
      
    } catch (error) {
      console.error('Error submitting concern:', error)
      toast.error('Failed to submit concern', {
        description: error instanceof Error ? error.message : 'Please try again'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <HugeiconsIcon icon={Add01Icon} className="w-4 h-4 mr-2" />
          Add Concern
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[95vw] lg:max-w-5xl h-[90vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Report New Concern</DialogTitle>
          <DialogDescription>
            Fill in the details below to submit a new concern report
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reportTitle">Report Title *</Label>
                  <Autocomplete
                    value={reportTitle}
                    onValueChange={setReportTitle}
                    options={savedTitles}
                    placeholder="Type report title..."
                    searchPlaceholder="Search previous titles or type new one..."
                    emptyText="No previous titles. Type your custom title."
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Suggestions are based on previously entered titles
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

                <div className="flex gap-2 pt-4 border-t">
                  <Button type="submit" disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
                        />
                        <span>Processing...</span>
                      </div>
                    ) : (
                      'Submit Report'
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
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
                        <span className="text-muted-foreground">
                          {uploadProgress < 50 
                            ? 'Compressing images...' 
                            : uploadProgress < 100 
                            ? 'Uploading to cloud...' 
                            : 'Saving to database...'}
                        </span>
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
