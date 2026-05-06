import imageCompression from 'browser-image-compression'

// Cloudinary configuration
export const cloudinaryConfig = {
  cloudName: "dt7yizyhv",
  apiKey: "213377112433499",
  presetName: "1BAC_CENTER",
  rawPresetName: "1BAC_CENTER_RAW" // For documents (PDF, Word, Excel, etc.)
}

// Helper function to get Cloudinary upload URL
export const getCloudinaryUploadUrl = (resourceType: 'image' | 'raw' = 'image') => {
  return `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/${resourceType}/upload`
}

// Helper function to compress image - AGGRESSIVE OPTIMIZATION
export const compressImage = async (file: File): Promise<File> => {
  const fileSizeInMB = file.size / 1024 / 1024
  
  // Compress all images over 800KB for faster uploads
  if (fileSizeInMB > 0.8) {
    const options = {
      maxSizeMB: 0.5, // Target 500KB for much faster uploads
      maxWidthOrHeight: 1200, // Lower resolution - still good for viewing
      useWebWorker: true,
      fileType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
      initialQuality: 0.7, // Balanced quality for speed
      alwaysKeepResolution: false,
    }
    
    try {
      const compressedFile = await imageCompression(file, options)
      return compressedFile
    } catch (error) {
      console.error('Error compressing image:', error)
      return file // Return original if compression fails
    }
  }
  
  return file
}

// Helper function to convert file to base64 for browser-based viewing
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = error => reject(error)
  })
}

// Helper function to upload file to Cloudinary (supports images and documents)
export const uploadToCloudinaryDirect = async (file: File) => {
  const formData = new FormData()
  
  // Determine if it's an image or document
  const isImage = file.type.startsWith('image/')
  const resourceType = isImage ? 'image' : 'raw'
  const presetName = isImage ? cloudinaryConfig.presetName : cloudinaryConfig.rawPresetName
  
  // For documents, use base64 for browser viewing instead of Cloudinary
  if (!isImage) {
    try {
      const base64Url = await fileToBase64(file)
      return {
        success: true,
        url: base64Url, // Store as base64 data URL
        publicId: `local_${Date.now()}`, // Generate local ID
        data: { resource_type: 'raw' },
        resourceType: 'raw',
      }
    } catch (error) {
      console.error("Error converting file to base64:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "File conversion failed",
      }
    }
  }
  
  // For images, upload to Cloudinary as usual
  formData.append("file", file)
  formData.append("upload_preset", presetName)

  try {
    // Add timeout to prevent hanging uploads
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    const response = await fetch(getCloudinaryUploadUrl(resourceType), {
      method: "POST",
      body: formData,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error("Upload failed")
    }

    const data = await response.json()
    
    return {
      success: true,
      url: data.secure_url,
      publicId: data.public_id,
      data,
      resourceType: resourceType,
    }
  } catch (error) {
    console.error("Cloudinary upload error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    }
  }
}

// Helper function to upload image to Cloudinary
export const uploadToCloudinary = async (file: File) => {
  const formData = new FormData()
  
  // Compress image if needed
  const processedFile = await compressImage(file)
  
  formData.append("file", processedFile)
  formData.append("upload_preset", cloudinaryConfig.presetName)

  try {
    const response = await fetch(getCloudinaryUploadUrl(), {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error("Upload failed")
    }

    const data = await response.json()
    return {
      success: true,
      url: data.secure_url,
      publicId: data.public_id,
      data,
    }
  } catch (error) {
    console.error("Cloudinary upload error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    }
  }
}

// Helper function to upload multiple images in parallel with compression
export const uploadMultipleToCloudinary = async (
  files: File[],
  onProgress?: (completed: number, total: number, stage: 'compressing' | 'uploading') => void
) => {
  // Step 1: Compress all images in parallel first
  if (onProgress) onProgress(0, files.length, 'compressing')
  
  const compressionPromises = files.map(async (file, index) => {
    const compressed = await compressImage(file)
    if (onProgress) onProgress(index + 1, files.length, 'compressing')
    return compressed
  })
  
  const compressedFiles = await Promise.all(compressionPromises)
  
  // Step 2: Upload all compressed images in parallel
  if (onProgress) onProgress(0, files.length, 'uploading')
  
  const uploadPromises = compressedFiles.map(async (file, index) => {
    try {
      const result = await uploadToCloudinaryDirect(file)
      if (onProgress) {
        onProgress(index + 1, files.length, 'uploading')
      }
      return result
    } catch (error) {
      console.error(`Error uploading file ${index + 1}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      }
    }
  })

  return Promise.all(uploadPromises)
}

// Helper function to get optimized image URL
export const getOptimizedImageUrl = (
  publicId: string,
  options?: {
    width?: number
    height?: number
    crop?: string
    quality?: string | number
  }
) => {
  const { width, height, crop = "fill", quality = "auto" } = options || {}
  
  let transformation = `q_${quality}`
  if (width) transformation += `,w_${width}`
  if (height) transformation += `,h_${height}`
  transformation += `,c_${crop}`

  return `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/image/upload/${transformation}/${publicId}`
}
