import { describe, it, expect } from 'vitest'
import { Contact } from '@/lib/contacts'
import { Interaction } from '@/lib/interactions'
import {
  computeCategoryDistribution,
  computeChannelDistribution,
  computeInteractionsTrend,
  computeOverdueCount,
  computeStrengthDistribution,
} from '@/lib/analytics'

function makeContact(overrides: Partial<Contact>): Contact {
  return {
    id: 'id',
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
    last_contacted_at: null,
    next_followup_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeInteraction(overrides: Partial<Interaction>): Interaction {
  return {
    id: 'id',
    contact_id: 'contact-id',
    project_id: null,
    occurred_at: '2026-06-01',
    channel: 'call',
    note: null,
    created_at: '2026-06-01T00:00:00Z',
    ...overrides,
  }
}

describe('computeCategoryDistribution', () => {
  it('groups contacts without category under "Ohne Kategorie"', () => {
    const result = computeCategoryDistribution([makeContact({ category: null })])
    expect(result).toEqual([{ key: 'none', label: 'Ohne Kategorie', count: 1 }])
  })

  it('counts multiple categories separately', () => {
    const result = computeCategoryDistribution([
      makeContact({ category: 'colleague' }),
      makeContact({ category: 'colleague' }),
      makeContact({ category: 'alumni' }),
    ])
    expect(result).toContainEqual({ key: 'colleague', label: 'Kollege', count: 2 })
    expect(result).toContainEqual({ key: 'alumni', label: 'Alumni', count: 1 })
  })
})

describe('computeStrengthDistribution', () => {
  it('groups contacts without strength under "Ohne Stärke"', () => {
    const result = computeStrengthDistribution([makeContact({ strength: null })])
    expect(result).toEqual([{ key: 'none', label: 'Ohne Stärke', count: 1 }])
  })

  it('labels numeric strength values', () => {
    const result = computeStrengthDistribution([makeContact({ strength: 1 })])
    expect(result).toEqual([{ key: '1', label: 'Stark', count: 1 }])
  })
})

describe('computeOverdueCount', () => {
  it('counts contacts with next_followup_at today or in the past', () => {
    const today = new Date().toISOString().slice(0, 10)
    const result = computeOverdueCount([
      makeContact({ next_followup_at: today }),
      makeContact({ next_followup_at: '2000-01-01' }),
      makeContact({ next_followup_at: '2999-01-01' }),
      makeContact({ next_followup_at: null }),
    ])
    expect(result).toBe(2)
  })
})

describe('computeChannelDistribution', () => {
  it('counts interactions per channel', () => {
    const result = computeChannelDistribution([
      makeInteraction({ channel: 'call' }),
      makeInteraction({ channel: 'call' }),
      makeInteraction({ channel: 'meeting' }),
    ])
    expect(result).toContainEqual({ key: 'call', label: 'Call', count: 2 })
    expect(result).toContainEqual({ key: 'meeting', label: 'Treffen', count: 1 })
  })
})

describe('computeInteractionsTrend', () => {
  it('buckets by month when period is 365 days', () => {
    const result = computeInteractionsTrend(
      [
        makeInteraction({ occurred_at: '2026-01-15' }),
        makeInteraction({ occurred_at: '2026-01-20' }),
        makeInteraction({ occurred_at: '2026-02-01' }),
      ],
      365
    )
    expect(result).toEqual([
      { bucketStart: '2026-01', label: expect.any(String), count: 2 },
      { bucketStart: '2026-02', label: expect.any(String), count: 1 },
    ])
  })

  it('buckets by week when period is 30 or 90 days, sorted ascending', () => {
    const result = computeInteractionsTrend(
      [makeInteraction({ occurred_at: '2026-06-10' }), makeInteraction({ occurred_at: '2026-06-03' })],
      90
    )
    expect(result.length).toBe(2)
    expect(result[0].bucketStart < result[1].bucketStart).toBe(true)
  })

  it('returns empty array for no interactions', () => {
    expect(computeInteractionsTrend([], 30)).toEqual([])
  })
})
