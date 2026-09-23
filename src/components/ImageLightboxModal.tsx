import { useEffect, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, ArrowLeft01Icon, ArrowRight01Icon, Download04Icon } from '@hugeicons/core-free-icons'

interface ImageLightboxModalProps {
  images: { url: string; alt?: string }[]
  isOpen: boolean
  onClose: () => void
  onNavigate?: (index: number) => void
  currentIndex?: number
}

export function ImageLightboxModal({
  images,
  isOpen,
  onClose,
  onNavigate,
  currentIndex = 0,
}: ImageLightboxModalProps) {
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < images.length - 1

  const goNext = useCallback(() => {
    if (hasNext) onNavigate?.(currentIndex + 1)
  }, [hasNext, currentIndex, onNavigate])

  const goPrev = useCallback(() => {
    if (hasPrev) onNavigate?.(currentIndex - 1)
  }, [hasPrev, currentIndex, onNavigate])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose, goNext, goPrev])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen || images.length === 0) return null

  const currentImage = images[currentIndex]

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={onClose}
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
    >
      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-white/70 text-sm font-medium select-none">
          {images.length > 1 && `Photo ${currentIndex + 1} of ${images.length}`}
        </span>
        <div className="flex items-center gap-2">
          <a
            href={currentImage.url}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all duration-200"
            title="Download image"
            onClick={(e) => e.stopPropagation()}
          >
            <HugeiconsIcon icon={Download04Icon} className="h-4 w-4" />
          </a>
          <button
            className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all duration-200"
            onClick={(e) => { e.stopPropagation(); onClose() }}
            title="Close (Esc)"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Prev Button */}
      {hasPrev && (
        <button
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all duration-200 backdrop-blur-sm border border-white/10"
          onClick={(e) => { e.stopPropagation(); goPrev() }}
          title="Previous (←)"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="h-5 w-5" />
        </button>
      )}

      {/* Main image */}
      <div
        className="relative flex items-center justify-center max-w-[90vw] max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          key={currentImage.url}
          src={currentImage.url}
          alt={currentImage.alt || `Photo ${currentIndex + 1}`}
          className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
          style={{ animation: 'lightbox-fadein 0.18s ease' }}
          draggable={false}
        />
      </div>

      {/* Next Button */}
      {hasNext && (
        <button
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all duration-200 backdrop-blur-sm border border-white/10"
          onClick={(e) => { e.stopPropagation(); goNext() }}
          title="Next (→)"
        >
          <HugeiconsIcon icon={ArrowRight01Icon} className="h-5 w-5" />
        </button>
      )}

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div
          className="absolute bottom-0 left-0 right-0 flex justify-center gap-2 px-4 py-4 z-10 overflow-x-auto"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => onNavigate?.(i)}
              className={`flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border-2 transition-all duration-200 ${
                i === currentIndex
                  ? 'border-white scale-110 shadow-lg'
                  : 'border-white/30 opacity-60 hover:opacity-90 hover:border-white/60'
              }`}
            >
              <img
                src={img.url}
                alt={img.alt || `Thumb ${i + 1}`}
                className="w-full h-full object-cover"
                draggable={false}
              />
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes lightbox-fadein {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>,
    document.body
  )
}

// ─── Convenience hook ──────────────────────────────────────────────────────────
export function useLightbox() {
  const [lightbox, setLightbox] = useState<{
    isOpen: boolean
    images: { url: string; alt?: string }[]
    index: number
  }>({ isOpen: false, images: [], index: 0 })

  const open = useCallback(
    (images: { url: string; alt?: string }[], index = 0) => {
      setLightbox({ isOpen: true, images, index })
    },
    []
  )

  const close = useCallback(() => {
    setLightbox((prev) => ({ ...prev, isOpen: false }))
  }, [])

  const navigate = useCallback((index: number) => {
    setLightbox((prev) => ({ ...prev, index }))
  }, [])

  return { lightbox, open, close, navigate }
}
