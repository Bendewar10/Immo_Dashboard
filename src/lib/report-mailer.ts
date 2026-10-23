import nodemailer from 'nodemailer'

interface SendReportArgs {
  to: string
  monthLabel: string
  executiveSummary: string
  pdfBuffer: Buffer
}

// Versand über Gmail SMTP mit App-Passwort. GMAIL_USER ist auch der Absender.
export async function sendReportMail({ to, monthLabel, executiveSummary, pdfBuffer }: SendReportArgs) {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD

  if (!user || !pass) {
    throw new Error('Missing GMAIL_USER or GMAIL_APP_PASSWORD.')
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })

  const safeMonth = monthLabel.replace(/\s+/g, '-')

  await transporter.sendMail({
    from: user,
    to,
    subject: `Dein Netzwerk-Report — ${monthLabel}`,
    text: `Hi,\n\nhier dein Netzwerk-Report für ${monthLabel}.\n\n${executiveSummary}\n\nDie vollständige Analyse findest du im angehängten PDF.\n\n— Dein Personal Network OS`,
    attachments: [
      {
        filename: `Netzwerk-Report-${safeMonth}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  })
}
