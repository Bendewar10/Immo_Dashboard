import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { ReportMetrics } from '@/lib/report-data'
import { ReportSections } from '@/lib/report-ai'

const styles = StyleSheet.create({
  page: { paddingVertical: 56, paddingHorizontal: 56, fontSize: 11, lineHeight: 1.5, color: '#1a1a1a' },
  kicker: { fontSize: 9, letterSpacing: 2, color: '#777', textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: 'bold', marginTop: 6 },
  month: { fontSize: 12, color: '#555', marginTop: 2, marginBottom: 20 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 0, marginBottom: 24 },
  metricBox: { width: '33%', marginBottom: 12 },
  metricValue: { fontSize: 18, fontWeight: 'bold' },
  metricLabel: { fontSize: 8, color: '#777', textTransform: 'uppercase', letterSpacing: 1 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, color: '#333', marginBottom: 4, borderBottom: '1px solid #e0e0e0', paddingBottom: 3 },
  sectionBody: { fontSize: 11, color: '#222' },
  footer: { position: 'absolute', bottom: 32, left: 56, right: 56, fontSize: 8, color: '#999', borderTop: '1px solid #eee', paddingTop: 8 },
})

interface MetricItem {
  value: string
  label: string
}

function metricItems(metrics: ReportMetrics): MetricItem[] {
  const items: MetricItem[] = [
    { value: String(metrics.interactionsThisMonth), label: 'Kontaktmomente' },
    { value: String(metrics.newContactsThisMonth), label: 'Neue Kontakte' },
    { value: String(metrics.totalContacts), label: 'Kontakte gesamt' },
    { value: String(metrics.overdueCount), label: 'Überfällig' },
    { value: String(metrics.overdueCoreCount), label: 'Kernkontakte überfällig' },
  ]
  if (metrics.showDelta) {
    const sign = metrics.interactionDelta >= 0 ? '+' : ''
    items.push({ value: `${sign}${metrics.interactionDelta}`, label: 'Δ Vormonat' })
  }
  return items
}

function ReportDocument({ metrics, sections }: { metrics: ReportMetrics; sections: ReportSections }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.kicker}>Netzwerk-Report</Text>
        <Text style={styles.title}>Dein Beziehungsnetzwerk</Text>
        <Text style={styles.month}>{metrics.monthLabel}</Text>

        <View style={styles.metricsRow}>
          {metricItems(metrics).map((item) => (
            <View key={item.label} style={styles.metricBox}>
              <Text style={styles.metricValue}>{item.value}</Text>
              <Text style={styles.metricLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Executive Summary</Text>
          <Text style={styles.sectionBody}>{sections.executiveSummary}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aktivität</Text>
          <Text style={styles.sectionBody}>{sections.activity}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Beziehungs-Gesundheit & Risiken</Text>
          <Text style={styles.sectionBody}>{sections.relationshipHealth}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Strategische Empfehlung</Text>
          <Text style={styles.sectionBody}>{sections.recommendation}</Text>
        </View>

        <Text style={styles.footer}>
          Automatisch erstellt von deinem Personal Network OS · {metrics.monthLabel}
        </Text>
      </Page>
    </Document>
  )
}

export function renderReportPdf(metrics: ReportMetrics, sections: ReportSections): Promise<Buffer> {
  return renderToBuffer(<ReportDocument metrics={metrics} sections={sections} />)
}
