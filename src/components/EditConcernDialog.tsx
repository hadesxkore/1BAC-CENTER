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
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { HugeiconsIcon } from '@hugeicons/react'
import { Edit02Icon, Image02Icon, Delete02Icon } from '@hugeicons/core-free-icons'
import { BATAAN_MUNICIPALITIES } from '@/data/municipalities'
import { uploadToCloudinary, compressImage } from '@/config/cloudinary'
import { db } from '@/config/firebase'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { toast } from '@/components/ui/sonner'
import { format } from 'date-fns'
import type { Action, ActionCategory, ActionType, ActionRecord } from '@/data/sampleActions'

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
  fileType?: 'image' | 'document'
  fileName?: string
  fileSize?: number
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
  
  // Determine which action types exist
  const pgoActions = concern.actionHistory?.filter(a => a.actionType === 'pgo') || []
  const deptActions = concern.actionHistory?.filter(a => a.actionType === 'department') || []
  const hasPgoAction = pgoActions.length > 0
  const hasDeptAction = deptActions.length > 0
  const hasBothActions = hasPgoAction && hasDeptAction
  
  // Get latest action of each type
  const latestPgo = hasPgoAction ? pgoActions[pgoActions.length - 1] : null
  const latestDept = hasDeptAction ? deptActions[deptActions.length - 1] : null
  
  // Action tab selection
  const [selectedActionTab, setSelectedActionTab] = useState<ActionType>(
    hasPgoAction ? 'pgo' : hasDeptAction ? 'department' : 'pgo'
  )
  
  // Form fields
  const [dateReported, setDateReported] = useState(concern.dateReported)
  const [municipality, setMunicipality] = useState(concern.municipality)
  const [category, setCategory] = useState<ActionCategory>(concern.category)
  const [assignedTo, setAssignedTo] = useState(concern.assignedTo)
  const [showAssignedTo, setShowAssignedTo] = useState(!!concern.assignedTo)
  const [reportTitle, setReportTitle] = useState(concern.reportTitle)
  const [location, setLocation] = useState(concern.location)
  const [coordText, setCoordText] = useState(concern.coordinates || '')
  const [caseRemarks, setCaseRemarks] = useState(concern.caseRemarks)
  const [images, setImages] = useState<ConcernImage[]>(concern.concernPhotos || [])
  
  // Action taken fields - PGO
  const [pgoActionPhotos, setPgoActionPhotos] = useState<ConcernImage[]>(
    latestPgo?.photos || []
  )
  const [pgoActionNotes, setPgoActionNotes] = useState(latestPgo?.notes || '')
  const [pgoActionOtherInfo, setPgoActionOtherInfo] = useState(latestPgo?.otherInfo || '')
  const [pgoActionDate, setPgoActionDate] = useState<Date | undefined>(
    latestPgo && latestPgo.actionDate !== 'Ongoing' 
      ? new Date(latestPgo.actionDate) 
      : undefined
  )
  const [skipPgoActionDate, setSkipPgoActionDate] = useState(latestPgo?.actionDate === 'Ongoing')
  
  // Action taken fields - Department
  const [deptActionPhotos, setDeptActionPhotos] = useState<ConcernImage[]>(
    latestDept?.photos || []
  )
  const [deptActionNotes, setDeptActionNotes] = useState(latestDept?.notes || '')
  const [deptActionOtherInfo, setDeptActionOtherInfo] = useState(latestDept?.otherInfo || '')
  const [deptActionDate, setDeptActionDate] = useState<Date | undefined>(
    latestDept && latestDept.actionDate !== 'Ongoing' 
      ? new Date(latestDept.actionDate) 
      : undefined
  )
  const [skipDeptActionDate, setSkipDeptActionDate] = useState(latestDept?.actionDate === 'Ongoing')
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pgoFileInputRef = useRef<HTMLInputElement>(null)
  const deptFileInputRef = useRef<HTMLInputElement>(null)

  // Reset form when dialog opens (only when opening, not when concern updates)
  useEffect(() => {
    if (open) {
      // Recalculate action data when opening
      const pgo = concern.actionHistory?.filter(a => a.actionType === 'pgo') || []
      const dept = concern.actionHistory?.filter(a => a.actionType === 'department') || []
      const latestPgoAction = pgo.length > 0 ? pgo[pgo.length - 1] : null
      const latestDeptAction = dept.length > 0 ? dept[dept.length - 1] : null
      
      setDateReported(concern.dateReported)
      setMunicipality(concern.municipality)
      setCategory(concern.category)
      setAssignedTo(concern.assignedTo)
      setShowAssignedTo(!!concern.assignedTo)
      setReportTitle(concern.reportTitle)
      setLocation(concern.location)
      setCoordText(concern.coordinates || '')
      setCaseRemarks(concern.caseRemarks)
      setImages(concern.concernPhotos || [])
      
      // PGO action
      setPgoActionPhotos(latestPgoAction?.photos || [])
      setPgoActionNotes(latestPgoAction?.notes || '')
      setPgoActionOtherInfo(latestPgoAction?.otherInfo || '')
      setPgoActionDate(
        latestPgoAction && latestPgoAction.actionDate !== 'Ongoing' 
          ? new Date(latestPgoAction.actionDate) 
          : undefined
      )
      setSkipPgoActionDate(latestPgoAction?.actionDate === 'Ongoing')
      
      // Department action
      setDeptActionPhotos(latestDeptAction?.photos || [])
      setDeptActionNotes(latestDeptAction?.notes || '')
      setDeptActionOtherInfo(latestDeptAction?.otherInfo || '')
      setDeptActionDate(
        latestDeptAction && latestDeptAction.actionDate !== 'Ongoing' 
          ? new Date(latestDeptAction.actionDate) 
          : undefined
      )
      setSkipDeptActionDate(latestDeptAction?.actionDate === 'Ongoing')
      
      // Set default tab
      setSelectedActionTab(pgo.length > 0 ? 'pgo' : dept.length > 0 ? 'department' : 'pgo')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]) // Only depend on 'open', not 'concern'

  // Auto-assign based on category
  const handleCategoryChange = (value: ActionCategory) => {
    setCategory(value)
    if (value === 'agricultural' && municipality) {
      const municipalityName = municipality.replace(' City', '').toUpperCase()
      setAssignedTo(`AGRI-${municipalityName}`)
      setShowAssignedTo(true)
    } else if (value === 'environmental') {
      setAssignedTo('')
      setShowAssignedTo(true)
    } else {
      setAssignedTo('')
      setShowAssignedTo(false)
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
    
    const currentPhotos = selectedActionTab === 'pgo' ? pgoActionPhotos : deptActionPhotos
    const setActionPhotos = selectedActionTab === 'pgo' ? setPgoActionPhotos : setDeptActionPhotos
    
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
    
    setActionPhotos([...currentPhotos, ...newImages] as ConcernImage[])
    setIsCompressing(false)
    
    if (files.length + currentPhotos.length > 5) {
      toast.warning('Maximum 5 action photos allowed')
    }
  }

  const removeActionPhoto = (index: number) => {
    const currentPhotos = selectedActionTab === 'pgo' ? pgoActionPhotos : deptActionPhotos
    const setActionPhotos = selectedActionTab === 'pgo' ? setPgoActionPhotos : setDeptActionPhotos
    const setActionNotes = selectedActionTab === 'pgo' ? setPgoActionNotes : setDeptActionNotes
    const setActionOtherInfo = selectedActionTab === 'pgo' ? setPgoActionOtherInfo : setDeptActionOtherInfo
    const setActionDate = selectedActionTab === 'pgo' ? setPgoActionDate : setDeptActionDate
    const setSkipActionDate = selectedActionTab === 'pgo' ? setSkipPgoActionDate : setSkipDeptActionDate
    
    const imageToRemove = currentPhotos[index]
    // Clean up object URL to prevent memory leak
    if (imageToRemove.url.startsWith('blob:')) {
      URL.revokeObjectURL(imageToRemove.url)
    }
    const newActionPhotos = currentPhotos.filter((_, i) => i !== index)
    setActionPhotos(newActionPhotos)
    
    // If removing the last photo, also clear action notes and date for this action type
    if (newActionPhotos.length === 0) {
      setActionNotes('')
      setActionOtherInfo('')
      setActionDate(undefined)
      setSkipActionDate(false)
      const actionLabel = selectedActionTab === 'pgo' ? 'PGO' : 'Department'
      toast.info(`${actionLabel} action data cleared`)
    }
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
      pgoActionPhotos.forEach(image => {
        if (image.url.startsWith('blob:')) {
          URL.revokeObjectURL(image.url)
        }
      })
      deptActionPhotos.forEach(image => {
        if (image.url.startsWith('blob:')) {
          URL.revokeObjectURL(image.url)
        }
      })
    }
  }, [images, pgoActionPhotos, deptActionPhotos])

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
              setUploadProgress(((i + 1) / totalImages) * 33) // First 33% for concern images
            } else {
              throw new Error(`Failed to upload concern image ${i + 1}`)
            }
          }
        }
      }
      
      // Upload PGO action photos
      const uploadedPgoActionPhotos: { url: string; publicId: string }[] = []
      const newPgoPhotosToUpload = pgoActionPhotos.filter(img => (img as ConcernImage & { file?: File }).file)
      const existingPgoPhotos = pgoActionPhotos.filter(img => !(img as ConcernImage & { file?: File }).file)
      
      uploadedPgoActionPhotos.push(...existingPgoPhotos)
      
      if (newPgoPhotosToUpload.length > 0) {
        const totalPgoPhotos = newPgoPhotosToUpload.length
        
        for (let i = 0; i < newPgoPhotosToUpload.length; i++) {
          const image = newPgoPhotosToUpload[i]
          const file = (image as ConcernImage & { file?: File }).file
          if (file) {
            toast.info(`Uploading PGO action photo ${i + 1} of ${totalPgoPhotos}...`)
            const result = await uploadToCloudinary(file)
            if (result.success) {
              uploadedPgoActionPhotos.push({
                url: result.url!,
                publicId: result.publicId!,
              })
              setUploadProgress(33 + ((i + 1) / totalPgoPhotos) * 33) // Middle 33%
            } else {
              throw new Error(`Failed to upload PGO photo ${i + 1}`)
            }
          }
        }
      }
      
      // Upload Department action photos
      const uploadedDeptActionPhotos: { url: string; publicId: string }[] = []
      const newDeptPhotosToUpload = deptActionPhotos.filter(img => (img as ConcernImage & { file?: File }).file)
      const existingDeptPhotos = deptActionPhotos.filter(img => !(img as ConcernImage & { file?: File }).file)
      
      uploadedDeptActionPhotos.push(...existingDeptPhotos)
      
      if (newDeptPhotosToUpload.length > 0) {
        const totalDeptPhotos = newDeptPhotosToUpload.length
        
        for (let i = 0; i < newDeptPhotosToUpload.length; i++) {
          const image = newDeptPhotosToUpload[i]
          const file = (image as ConcernImage & { file?: File }).file
          if (file) {
            toast.info(`Uploading Department action photo ${i + 1} of ${totalDeptPhotos}...`)
            const result = await uploadToCloudinary(file)
            if (result.success) {
              uploadedDeptActionPhotos.push({
                url: result.url!,
                publicId: result.publicId!,
              })
              setUploadProgress(66 + ((i + 1) / totalDeptPhotos) * 34) // Last 34%
            } else {
              throw new Error(`Failed to upload Department photo ${i + 1}`)
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

      if (coordText.trim()) {
        updateData.coordinates = coordText.trim()
      } else {
        updateData.coordinates = null
      }
      
      // Build actionHistory array
      const newActionHistory: ActionRecord[] = []
      
      // Check PGO action data
      const hasPgoPhotos = uploadedPgoActionPhotos.length > 0
      const hasPgoNotes = pgoActionNotes.trim().length > 0
      const hasPgoData = hasPgoPhotos || hasPgoNotes
      
      if (hasPgoData && latestPgo) {
        // Update existing PGO action
        newActionHistory.push({
          ...latestPgo,
          photos: uploadedPgoActionPhotos,
          notes: pgoActionNotes.trim(),
          otherInfo: pgoActionOtherInfo.trim() || undefined,
          actionDate: skipPgoActionDate ? 'Ongoing' : (pgoActionDate ? format(pgoActionDate, 'yyyy-MM-dd') : latestPgo.actionDate),
        })
      } else if (hasPgoData && !latestPgo) {
        // Create new PGO action
        newActionHistory.push({
          actionId: `pgo-${Date.now()}`,
          actionType: 'pgo' as ActionType,
          photos: uploadedPgoActionPhotos,
          notes: pgoActionNotes.trim(),
          otherInfo: pgoActionOtherInfo.trim() || undefined,
          submittedBy: 'Admin',
          submittedAt: new Date().toISOString(),
          actionDate: skipPgoActionDate ? 'Ongoing' : (pgoActionDate ? format(pgoActionDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')),
        })
      } else if (latestPgo && !hasPgoData) {
        // User removed PGO action - don't include it
        toast.info('PGO action removed')
      }
      
      // Check Department action data
      const hasDeptPhotos = uploadedDeptActionPhotos.length > 0
      const hasDeptNotes = deptActionNotes.trim().length > 0
      const hasDeptData = hasDeptPhotos || hasDeptNotes
      
      if (hasDeptData && latestDept) {
        // Update existing Department action
        newActionHistory.push({
          ...latestDept,
          photos: uploadedDeptActionPhotos,
          notes: deptActionNotes.trim(),
          otherInfo: deptActionOtherInfo.trim() || undefined,
          actionDate: skipDeptActionDate ? 'Ongoing' : (deptActionDate ? format(deptActionDate, 'yyyy-MM-dd') : latestDept.actionDate),
        })
      } else if (hasDeptData && !latestDept) {
        // Create new Department action
        newActionHistory.push({
          actionId: `dept-${Date.now()}`,
          actionType: 'department' as ActionType,
          photos: uploadedDeptActionPhotos,
          notes: deptActionNotes.trim(),
          otherInfo: deptActionOtherInfo.trim() || undefined,
          submittedBy: 'Admin',
          submittedAt: new Date().toISOString(),
          actionDate: skipDeptActionDate ? 'Ongoing' : (deptActionDate ? format(deptActionDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')),
        })
      } else if (latestDept && !hasDeptData) {
        // User removed Department action - don't include it
        toast.info('Department action removed')
      }
      
      // Update actionHistory and tracking fields
      updateData.actionHistory = newActionHistory
      updateData.pgoInvolved = newActionHistory.some(a => a.actionType === 'pgo')
      updateData.hasPgoAction = newActionHistory.some(a => a.actionType === 'pgo')
      updateData.hasDepartmentAction = newActionHistory.some(a => a.actionType === 'department')
      
      // Only set latestActionType if there are actions (Firebase doesn't allow undefined)
      if (newActionHistory.length > 0) {
        updateData.latestActionType = newActionHistory[newActionHistory.length - 1].actionType
      } else {
        updateData.latestActionType = null
      }
      
      // Determine latest action date for actionDate field
      if (newActionHistory.length > 0) {
        const latestAction = newActionHistory[newActionHistory.length - 1]
        updateData.actionDate = latestAction.actionDate
      } else {
        updateData.actionDate = null
      }
      
      // Keep legacy actionTaken for backwards compatibility
      if (newActionHistory.length > 0) {
        const latestAction = newActionHistory[newActionHistory.length - 1]
        updateData.actionTaken = {
          photos: latestAction.photos,
          notes: latestAction.notes,
          otherInfo: latestAction.otherInfo,
          submittedBy: latestAction.submittedBy,
          submittedAt: latestAction.submittedAt,
        }
      } else {
        updateData.actionTaken = null
        updateData.status = 'pending'
      }
      
      console.log('Edit Submit - Update data:', updateData)
      
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

  // Render function for action fields based on type
  const renderActionFields = (actionType: 'pgo' | 'department') => {
    const photos = actionType === 'pgo' ? pgoActionPhotos : deptActionPhotos
    const notes = actionType === 'pgo' ? pgoActionNotes : deptActionNotes
    const otherInfo = actionType === 'pgo' ? pgoActionOtherInfo : deptActionOtherInfo
    const actionDateValue = actionType === 'pgo' ? pgoActionDate : deptActionDate
    const skipDate = actionType === 'pgo' ? skipPgoActionDate : skipDeptActionDate
    const setPhotos = actionType === 'pgo' ? setPgoActionPhotos : setDeptActionPhotos
    const setNotes = actionType === 'pgo' ? setPgoActionNotes : setDeptActionNotes
    const setOtherInfo = actionType === 'pgo' ? setPgoActionOtherInfo : setDeptActionOtherInfo
    const setActionDateValue = actionType === 'pgo' ? setPgoActionDate : setDeptActionDate
    const setSkipDate = actionType === 'pgo' ? setSkipPgoActionDate : setSkipDeptActionDate
    const fileInputRef = actionType === 'pgo' ? pgoFileInputRef : deptFileInputRef
    const label = actionType === 'pgo' ? '🟣 PGO' : '🏢 Department'

    return (
      <>
        <div className="space-y-2">
          <Label>{label} Action Files (Max 5)</Label>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {photos.map((image, index) => (
              <Card key={index} className="relative p-2">
                {image.fileType === 'document' ? (
                  <div className="w-full h-24 flex flex-col items-center justify-center bg-muted rounded">
                    <HugeiconsIcon icon={Image02Icon} className="w-8 h-8 text-blue-600" />
                    <p className="text-[10px] text-center mt-1 px-1 truncate w-full">
                      {image.fileName || 'Document'}
                    </p>
                    {image.fileSize && (
                      <p className="text-[9px] text-muted-foreground">
                        {(image.fileSize / 1024 / 1024).toFixed(2)}MB
                      </p>
                    )}
                  </div>
                ) : (
                  <img src={image.url} alt={`Action ${index + 1}`} className="w-full h-24 object-cover rounded" />
                )}
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
            
            {photos.length < 5 && (
              <Card
                className="p-2 h-28 flex items-center justify-center cursor-pointer hover:bg-muted transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="text-center">
                  <HugeiconsIcon icon={Image02Icon} className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-xs text-muted-foreground mt-1">Add File</p>
                </div>
              </Card>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            multiple
            className="hidden"
            onChange={(e) => handleActionFileSelect(e.target.files)}
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground">
            Click to add, remove, or replace action files (images/documents)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${actionType}ActionNotes`}>{label} Action Notes</Label>
          <Textarea
            id={`${actionType}ActionNotes`}
            placeholder={`${label} action notes...`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSubmitting}
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${actionType}OtherInfo`}>{label} Other Information (Optional)</Label>
          <Textarea
            id={`${actionType}OtherInfo`}
            placeholder="Additional information..."
            value={otherInfo}
            onChange={(e) => setOtherInfo(e.target.value)}
            disabled={isSubmitting}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${actionType}ActionDate`}>{label} Action Date {!skipDate && '*'}</Label>
          <DatePicker
            date={actionDateValue}
            onDateChange={setActionDateValue}
            placeholder="Select action date"
            disabled={isSubmitting || skipDate}
            maxDate={new Date()}
          />
          <div className="flex items-center space-x-2 mt-2">
            <Checkbox 
              id={`${actionType}SkipActionDate`}
              checked={skipDate}
              onCheckedChange={(checked) => {
                setSkipDate(checked as boolean)
                if (checked) setActionDateValue(undefined)
              }}
              disabled={isSubmitting}
            />
            <label
              htmlFor={`${actionType}SkipActionDate`}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              No specific date (Ongoing)
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            {skipDate 
              ? 'Action date will be marked as "Ongoing"' 
              : 'Select the date when the action was taken'}
          </p>
        </div>
      </>
    )
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

                  {/* Assigned To Field - stays in grid */}
                  {showAssignedTo && category === 'environmental' && (
                    <div className="space-y-2">
                      <Label htmlFor="assignedTo">Assign To</Label>
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

                  {showAssignedTo && category === 'agricultural' && municipality && (
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

                {/* Assigned To Toggle - below grid */}
                {category && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showAssignedTo"
                      checked={showAssignedTo}
                      onCheckedChange={(checked) => {
                        setShowAssignedTo(checked as boolean)
                        if (!checked) {
                          setAssignedTo('')
                        } else if (category === 'agricultural' && municipality) {
                          const municipalityName = municipality.replace(' City', '').toUpperCase()
                          setAssignedTo(`AGRI-${municipalityName}`)
                        }
                      }}
                      disabled={isSubmitting}
                    />
                    <Label
                      htmlFor="showAssignedTo"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Assign to specific officer (optional)
                    </Label>
                  </div>
                )}

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
                  <Label htmlFor="coordText">Coordinates</Label>
                  <Input
                    id="coordText"
                    placeholder={`14°35'08.1"N 120°35'18.7"E`}
                    value={coordText}
                    onChange={(e) => setCoordText(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Enter in any format — will be displayed exactly as typed on exports
                  </p>
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

                {/* Action Taken Photos Section with Tabs */}
                {(hasPgoAction || hasDeptAction) && (
                  <>
                    <div className="border-t pt-6">
                      <h3 className="text-lg font-semibold mb-4">Edit Action Taken</h3>
                    </div>

                    {hasBothActions ? (
                      <Tabs value={selectedActionTab} onValueChange={(v) => setSelectedActionTab(v as ActionType)} className="w-full">
                        <TabsList variant="line" className="w-full justify-start">
                          <TabsTrigger value="pgo">
                            <span className="mr-1.5">🟣</span>
                            PGO Action
                          </TabsTrigger>
                          <TabsTrigger value="department">
                            <span className="mr-1.5">🏢</span>
                            Department Action
                          </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="pgo" className="space-y-4 mt-4">
                          {renderActionFields('pgo')}
                        </TabsContent>
                        
                        <TabsContent value="department" className="space-y-4 mt-4">
                          {renderActionFields('department')}
                        </TabsContent>
                      </Tabs>
                    ) : (
                      <div className="space-y-4">
                        {hasPgoAction && renderActionFields('pgo')}
                        {hasDeptAction && renderActionFields('department')}
                      </div>
                    )}
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
