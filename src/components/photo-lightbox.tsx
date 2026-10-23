'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface PhotoLightboxProps {
  src: string | null
  alt: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Zeigt ein Kontaktfoto vergrößert. Nutzt den shadcn-Dialog als Overlay.
export function PhotoLightbox({ src, alt, open, onOpenChange }: PhotoLightboxProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-2 sm:p-3">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            className="mx-auto h-auto max-h-[80vh] w-full rounded-lg object-contain"
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
