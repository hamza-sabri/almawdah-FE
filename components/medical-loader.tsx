"use client"

import { useEffect, useState } from "react"

/**
 * Medical processing animation: a beating EKG line with a bouncing capsule
 * pill, plus rotating status messages. Self-contained SVG/CSS — swap in a
 * Lottie file later by replacing just this component.
 */
export function MedicalLoader({ messages }: { messages?: string[] }) {
  const lines = messages?.length
    ? messages
    : [
        "جاري قراءة الملف…",
        "نفحص كل سطر بدقة…",
        "نتأكد أن البيانات تخص صيدليتك فقط…",
        "نجهّز كل شيء…",
      ]
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % lines.length), 2200)
    return () => clearInterval(t)
  }, [lines.length])

  return (
    <div className="flex flex-col items-center gap-5 py-10">
      <style>{`
        @keyframes ekg-dash { to { stroke-dashoffset: -520; } }
        @keyframes pill-bounce {
          0%, 100% { transform: translateY(0) rotate(-18deg); }
          50% { transform: translateY(-14px) rotate(14deg); }
        }
        @keyframes pill-shadow {
          0%, 100% { transform: scaleX(1); opacity: .25; }
          50% { transform: scaleX(.6); opacity: .12; }
        }
        @keyframes pulse-dot { 0%,100% { opacity:.35 } 50% { opacity:1 } }
      `}</style>

      <div className="relative">
        <svg
          viewBox="0 0 260 120"
          className="h-28 w-64"
          fill="none"
          aria-hidden="true"
        >
          {/* EKG heartbeat line */}
          <path
            d="M0 62 H58 L72 62 L82 34 L94 88 L104 50 L112 62 H150 L162 62 L172 30 L184 92 L194 48 L202 62 H260"
            stroke="var(--primary)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="130 390"
            style={{ animation: "ekg-dash 2.4s linear infinite" }}
            opacity="0.9"
          />
          <path
            d="M0 62 H58 L72 62 L82 34 L94 88 L104 50 L112 62 H150 L162 62 L172 30 L184 92 L194 48 L202 62 H260"
            stroke="var(--primary)"
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.12"
          />
          {/* Capsule pill */}
          <g style={{ animation: "pill-bounce 1.6s ease-in-out infinite", transformOrigin: "130px 24px" }}>
            <g transform="translate(112, 6)">
              <rect x="0" y="0" width="38" height="18" rx="9" fill="var(--lime)" />
              <path d="M19 0 h10 a9 9 0 0 1 0 18 h-10 z" fill="var(--primary)" />
              <rect x="4" y="3.5" width="12" height="4" rx="2" fill="white" opacity="0.55" />
            </g>
          </g>
          <ellipse
            cx="131" cy="34" rx="16" ry="3"
            fill="var(--ink, #201f38)"
            style={{ animation: "pill-shadow 1.6s ease-in-out infinite", transformOrigin: "131px 34px" }}
          />
        </svg>
      </div>

      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <span
          className="size-2 rounded-full bg-primary"
          style={{ animation: "pulse-dot 1.2s ease-in-out infinite" }}
        />
        <span key={i} className="animate-in fade-in duration-300">
          {lines[i]}
        </span>
      </div>
    </div>
  )
}
