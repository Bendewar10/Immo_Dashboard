import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import {
  buildReportMetrics,
  isLastSundayOfMonth,
  previousMonthStartDate,
} from '@/lib/report-data'
import { generateReportSections } from '@/lib/report-ai'
import { renderReportPdf } from '@/lib/report-pdf'
import { sendReportMail } from '@/lib/report-mailer'
import { Contact } from '@/lib/contacts'
import { Interaction } from '@/lib/interactions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const now = new Date()
  // ?force=1 erlaubt manuelles Test-Triggern (weiterhin Secret-geschützt).
  const force = new URL(request.url).searchParams.get('force') === '1'
  if (!force && !isLastSundayOfMonth(now)) {
    return NextResponse.json({ skipped: 'not last sunday of month' })
  }

  const supabase = createSupabaseAdminClient()
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers()
  if (usersError) {
    return NextResponse.json({ error: 'Could not list users.' }, { status: 500 })
  }

  const prevMonthStart = previousMonthStartDate(now)
  const results: { user: string; status: string }[] = []

  for (const user of usersData.users) {
    if (!user.email) {
      results.push({ user: user.id, status: 'no-email' })
      continue
    }

    try {
      const [{ data: contacts }, { data: interactions }] = await Promise.all([
        supabase.from('contacts').select('*').eq('user_id', user.id),
        supabase
          .from('interactions')
          .select('*')
          .eq('user_id', user.id)
          .gte('occurred_at', prevMonthStart),
      ])

      const safeContacts = (contacts ?? []) as Contact[]
      if (safeContacts.length === 0) {
        results.push({ user: user.email, status: 'skipped-no-contacts' })
        continue
      }

      const metrics = buildReportMetrics(safeContacts, (interactions ?? []) as Interaction[], now)
      const sections = await generateReportSections(metrics)
      const pdfBuffer = await renderReportPdf(metrics, sections)
      await sendReportMail({
        to: user.email,
        monthLabel: metrics.monthLabel,
        executiveSummary: sections.executiveSummary,
        pdfBuffer,
      })

      results.push({ user: user.email, status: 'sent' })
    } catch (err) {
      // Ein Fehler bei einem Nutzer darf die anderen nicht stoppen; kein halber Report.
      console.error(`monthly-report failed for ${user.email}:`, err)
      results.push({ user: user.email, status: 'error' })
    }
  }

  return NextResponse.json({ ran: true, results })
}
