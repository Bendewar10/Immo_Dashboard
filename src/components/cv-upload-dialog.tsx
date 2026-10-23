'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CvReviewDialog, type ParsedCv } from '@/components/cv-review-dialog'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

interface CvUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function CvUploadDialog({ open, onOpenChange, onSaved }: CvUploadDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedCv | null>(null)
  const [storagePath, setStoragePath] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setError(null)
      setParsed(null)
      setStoragePath(null)
    }
    onOpenChange(nextOpen)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError(null)

    if (file.type !== 'application/pdf') {
      setError('Bitte eine PDF-Datei hochladen.')
      return
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('Datei zu groß (max. 10 MB).')
      return
    }

    setIsProcessing(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        setError('Nicht eingeloggt.')
        return
      }

      const path = `${userData.user.id}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('cv-uploads').upload(path, file)
      if (uploadError) {
        setError('Upload fehlgeschlagen. Bitte erneut versuchen.')
        return
      }

      const response = await fetch('/api/cv-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: path }),
      })

      if (!response.ok) {
        setError('Lebenslauf konnte nicht ausgelesen werden. Du kannst Einträge stattdessen manuell anlegen.')
        return
      }

      const result = (await response.json()) as ParsedCv
      setParsed(result)
      setStoragePath(path)
      setReviewOpen(true)
      onOpenChange(false)
    } catch {
      setError('Verbindung fehlgeschlagen. Bitte erneut versuchen.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lebenslauf hochladen</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              aria-label="Lebenslauf-PDF"
              disabled={isProcessing}
              className="text-sm"
            />
            {isProcessing && <p className="text-sm text-muted-foreground">Lebenslauf wird ausgelesen...</p>}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={isProcessing}>
              Abbrechen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {parsed && storagePath && (
        <CvReviewDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          parsed={parsed}
          storagePath={storagePath}
          onSaved={() => {
            setParsed(null)
            setStoragePath(null)
            onSaved()
          }}
        />
      )}
    </>
  )
}
