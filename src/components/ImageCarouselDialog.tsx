import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon, Cancel01Icon, Download01Icon, ZoomInAreaIcon } from '@hugeicons/core-free-icons'

interface ImageCarouselDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  images: Array<{ url: string; caption?: string }>
  title?: string
}

export default function ImageCarouselDialog({
  open,
  onOpenChange,
  images,
  title = 'Images',
}: ImageCarouselDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const handlePrevious = useCallback(() => {
    setIsLoading(true)
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }, [images.length])

  const handleNext = useCallback(() => {
    setIsLoading(true)
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }, [images.length])

  const handleClose = () => {
    onOpenChange(false)
    setTimeout(() => setCurrentIndex(0), 200)
  }

  const handleSelect = (index: number) => {
    if (index === currentIndex) return
    setIsLoading(true)
    setCurrentIndex(index)
  }

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrevious()
      if (e.key === 'ArrowRight') handleNext()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, handlePrevious, handleNext])

  const handleDownload = async () => {
    try {
      const response = await fetch(images[currentIndex].url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `image-${currentIndex + 1}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed', err)
    }
  }

  if (images.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl p-0 gap-0 bg-white border border-neutral-200 overflow-hidden rounded-xl shadow-xl [&>button]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-neutral-200 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <h3 className="text-sm font-semibold text-neutral-900 tracking-tight truncate">
              {title}
            </h3>
            <div className="h-4 w-px bg-neutral-200" />
            <span className="text-xs text-neutral-500 font-medium tabular-nums">
              {currentIndex + 1} of {images.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
            >
              <HugeiconsIcon icon={Download01Icon} className="w-3.5 h-3.5" />
              Download
            </button>
            <div className="w-px h-5 bg-neutral-200 mx-1" />
            <button
              onClick={handleClose}
              className="inline-flex items-center justify-center h-8 w-8 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image Display */}
        <div className="relative flex items-center justify-center bg-neutral-50 min-h-[480px] max-h-[65vh] group overflow-hidden">
          {/* Subtle grid background */}
          <div
            className="absolute inset-0 opacity-[0.4]"
            style={{
              backgroundImage:
                'radial-gradient(circle, #00000010 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />

          {/* Loader */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-neutral-50">
              <div className="w-5 h-5 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
            </div>
          )}

          <img
            key={currentIndex}
            src={images[currentIndex].url}
            alt={images[currentIndex].caption || `Image ${currentIndex + 1}`}
            onLoad={() => setIsLoading(false)}
            className={`relative max-w-[90%] max-h-[60vh] object-contain select-none transition-opacity duration-200 ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
            draggable={false}
          />

          {/* Navigation Buttons */}
          {images.length > 1 && (
            <>
              <button
                onClick={handlePrevious}
                aria-label="Previous"
                className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-md bg-white text-neutral-700 hover:text-neutral-900 border border-neutral-200 shadow-sm hover:shadow-md hover:border-neutral-300 transition-all duration-150 active:scale-95"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4" />
              </button>
              <button
                onClick={handleNext}
                aria-label="Next"
                className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-md bg-white text-neutral-700 hover:text-neutral-900 border border-neutral-200 shadow-sm hover:shadow-md hover:border-neutral-300 transition-all duration-150 active:scale-95"
              >
                <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Keyboard hint */}
          <div className="absolute bottom-4 right-4 hidden md:flex items-center gap-1.5 text-[11px] text-neutral-400 font-medium">
            <kbd className="px-1.5 py-0.5 bg-white border border-neutral-200 rounded text-[10px] font-mono shadow-sm">←</kbd>
            <kbd className="px-1.5 py-0.5 bg-white border border-neutral-200 rounded text-[10px] font-mono shadow-sm">→</kbd>
            <span className="ml-1">to navigate</span>
          </div>
        </div>

        {/* Caption */}
        {images[currentIndex].caption && (
          <div className="px-5 py-3 border-t border-neutral-200 bg-white">
            <p className="text-sm text-neutral-600 leading-relaxed">
              {images[currentIndex].caption}
            </p>
          </div>
        )}

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="border-t border-neutral-200 bg-neutral-50/50 px-4 py-3">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-thin">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => handleSelect(index)}
                  className={`relative flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border transition-all duration-150 ${
                    index === currentIndex
                      ? 'border-neutral-900 ring-2 ring-neutral-900/10'
                      : 'border-neutral-200 hover:border-neutral-400 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={image.url}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
