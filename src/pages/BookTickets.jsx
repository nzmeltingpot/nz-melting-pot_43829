import useScrollReveal from '../hooks/useScrollReveal';
import usePageMeta from '../hooks/usePageMeta';
import BookingForm from '../components/BookingForm';
import Breadcrumbs from '../components/Breadcrumbs';
import { OrganizationSchema } from '../components/SchemaOrg';

/**
 * /book-tickets — audience ticket booking page for the Talent Showcase 2026.
 * Mirrors the look and feel of the TalentShowcase page (registration form),
 * but the form here is the BookingForm (just buyer name + email + count).
 */
export default function BookTickets() {
  useScrollReveal();
  usePageMeta({
    title: 'Book Audience Tickets — Talent Showcase 2026 | NZ Melting Pot',
    description:
    'Book your tickets for the Musical Talent Showcase 2026 in Auckland. $10 NZD per ticket, up to 10 tickets per booking. Saturday 18 July 2026.',
    path: '/book-tickets'
  });

  return (
    <>
      <OrganizationSchema />

      <section className="page-hero" style={{ padding: '56px 20px 22px', textAlign: 'center' }}>
        <div className="container">
          <Breadcrumbs items={[
          { label: 'Home', to: '/' },
          { label: 'Talent Showcase', to: '/musical-talent-showcase' },
          { label: 'Book Tickets', to: '/book-tickets' }]
          } />

          <p className="text-accent page-hero__tag" style={{ marginTop: 10 }}>Saturday 18 July 2026</p>
          <h1 className="page-hero__title" style={{ marginTop: 2 }}>
            Book Your <em>Tickets</em>
          </h1>
          <p className="page-hero__lead" style={{ maxWidth: 640, margin: '8px auto 0' }}>
            Come and cheer on Auckland's performers at the 2026 Musical Talent Showcase.
            Tickets are $10 NZD each — book up to 10 in one go.
          </p>
        </div>
      </section>

      {/* The booking form */}
      <section id="booking-form" className="section" style={{ paddingTop: 12, paddingBottom: 48 }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="reveal" style={{ textAlign: 'center', marginBottom: 14 }}>
            <h2 style={{ fontFamily: "'Cormorant', Georgia, serif", fontSize: 'clamp(1.8rem, 3.6vw, 2.3rem)', margin: '0 0 4px 0' }}>
              Reserve Your Seat
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.85)', margin: 0, fontSize: '0.95rem' }}>
              Tickets are $10 NZD per person. Book up to 10 in one transaction.
            </p>
          </div>

          <div className="reveal" data-delay="100">
            <BookingForm />
          </div>
        </div>
      </section>
    </>);

}