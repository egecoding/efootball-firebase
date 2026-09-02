import type { Metadata } from 'next'
import { SITE_URL } from './site'
import type { BlogPostMeta } from './blog'
import type { Tournament, TournamentStatus } from '@/types/database'

// ─── Shared constants ──────────────────────────────────────────────────────

export const SITE_NAME = 'eFootball Cup'

/** Stable @id anchors so nodes on the same page can cross-reference each other. */
export const ORG_ID = `${SITE_URL}/#organization`
export const SITE_ID = `${SITE_URL}/#website`

/**
 * `follow: true` so link equity still flows out of thin pages.
 *
 * A page carrying this must NOT also be Disallowed in robots.ts — a blocked
 * page is never fetched, so the directive is never seen.
 */
export const NOINDEX: Metadata['robots'] = { index: false, follow: true }

// ─── Site-wide entity schemas (rendered in the root layout) ────────────────

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description:
      'Free eFootball tournament management. Create brackets, invite players with a link, and track every result.',
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/icon-512.png`,
      width: 512,
      height: 512,
    },
    // `sameAs` is intentionally omitted — add real social profile URLs here,
    // never an empty or speculative array.
  }
}

export function webSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: `${SITE_URL}/`,
    name: SITE_NAME,
    inLanguage: 'en',
    publisher: { '@id': ORG_ID },
    // /tournaments?q= is a real, working search endpoint, so this is accurate.
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/tournaments?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function softwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${SITE_URL}/#software`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description:
      'Free web-based eFootball (FIFA) tournament bracket manager — create brackets, invite players with a link, and track results. No installation required.',
    applicationCategory: 'SportsApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: [
      'Knockout, round robin, and league tournament brackets',
      'No-account guest player join via link',
      'AI screenshot scanning for match results',
      'Live standings and automatic bracket updates',
    ],
    publisher: { '@id': ORG_ID },
    isPartOf: { '@id': SITE_ID },
    // No aggregateRating/review — there is no real rating data collected
    // anywhere on the platform, and fabricating either is a structured-data
    // spam violation that risks a manual action against the whole site.
  }
}

// ─── Per-page schemas ──────────────────────────────────────────────────────

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  }
}

export function blogPostingSchema(post: BlogPostMeta) {
  const url = `${SITE_URL}/blog/${post.slug}`

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    // Google truncates headlines past ~110 chars.
    headline: post.title.slice(0, 110),
    description: post.description,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    image: [`${url}/opengraph-image`],
    author: post.author
      ? { '@type': 'Person', name: post.author }
      : { '@type': 'Organization', name: SITE_NAME, url: `${SITE_URL}/` },
    publisher: { '@id': ORG_ID },
    isPartOf: { '@id': SITE_ID },
    ...(post.tags?.length ? { keywords: post.tags.join(', ') } : {}),
  }
}

export function faqPageSchema(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
}

/**
 * schema.org/EventStatusType has no "in progress" member — the full set is
 * EventScheduled | EventCancelled | EventPostponed | EventRescheduled |
 * EventMovedOnline. EventScheduled is the only valid choice for a live
 * tournament, so draft/open/in_progress all map to it.
 */
const EVENT_STATUS: Record<TournamentStatus, string> = {
  draft: 'https://schema.org/EventScheduled',
  open: 'https://schema.org/EventScheduled',
  in_progress: 'https://schema.org/EventScheduled',
  completed: 'https://schema.org/EventCompleted',
}

type SchemaOrganizer = { display_name: string | null; username: string } | null | undefined

export function sportsEventSchema(
  tournament: Pick<
    Tournament,
    'id' | 'title' | 'description' | 'game_name' | 'status' | 'max_participants' | 'starts_at' | 'created_at'
  >,
  organizer?: SchemaOrganizer
) {
  const url = `${SITE_URL}/tournaments/${tournament.id}`

  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    '@id': `${url}#event`,
    name: tournament.title,
    description:
      tournament.description ?? `${tournament.game_name} tournament on ${SITE_NAME}`,
    url,
    sport: tournament.game_name,
    image: [`${url}/opengraph-image`],
    eventStatus: EVENT_STATUS[tournament.status],
    // Google requires all three of startDate, location and eventAttendanceMode
    // for Event rich results. starts_at is often null, so fall back to created_at.
    startDate: tournament.starts_at ?? tournament.created_at,
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    location: { '@type': 'VirtualLocation', url },
    maximumAttendeeCapacity: tournament.max_participants,
    organizer: organizer
      ? { '@type': 'Person', name: organizer.display_name ?? organizer.username }
      : { '@id': ORG_ID },
    isPartOf: { '@id': SITE_ID },
  }
}
