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
  
  // Only compress if file is larger than 1.5MB
  if (fileSizeInMB > 1.5) {
    const options = {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
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
