'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { X } from 'lucide-react'

export interface ParsedEducation {
  institution: string
  degree: string | null
  field_of_study: string | null
  city: string | null
  start_date: string | null
  end_date: string | null
}

export interface ParsedEmployment {
  employer: string
  job_title: string | null
  city: string | null
  start_date: string | null
  end_date: string | null
  description: string | null
}

export interface ParsedCv {
  headline: string | null
  education: ParsedEducation[]
  employment: ParsedEmployment[]
  skills: string[]
  languages: string[]
}

interface EducationRow extends ParsedEducation {
  included: boolean
}

interface EmploymentRow extends ParsedEmployment {
  included: boolean
}

interface CvReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parsed: ParsedCv | null
  storagePath: string
  onSaved: () => void
}

export function CvReviewDialog({ open, onOpenChange, parsed, storagePath, onSaved }: CvReviewDialogProps) {
  const [headline, setHeadline] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [educationRows, setEducationRows] = useState<EducationRow[]>([])
  const [employmentRows, setEmploymentRows] = useState<EmploymentRow[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open && parsed) {
      setHeadline(parsed.headline ?? '')
      setSkills(parsed.skills)
      setLanguages(parsed.languages)
      setEducationRows(parsed.education.map((entry) => ({ ...entry, included: true })))
      setEmploymentRows(parsed.employment.map((entry) => ({ ...entry, included: true })))
      setSubmitError(null)
    }
  }, [open, parsed])

  function toggleEducation(index: number) {
    setEducationRows((rows) => rows.map((row, i) => (i === index ? { ...row, included: !row.included } : row)))
  }

  function updateEducationField(index: number, field: keyof ParsedEducation, value: string) {
    setEducationRows((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value || null } : row)))
  }

  function toggleEmployment(index: number) {
    setEmploymentRows((rows) => rows.map((row, i) => (i === index ? { ...row, included: !row.included } : row)))
  }

  function updateEmploymentField(index: number, field: keyof ParsedEmployment, value: string) {
    setEmploymentRows((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value || null } : row)))
  }

  function removeSkill(skill: string) {
    setSkills((current) => current.filter((s) => s !== skill))
  }

  function removeLanguage(language: string) {
    setLanguages((current) => current.filter((l) => l !== language))
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) setSubmitError(null)
    onOpenChange(nextOpen)
  }

  async function handleConfirm() {
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        setSubmitError('Nicht eingeloggt.')
        return
      }
      const userId = userData.user.id

      const educationToInsert = educationRows
        .filter((row) => row.included)
        .map(({ included, ...entry }) => ({ ...entry, user_id: userId }))
      if (educationToInsert.length > 0) {
        const { error } = await supabase.from('user_education').insert(educationToInsert)
        if (error) throw error
      }

      const employmentToInsert = employmentRows
        .filter((row) => row.included)
        .map(({ included, ...entry }) => ({ ...entry, user_id: userId }))
      if (employmentToInsert.length > 0) {
        const { error } = await supabase.from('user_employment').insert(employmentToInsert)
        if (error) throw error
      }

      const { error: profileError } = await supabase.from('user_profile').upsert(
        {
          user_id: userId,
          headline: headline.trim() || null,
          skills,
          languages,
          cv_file_path: storagePath,
          cv_uploaded_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      if (profileError) throw profileError

      onOpenChange(false)
      onSaved()
    } catch {
      setSubmitError('Speichern fehlgeschlagen. Bitte erneut versuchen.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!parsed) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Erkannte Lebenslauf-Daten prüfen</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 pr-4 text-sm">
            <div className="space-y-2">
              <h3 className="font-medium">Kurzbeschreibung</h3>
              <Input
                placeholder="z. B. Senior Consultant, Strategy & Operations"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
              />
            </div>

            {educationRows.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium">Ausbildung ({educationRows.length})</h3>
                {educationRows.map((row, index) => (
                  <div key={index} className="flex items-start gap-3 rounded-md border p-3">
                    <Checkbox
                      checked={row.included}
                      onCheckedChange={() => toggleEducation(index)}
                      aria-label={`${row.institution} übernehmen`}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Institution"
                        value={row.institution}
                        onChange={(e) => updateEducationField(index, 'institution', e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Abschluss"
                          value={row.degree ?? ''}
                          onChange={(e) => updateEducationField(index, 'degree', e.target.value)}
                        />
                        <Input
                          placeholder="Fachrichtung"
                          value={row.field_of_study ?? ''}
                          onChange={(e) => updateEducationField(index, 'field_of_study', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {employmentRows.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium">Berufserfahrung ({employmentRows.length})</h3>
                {employmentRows.map((row, index) => (
                  <div key={index} className="flex items-start gap-3 rounded-md border p-3">
                    <Checkbox
                      checked={row.included}
                      onCheckedChange={() => toggleEmployment(index)}
                      aria-label={`${row.employer} übernehmen`}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Arbeitgeber"
                        value={row.employer}
                        onChange={(e) => updateEmploymentField(index, 'employer', e.target.value)}
                      />
                      <Input
                        placeholder="Rolle"
                        value={row.job_title ?? ''}
                        onChange={(e) => updateEmploymentField(index, 'job_title', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {skills.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium">Skills</h3>
                <div className="flex flex-wrap gap-1">
                  {skills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="gap-1">
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)} aria-label={`${skill} entfernen`}>
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {languages.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium">Sprachen</h3>
                <div className="flex flex-wrap gap-1">
                  {languages.map((language) => (
                    <Badge key={language} variant="secondary" className="gap-1">
                      {language}
                      <button
                        type="button"
                        onClick={() => removeLanguage(language)}
                        aria-label={`${language} entfernen`}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {educationRows.length === 0 && employmentRows.length === 0 && (
              <p className="text-muted-foreground">
                Keine Ausbildungs- oder Werdegang-Einträge im Lebenslauf erkannt. Du kannst sie nachträglich manuell
                hinzufügen.
              </p>
            )}

            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Wird gespeichert...' : 'Bestätigen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
