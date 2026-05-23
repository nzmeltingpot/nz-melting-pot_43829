const SITE_URL = 'https://www.nzmeltingpot.com';

/**
 * Injects a JSON-LD <script> block into the page.
 */
function JsonLd({ data }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />);


}

/* ---- Organization (used on every page) ---- */
export function OrganizationSchema() {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'NZ Melting Pot',
        url: SITE_URL,
        logo: `${SITE_URL}/images/branding/logo-512x512.png`,
        description:
        'A registered not-for-profit charity in Auckland, New Zealand that brings communities together through live music events.',
        email: 'info@nzmeltingpot.com',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Auckland',
          addressCountry: 'NZ'
        },
        sameAs: []
      }} />);


}

/* ---- WebSite (home page only) ---- */
export function WebSiteSchema() {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'NZ Melting Pot',
        url: SITE_URL,
        description:
        'A not-for-profit charity bringing Auckland communities together through live music events.',
        inLanguage: 'en-NZ'
      }} />);


}

/* ---- Event (Talent Showcase — has a confirmed date) ---- */
export function TalentShowcaseEventSchema() {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: 'NZ Melting Pot Musical Talent Showcase 2026',
        startDate: '2026-07-18T10:00:00+12:00',
        endDate: '2026-07-18T18:00:00+12:00',
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode:
        'https://schema.org/OfflineEventAttendanceMode',
        location: {
          '@type': 'Place',
          name: 'Auckland',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Auckland',
            addressCountry: 'NZ'
          }
        },
        image: `${SITE_URL}/images/talent-showcase/showcase-01.webp`,
        description:
        "Auckland's annual stage for solo artists, instrumentalists, and groups. Sign up, show up, and let your music do the talking.",
        organizer: {
          '@type': 'Organization',
          name: 'NZ Melting Pot',
          url: SITE_URL
        },
        performer: {
          '@type': 'PerformingGroup',
          name: 'Various community performers'
        },
        offers: {
          '@type': 'Offer',
          price: '10.00',
          priceCurrency: 'NZD',
          availability: 'https://schema.org/InStock',
          url: `${SITE_URL}/musical-talent-showcase`,
          validThrough: '2026-06-01T23:59:00+12:00',
          description: 'Early Bird performer registration fee (until 1 June 2026). Standard rate $15 NZD thereafter, until registration closes 1 July 2026.'
        },
        isAccessibleForFree: false
      }} />);


}

/* ---- Event (Musical Ensemble — annual, no fixed date yet) ---- */
export function EnsembleEventSchema() {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: 'NZ Melting Pot Musical Ensemble',
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode:
        'https://schema.org/OfflineEventAttendanceMode',
        location: {
          '@type': 'Place',
          name: 'Auckland',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Auckland',
            addressCountry: 'NZ'
          }
        },
        image: `${SITE_URL}/images/musical-ensemble/ensemble-01.webp`,
        description:
        'No auditions, no competition. Musicians from across Auckland come together for an afternoon of playing, learning, and making music as a group.',
        organizer: {
          '@type': 'Organization',
          name: 'NZ Melting Pot',
          url: SITE_URL
        },
        isAccessibleForFree: false
      }} />);


}