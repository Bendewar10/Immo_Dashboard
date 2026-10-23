import { describe, it, expect, vi } from 'vitest'
import { Contact } from '@/lib/contacts'

// Komponenten-Modul zieht den Supabase-Browser-Client — für die puren Helfer irrelevant
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import {
  buildWhatsAppLink,
  matchesCity,
  sortByNeglect,
} from '@/components/city-trip-section'

function contactWith(last_contacted_at: string | null): Contact {
  return {
    id: crypto.randomUUID(),
    first_name: 'Test',
    last_name: null,
    category: null,
    strength: null,
    employer: null,
    job_title: null,
    email: null,
    linkedin_url: null,
    photo_url: null,
    context: null,
    notes: null,
    city: null,
    phone: null,
    birthday: null,
    followup_interval_days: null,
    last_contacted_at,
    next_followup_at: null,
    created_at: '2026-01-01T00:00:00Z',
  }
}

describe('matchesCity', () => {
  it('matches case-insensitively and trims whitespace', () => {
    expect(matchesCity(' münchen ', 'München')).toBe(true)
    expect(matchesCity('München', 'münchen')).toBe(true)
  })

  it('does not match different or missing cities', () => {
    expect(matchesCity('Hamburg', 'München')).toBe(false)
    expect(matchesCity(null, 'München')).toBe(false)
    // Schreibvarianten bewusst kein Match (Spec-Edge-Case)
    expect(matchesCity('Frankfurt am Main', 'Frankfurt')).toBe(false)
  })
})

describe('sortByNeglect', () => {
  it('puts never-contacted first, then oldest last contact', () => {
    const never = contactWith(null)
    const old = contactWith('2025-01-01T00:00:00Z')
    const recent = contactWith('2026-06-01T00:00:00Z')
    const sorted = [recent, never, old].sort(sortByNeglect)
    expect(sorted[0]).toBe(never)
    expect(sorted[1]).toBe(old)
    expect(sorted[2]).toBe(recent)
  })
})

describe('buildWhatsAppLink', () => {
  it('keeps international numbers with + prefix', () => {
    expect(buildWhatsAppLink('+49 170 1234567', 'Hi')).toBe(
      'https://wa.me/491701234567?text=Hi'
    )
  })

  it('converts 00-prefix to bare country code', () => {
    expect(buildWhatsAppLink('0049 170 1234567', 'Hi')).toBe(
      'https://wa.me/491701234567?text=Hi'
    )
  })

  it('assumes Germany for national 0-prefix numbers', () => {
    expect(buildWhatsAppLink('0170 123 45 67', 'Hi')).toBe(
      'https://wa.me/491701234567?text=Hi'
    )
  })

  it('url-encodes the message text', () => {
    const link = buildWhatsAppLink('+491701234567', 'Bin bald in München — Kaffee?')
    expect(link).toContain('text=Bin%20bald%20in%20M%C3%BCnchen')
  })

  it('returns null for numbers that are too short', () => {
    expect(buildWhatsAppLink('1234', 'Hi')).toBeNull()
  })
})
