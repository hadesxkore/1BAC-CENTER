import imageCompression from 'browser-image-compression'

// Cloudinary configuration
export const cloudinaryConfig = {
  cloudName: "dt7yizyhv",
  apiKey: "213377112433499",
  presetName: "1BAC_CENTER"
}

// Helper function to get Cloudinary upload URL
export const getCloudinaryUploadUrl = () => {
  return `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`
}

// Helper function to compress image if larger than 1.5MB
export const compressImage = async (file: File): Promise<File> => {
  const fileSizeInMB = file.size / 1024 / 1024
  
  // Only compress if file is larger than 1.2MB (reduced threshold)
  if (fileSizeInMB > 1.2) {
    const options = {
      maxSizeMB: 1, // Reduced to 1MB for faster compression
      maxWidthOrHeight: 1400, // Reduced resolution for faster upload
      useWebWorker: true,
      fileType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
      initialQuality: 0.75, // Lower quality for faster compression
      alwaysKeepResolution: false, // Allow resolution reduction
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

// Helper function to upload image to Cloudinary (without compression - compression done separately)
export const uploadToCloudinaryDirect = async (file: File) => {
  const formData = new FormData()
  formData.append("file", file)
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
  onProgress?: (completed: number, total: number) => void
) => {
  // Step 1: Compress all images in parallel first
  const compressionPromises = files.map(file => compressImage(file))
  const compressedFiles = await Promise.all(compressionPromises)
  
  // Step 2: Upload all compressed images in parallel
  const uploadPromises = compressedFiles.map(async (file, index) => {
    try {
      const result = await uploadToCloudinaryDirect(file)
      if (onProgress) {
        onProgress(index + 1, files.length)
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
