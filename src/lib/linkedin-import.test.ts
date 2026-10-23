import { describe, it, expect } from 'vitest'
import { parseLinkedInCsv, computeImportPlan } from './linkedin-import'
import { Contact } from './contacts'

function makeContact(overrides: Partial<Contact>): Contact {
  return {
    id: 'c1',
    first_name: 'Anna',
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

describe('parseLinkedInCsv', () => {
  it('returns null when no valid header line is found', () => {
    expect(parseLinkedInCsv('not,a,linkedin,export\nfoo,bar')).toBeNull()
  })

  it('skips the notes preamble and parses rows after the real header', () => {
    const csv = [
      'Notes:',
      '"some explanation text"',
      '',
      'First Name,Last Name,URL,Email Address,Company,Position,Connected On',
      'Anna,Schmidt,https://linkedin.com/in/anna,anna@example.com,Acme,PM,01 Jan 2026',
    ].join('\n')

    const result = parseLinkedInCsv(csv)
    expect(result).not.toBeNull()
    expect(result!.rows).toEqual([
      {
        first_name: 'Anna',
        last_name: 'Schmidt',
        linkedin_url: 'https://linkedin.com/in/anna',
        email: 'anna@example.com',
        employer: 'Acme',
        job_title: 'PM',
      },
    ])
    expect(result!.skippedCount).toBe(0)
  })

  it('skips rows without a first name and counts them', () => {
    const csv = [
      'First Name,Last Name,URL,Email Address,Company,Position,Connected On',
      ',,,,,,,01 Jan 2026',
      'Bob,Jones,https://linkedin.com/in/bob,,,,01 Jan 2026',
    ].join('\n')

    const result = parseLinkedInCsv(csv)
    expect(result!.rows).toHaveLength(1)
    expect(result!.rows[0].first_name).toBe('Bob')
    expect(result!.skippedCount).toBe(1)
  })

  it('handles quoted fields with embedded commas', () => {
    const csv = [
      'First Name,Last Name,URL,Email Address,Company,Position,Connected On',
      'Georg,"Lang, LL.M.",https://linkedin.com/in/georg,,DTE Consult,Managing Partner,01 Jan 2026',
    ].join('\n')

    const result = parseLinkedInCsv(csv)
    expect(result!.rows[0].last_name).toBe('Lang, LL.M.')
  })
})

describe('computeImportPlan', () => {
  it('creates a new contact when no match is found', () => {
    const plan = computeImportPlan(
      { rows: [{ first_name: 'Anna', last_name: null, linkedin_url: 'https://x/anna', email: null, employer: null, job_title: null }], skippedCount: 0 },
      []
    )
    expect(plan.newContacts).toHaveLength(1)
    expect(plan.changes).toHaveLength(0)
    expect(plan.unchangedCount).toBe(0)
  })

  it('matches by linkedin_url and lists only non-empty changed fields as a diff, tagged as Jobwechsel', () => {
    const existing = makeContact({ id: 'c1', first_name: 'Anna', employer: 'OldCo', linkedin_url: 'https://x/anna' })
    const plan = computeImportPlan(
      {
        rows: [
          { first_name: 'Anna', last_name: null, linkedin_url: 'https://x/anna', email: null, employer: 'NewCo', job_title: null },
        ],
        skippedCount: 0,
      },
      [existing]
    )
    expect(plan.newContacts).toHaveLength(0)
    expect(plan.changes).toEqual([
      {
        contactId: 'c1',
        name: 'Anna',
        diffs: [{ field: 'employer', oldValue: 'OldCo', newValue: 'NewCo' }],
        occasions: ['Jobwechsel'],
      },
    ])
  })

  it('tags a job_title change as Beförderung, and both tags together when employer and job_title change at once', () => {
    const existing = makeContact({
      id: 'c1',
      first_name: 'Anna',
      employer: 'OldCo',
      job_title: 'Consultant',
      linkedin_url: 'https://x/anna',
    })
    const plan = computeImportPlan(
      {
        rows: [
          {
            first_name: 'Anna',
            last_name: null,
            linkedin_url: 'https://x/anna',
            email: null,
            employer: 'NewCo',
            job_title: 'Project Manager',
          },
        ],
        skippedCount: 0,
      },
      [existing]
    )
    expect(plan.changes[0].occasions).toEqual(['Jobwechsel', 'Beförderung'])
  })

  it('does not tag an occasion when the old value was empty (first-time fill, not a change)', () => {
    const existing = makeContact({ id: 'c1', first_name: 'Anna', employer: null, linkedin_url: 'https://x/anna' })
    const plan = computeImportPlan(
      {
        rows: [{ first_name: 'Anna', last_name: null, linkedin_url: 'https://x/anna', email: null, employer: 'NewCo', job_title: null }],
        skippedCount: 0,
      },
      [existing]
    )
    expect(plan.changes[0].diffs).toEqual([{ field: 'employer', oldValue: null, newValue: 'NewCo' }])
    expect(plan.changes[0].occasions).toEqual([])
  })

  it('never overwrites an existing value with an empty CSV field', () => {
    const existing = makeContact({ id: 'c1', first_name: 'Anna', email: 'anna@kept.com', linkedin_url: 'https://x/anna' })
    const plan = computeImportPlan(
      {
        rows: [{ first_name: 'Anna', last_name: null, linkedin_url: 'https://x/anna', email: null, employer: null, job_title: null }],
        skippedCount: 0,
      },
      [existing]
    )
    expect(plan.changes).toHaveLength(0)
    expect(plan.unchangedCount).toBe(1)
  })

  it('falls back to name matching when no linkedin_url match exists and backfills the url', () => {
    const existing = makeContact({ id: 'c1', first_name: 'Anna', last_name: 'Schmidt', linkedin_url: null })
    const plan = computeImportPlan(
      {
        rows: [{ first_name: 'Anna', last_name: 'Schmidt', linkedin_url: 'https://x/anna', email: null, employer: null, job_title: null }],
        skippedCount: 0,
      },
      [existing]
    )
    expect(plan.changes).toEqual([
      {
        contactId: 'c1',
        name: 'Anna Schmidt',
        diffs: [{ field: 'linkedin_url', oldValue: null, newValue: 'https://x/anna' }],
        occasions: [],
      },
    ])
  })

  it('matches names case-insensitively via the fallback', () => {
    const existing = makeContact({ id: 'c1', first_name: 'Anna', last_name: 'Schmidt', linkedin_url: null })
    const plan = computeImportPlan(
      {
        rows: [{ first_name: 'anna', last_name: 'schmidt', linkedin_url: null, email: null, employer: 'Acme', job_title: null }],
        skippedCount: 0,
      },
      [existing]
    )
    expect(plan.newContacts).toHaveLength(0)
    expect(plan.changes).toHaveLength(1)
    expect(plan.changes[0].contactId).toBe('c1')
  })

  it('does not match contacts that already have a different linkedin_url via name fallback', () => {
    const existing = makeContact({ id: 'c1', first_name: 'Anna', last_name: 'Schmidt', linkedin_url: 'https://x/someone-else' })
    const plan = computeImportPlan(
      {
        rows: [{ first_name: 'Anna', last_name: 'Schmidt', linkedin_url: 'https://x/anna', email: null, employer: null, job_title: null }],
        skippedCount: 0,
      },
      [existing]
    )
    expect(plan.newContacts).toHaveLength(1)
    expect(plan.changes).toHaveLength(0)
  })

  it('uses the first match when multiple contacts share the same name without a linkedin_url', () => {
    const dup1 = makeContact({ id: 'c1', first_name: 'Anna', last_name: 'Schmidt' })
    const dup2 = makeContact({ id: 'c2', first_name: 'Anna', last_name: 'Schmidt' })
    const plan = computeImportPlan(
      {
        rows: [{ first_name: 'Anna', last_name: 'Schmidt', linkedin_url: null, email: null, employer: 'Acme', job_title: null }],
        skippedCount: 0,
      },
      [dup1, dup2]
    )
    expect(plan.changes).toHaveLength(1)
    expect(plan.changes[0].contactId).toBe('c1')
  })

  it('counts skippedCount through from the parse result', () => {
    const plan = computeImportPlan({ rows: [], skippedCount: 3 }, [])
    expect(plan.skippedCount).toBe(3)
  })
})
