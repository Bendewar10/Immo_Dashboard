import type { ReactElement } from 'react'

function GoogleLogo() {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

function Microsoft365Logo() {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1" y="1" width="10.5" height="10.5" fill="#F25022" />
      <rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00" />
      <rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF" />
      <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900" />
    </svg>
  )
}

function LinkedInLogo() {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#0A66C2" />
      <rect x="4.5" y="5" width="3" height="3" rx="0.5" fill="white" />
      <rect x="4.5" y="9.5" width="3" height="9" fill="white" />
      <path
        d="M10 9.5v9h3v-4.7c0-1 .5-1.8 1.5-1.8s1.5.8 1.5 1.8v4.7h3V14c0-2.5-1.6-4.5-4-4.5-1.1 0-2 .5-2.5 1.3V9.5H10z"
        fill="white"
      />
    </svg>
  )
}

function WhatsAppLogo() {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#25D366" />
      <path
        d="M17.04 6.96A7 7 0 0 0 5.04 14.92L4 20l5.24-1.04A7 7 0 0 0 17.04 6.96zm-5.04 10.4c-1.12 0-2.2-.3-3.14-.84l-.22-.14-2.3.6.62-2.26-.16-.24A5.32 5.32 0 0 1 6 12c0-3.32 2.68-6 6-6s6 2.68 6 6-2.68 6-6 6zm3.28-4.48c-.18-.09-1.06-.52-1.22-.58-.16-.06-.28-.09-.4.09-.12.18-.5.58-.62.7-.12.12-.22.14-.42.05-.2-.09-1.12-.52-2.14-1.56-.8-.84-1.34-1.88-1.5-2.2-.16-.32-.02-.5.12-.66.12-.14.28-.36.42-.54.14-.18.18-.3.28-.5.1-.2.04-.38-.02-.54-.06-.16-.4-1.06-.56-1.46-.14-.38-.3-.32-.4-.32h-.34c-.12 0-.3.04-.46.2-.16.16-.6.58-.6 1.42s.62 1.64.7 1.76c.08.12 1.22 1.86 2.94 2.6 1.72.74 1.72.5 2.04.46.32-.04 1.02-.42 1.16-.82.14-.4.14-.74.1-.82-.04-.08-.18-.12-.38-.22z"
        fill="white"
      />
    </svg>
  )
}

function AppleCalendarLogo() {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <clipPath id="apple-cal-clip">
          <rect width="24" height="24" rx="5" />
        </clipPath>
      </defs>
      <g clipPath="url(#apple-cal-clip)">
        <rect width="24" height="24" fill="white" />
        <rect width="24" height="8" fill="#FF3B30" />
        <rect x="4" y="11.5" width="2.5" height="2.5" rx="0.5" fill="#8E8E93" />
        <rect x="10.75" y="11.5" width="2.5" height="2.5" rx="0.5" fill="#8E8E93" />
        <rect x="17.5" y="11.5" width="2.5" height="2.5" rx="0.5" fill="#8E8E93" />
        <rect x="4" y="16.5" width="2.5" height="2.5" rx="0.5" fill="#8E8E93" />
        <rect x="10.75" y="16.5" width="2.5" height="2.5" rx="0.5" fill="#FF3B30" />
        <rect x="17.5" y="16.5" width="2.5" height="2.5" rx="0.5" fill="#8E8E93" />
      </g>
      <rect x="7" y="0" width="1.5" height="3.5" rx="0.75" fill="white" opacity="0.8" />
      <rect x="15.5" y="0" width="1.5" height="3.5" rx="0.75" fill="white" opacity="0.8" />
    </svg>
  )
}

const LOGOS: Record<string, () => ReactElement> = {
  google: GoogleLogo,
  'microsoft-365': Microsoft365Logo,
  linkedin: LinkedInLogo,
  whatsapp: WhatsAppLogo,
  'apple-calendar': AppleCalendarLogo,
}

export function ConnectorLogo({ id }: { id: string }) {
  const Logo = LOGOS[id]
  if (!Logo) return <div className="h-7 w-7 rounded bg-muted" />
  return <Logo />
}
