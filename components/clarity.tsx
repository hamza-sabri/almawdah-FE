import Script from "next/script"

/**
 * Microsoft Clarity — heatmaps + session recordings.
 * Each store has its OWN Clarity project, set per-deployment through
 * NEXT_PUBLIC_CLARITY_ID (a build arg in Dokploy). There is deliberately no
 * default: a tenant deployed without an id records nothing, rather than
 * silently mixing its sessions into another store's project.
 *   alrahmah → xha416o7ja   alhiah → xjagu3xmyn   alzahra → xt2wjm0jja
 */
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID

export function Clarity() {
  if (!CLARITY_ID) return null
  return (
    <Script id="ms-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${CLARITY_ID}");`}
    </Script>
  )
}
