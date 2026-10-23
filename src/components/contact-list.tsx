'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Contact, CATEGORY_LABELS, STRENGTH_LABELS, getCompanyName, getFullName } from '@/lib/contacts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ContactCard } from '@/components/contact-card'
import { ContactFormDialog } from '@/components/contact-form-dialog'
import { CompanyFilterCombobox, type CompanyOption } from '@/components/company-filter-combobox'
import { CompanyHeaderCard } from '@/components/company-header-card'
import { InteractionLogSheet } from '@/components/interaction-log-sheet'
import { LinkedInImportDialog } from '@/components/linkedin-import-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PageHeader } from '@/components/page-header'

const ALL = 'all'

function sortByFollowup(a: Contact, b: Contact) {
  if (!a.next_followup_at && !b.next_followup_at) return 0
  if (!a.next_followup_at) return 1
  if (!b.next_followup_at) return -1
  return new Date(a.next_followup_at).getTime() - new Date(b.next_followup_at).getTime()
}

export function ContactList() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null)
  const [historyContact, setHistoryContact] = useState<Contact | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const [search, setSearch] = useState('')
  const [citySearch, setCitySearch] = useState('')
  const [companySearch, setCompanySearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL)
  const [strengthFilter, setStrengthFilter] = useState<string>(ALL)

  function loadContacts() {
    return supabase
      .from('contacts')
      .select('*')
      .then(({ data }) => {
        setContacts(data ?? [])
        setIsLoading(false)
      })
  }

  // Fire-and-forget: KI-Normalisierung neuer/geänderter Firmennamen anstoßen,
  // danach Liste aktualisieren, damit neue Gruppierungen sichtbar werden
  function triggerNormalization() {
    fetch('/api/normalize-employers', { method: 'POST' })
      .then((res) => {
        if (res.ok) void loadContacts()
      })
      .catch(() => {})
  }

  function handleSaved() {
    void loadContacts()
    triggerNormalization()
  }

  useEffect(() => {
    // Firmen-Filter aus URL übernehmen (Sprungziel für Exit-Ziel-Karten, PROJ-23);
    // bewusst window.location statt useSearchParams — kein Suspense-Boundary nötig
    const firma = new URLSearchParams(window.location.search).get('firma')
    void loadContacts().then(() => {
      if (firma) setCompanyFilter(firma)
    })
  }, [])

  function openCreate() {
    setEditingContact(null)
    setFormOpen(true)
  }

  function openEdit(contact: Contact) {
    setEditingContact(contact)
    setFormOpen(true)
  }

  async function confirmDelete() {
    if (!deletingContact) return
    await supabase.from('contacts').delete().eq('id', deletingContact.id)
    setDeletingContact(null)
    loadContacts()
  }

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase()
    const cityTerm = citySearch.trim().toLowerCase()
    const companyTerm = companySearch.trim().toLowerCase()
    return contacts
      .filter((contact) => !term || getFullName(contact).toLowerCase().includes(term))
      .filter((contact) => !cityTerm || contact.city?.toLowerCase().includes(cityTerm))
      .filter(
        (contact) =>
          !companyTerm ||
          contact.employer?.toLowerCase().includes(companyTerm) ||
          contact.employer_normalized?.toLowerCase().includes(companyTerm) ||
          contact.job_title?.toLowerCase().includes(companyTerm)
      )
      .filter((contact) => !companyFilter || getCompanyName(contact) === companyFilter)
      .filter((contact) => categoryFilter === ALL || contact.category === categoryFilter)
      .filter((contact) => strengthFilter === ALL || String(contact.strength) === strengthFilter)
      .sort(sortByFollowup)
  }, [contacts, search, citySearch, companySearch, companyFilter, categoryFilter, strengthFilter])

  const companyOptions = useMemo<CompanyOption[]>(() => {
    const counts = new Map<string, number>()
    for (const contact of contacts) {
      const name = getCompanyName(contact)
      if (!name) continue
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [contacts])

  // Firmen-Kontakte für die Header-Karte: nur Firmen-Filter, keine weiteren Filter
  const companyContacts = useMemo(
    () =>
      companyFilter
        ? contacts.filter((contact) => getCompanyName(contact) === companyFilter)
        : [],
    [contacts, companyFilter]
  )

  const hasAnyContacts = contacts.length > 0
  const hasFiltersActive =
    search.trim() !== '' ||
    citySearch.trim() !== '' ||
    companySearch.trim() !== '' ||
    companyFilter !== null ||
    categoryFilter !== ALL ||
    strengthFilter !== ALL

  return (
    <div className="w-full max-w-6xl space-y-4">
      <PageHeader
        title="Kontakte"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              LinkedIn importieren
            </Button>
            <Button onClick={openCreate}>Kontakt hinzufügen</Button>
          </div>
        }
      />
      <div className="flex flex-wrap items-end gap-2">
        <Input
          placeholder="Name suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Input
          placeholder="Stadt suchen..."
          value={citySearch}
          onChange={(e) => setCitySearch(e.target.value)}
          className="max-w-xs"
        />
        <Input
          placeholder="Firma/Titel suchen..."
          value={companySearch}
          onChange={(e) => setCompanySearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Kontakttyp" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Typen</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={strengthFilter} onValueChange={setStrengthFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Stärke" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Stärken</SelectItem>
            {Object.entries(STRENGTH_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <CompanyFilterCombobox
          options={companyOptions}
          value={companyFilter}
          onChange={setCompanyFilter}
        />
      </div>

      {companyFilter && (
        <CompanyHeaderCard
          company={companyFilter}
          contacts={companyContacts}
          onClear={() => setCompanyFilter(null)}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Lädt...</p>
      ) : !hasAnyContacts ? (
        <p className="text-sm text-muted-foreground">Noch keine Kontakte.</p>
      ) : filteredContacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {hasFiltersActive
            ? 'Keine Kontakte zu diesen Filtern.'
            : 'Noch keine Kontakte.'}
        </p>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
          {filteredContacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onEdit={() => openEdit(contact)}
              onDelete={() => setDeletingContact(contact)}
              onShowHistory={() => setHistoryContact(contact)}
              onCompanyClick={setCompanyFilter}
            />
          ))}
        </div>
      )}

      <ContactFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editingContact}
        onSaved={handleSaved}
      />

      <AlertDialog open={!!deletingContact} onOpenChange={(open) => !open && setDeletingContact(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kontakt löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingContact ? getFullName(deletingContact) : ''} wird unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <InteractionLogSheet
        contact={historyContact}
        onOpenChange={(open) => !open && setHistoryContact(null)}
      />

      <LinkedInImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        contacts={contacts}
        onImported={handleSaved}
      />
    </div>
  )
}
