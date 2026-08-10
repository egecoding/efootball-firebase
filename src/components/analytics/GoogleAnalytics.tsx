import Script from 'next/script'

/**
 * GA4, loaded only when NEXT_PUBLIC_GA_ID is set (so local dev and previews
 * stay clean). Client-side route changes are covered by GA4's enhanced
 * measurement "page changes based on browser history events" setting — leave
 * that enabled in the GA4 property or SPA navigations will not be counted.
 *
 * Implemented with next/script rather than @next/third-parties to avoid the
 * extra dependency; swap to <GoogleAnalytics gaId> from that package if you
 * later need its sendGAEvent helper for custom events.
 */
export function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID
  if (!gaId) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}');`}
      </Script>
    </>
  )
}
