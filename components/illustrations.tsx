/**
 * Lightweight, on-brand SVG illustrations (no external assets).
 * They use the theme's CSS variables so they always match Midnight Bloom.
 */

type Props = { className?: string }

function Blob({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--chart-2)" />
        </linearGradient>
      </defs>
      <ellipse
        cx="110"
        cy="132"
        rx="78"
        ry="12"
        fill="var(--foreground)"
        opacity="0.06"
      />
      <path
        d="M55 40c22-18 74-24 100 0s24 62 4 82-92 22-116-2S33 58 55 40Z"
        fill="var(--primary)"
        opacity="0.08"
      />
    </>
  )
}

export function NoDataArt({ className }: Props) {
  return (
    <svg viewBox="0 0 220 150" className={className} fill="none" role="img">
      <Blob id="nd" />
      <rect
        x="58"
        y="52"
        width="104"
        height="66"
        rx="12"
        fill="var(--card)"
        stroke="var(--border)"
      />
      <rect x="74" y="92" width="14" height="18" rx="3" fill="url(#nd-g)" />
      <rect x="96" y="80" width="14" height="30" rx="3" fill="url(#nd-g)" opacity="0.7" />
      <rect x="118" y="70" width="14" height="40" rx="3" fill="url(#nd-g)" />
      <circle cx="150" cy="58" r="16" fill="var(--card)" stroke="var(--primary)" strokeWidth="3" />
      <line x1="161" y1="69" x2="172" y2="80" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export function NoMedsArt({ className }: Props) {
  return (
    <svg viewBox="0 0 220 150" className={className} fill="none" role="img">
      <Blob id="nm" />
      <g transform="rotate(-28 110 84)">
        <rect x="66" y="66" width="88" height="38" rx="19" fill="var(--card)" stroke="var(--border)" />
        <path d="M66 85a19 19 0 0 1 19-19h25v38H85a19 19 0 0 1-19-19Z" fill="url(#nm-g)" />
        <circle cx="126" cy="85" r="4" fill="var(--primary)" opacity="0.35" />
        <circle cx="138" cy="78" r="3" fill="var(--primary)" opacity="0.25" />
      </g>
      <path d="M150 44v20M140 54h20" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}

export function NoCustomersArt({ className }: Props) {
  return (
    <svg viewBox="0 0 220 150" className={className} fill="none" role="img">
      <Blob id="nc" />
      <circle cx="90" cy="70" r="20" fill="url(#nc-g)" />
      <path d="M58 116c0-17 14-27 32-27s32 10 32 27Z" fill="url(#nc-g)" />
      <circle cx="140" cy="78" r="15" fill="var(--card)" stroke="var(--primary)" strokeWidth="3" />
      <path d="M117 116c0-13 10-21 23-21s23 8 23 21Z" fill="var(--card)" stroke="var(--primary)" strokeWidth="3" />
    </svg>
  )
}

export function NoDebtsArt({ className }: Props) {
  return (
    <svg viewBox="0 0 220 150" className={className} fill="none" role="img">
      <Blob id="nb" />
      <path
        d="M74 42h58a6 6 0 0 1 6 6v70l-10-7-10 7-10-7-10 7-10-7-10 7-6-4V48a6 6 0 0 1 6-6Z"
        fill="var(--card)"
        stroke="var(--border)"
      />
      <line x1="84" y1="60" x2="128" y2="60" stroke="var(--muted-foreground)" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
      <line x1="84" y1="74" x2="120" y2="74" stroke="var(--muted-foreground)" strokeWidth="4" strokeLinecap="round" opacity="0.35" />
      <circle cx="140" cy="96" r="20" fill="url(#nb-g)" />
      <path d="M140 86v20M134 92h8a3 3 0 0 1 0 6h-6a3 3 0 0 0 0 6h8" stroke="var(--primary-foreground)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ErrorArt({ className }: Props) {
  return (
    <svg viewBox="0 0 220 150" className={className} fill="none" role="img">
      <ellipse cx="110" cy="132" rx="72" ry="11" fill="var(--foreground)" opacity="0.06" />
      <path d="M55 44c20-16 90-16 110 0s20 60 0 78-90 18-110 0S35 60 55 44Z" fill="var(--destructive)" opacity="0.08" />
      <path
        d="M110 50 148 112a6 6 0 0 1-5 9H77a6 6 0 0 1-5-9Z"
        fill="var(--card)"
        stroke="var(--destructive)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <line x1="110" y1="76" x2="110" y2="98" stroke="var(--destructive)" strokeWidth="5" strokeLinecap="round" />
      <circle cx="110" cy="108" r="3.2" fill="var(--destructive)" />
    </svg>
  )
}
