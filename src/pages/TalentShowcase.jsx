import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import useScrollReveal from '../hooks/useScrollReveal';
import usePageMeta from '../hooks/usePageMeta';
import RegistrationForm from '../components/RegistrationForm';
import Gallery from '../components/Gallery';
import Breadcrumbs from '../components/Breadcrumbs';
import AnimatedIcon from '../components/AnimatedIcon';
import { OrganizationSchema, TalentShowcaseEventSchema } from '../components/SchemaOrg';

const SETTINGS_TABLE_ID = 79250;
const POSTER_KEY = 'talent_showcase_poster_url';

/* Unique alt text for every gallery image */
const showcaseAlts = [
'Performers lined up on stage at the NZ Melting Pot Musical Talent Showcase in Auckland',
'Solo vocalist performing under stage lights at the annual Auckland talent showcase',
'Instrumentalist playing a guitar piece during the Musical Talent Showcase event',
'Audience watching a live music performance at the NZ Melting Pot showcase',
'Young musician performing a solo at the community talent showcase in Auckland',
'Trio performance on stage at the Auckland Musical Talent Showcase event',
'Audience watching performances at the NZ Melting Pot Musical Talent Showcase',
'Drummer performing an energetic solo at the NZ Melting Pot talent event',
'Guitarist on stage at the annual Musical Talent Showcase in Auckland',
'Duo performing together at the NZ Melting Pot community talent showcase',
'Full stage view of the Musical Talent Showcase performance venue in Auckland',
'Vocalist after performing at the annual talent showcase',
'Duet performing live at the Auckland community music event',
'Audience applauding after a performance at the NZ Melting Pot showcase',
'Pianist performing a classical piece at the Musical Talent Showcase',
'Award ceremony moment at the annual NZ Melting Pot Musical Talent Showcase'];


const showcaseImages = Array.from({ length: 16 }, (_, i) => ({
  src: `/images/talent-showcase/showcase-${String(i + 1).padStart(2, '0')}.webp`,
  alt: showcaseAlts[i],
  wide: i === 0 || i === 5 || i === 10
}));

const DEFAULT_POSTER_URL = 'https://newoaks.s3.us-west-1.amazonaws.com/NewOaks/5500/9a869b79-4261-4a8e-a672-53ffd86904ef.png';

export default function TalentShowcase() {
  const location = useLocation();
  useScrollReveal();

  const [posterUrl, setPosterUrl] = useState(DEFAULT_POSTER_URL);
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const fileInputRef = useRef(null);
  const settingIdRef = useRef(null);

  // Load poster URL from DB and check if admin
  useEffect(() => {
    (async () => {
      try {
        const { data: userInfo } = await window.ezsite.apis.getUserInfo();
        if (userInfo && userInfo.Roles && userInfo.Roles.split(',').includes('Administrator')) {
          setIsAdmin(true);
        }
      } catch (_) {}

      try {
        const { data, error } = await window.ezsite.apis.tablePage(SETTINGS_TABLE_ID, {
          PageNo: 1,
          PageSize: 1,
          Filters: [{ name: 'setting_key', op: 'Equal', value: POSTER_KEY }]
        });
        if (!error && data?.List?.length > 0) {
          settingIdRef.current = data.List[0].ID;
          if (data.List[0].setting_value) {
            setPosterUrl(data.List[0].setting_value);
          }
        }
      } catch (_) {}
    })();
  }, []);

  const handlePosterUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg('');
    try {
      const { data: fileId, error: uploadError } = await window.ezsite.apis.upload({
        filename: file.name,
        file
      });
      if (uploadError) throw new Error(uploadError);

      const { data: url, error: urlError } = await window.ezsite.apis.getUploadUrl(fileId);
      if (urlError) throw new Error(urlError);

      // Save to DB
      if (settingIdRef.current) {
        await window.ezsite.apis.tableUpdate(SETTINGS_TABLE_ID, {
          ID: settingIdRef.current,
          setting_value: url
        });
      } else {
        const { data: newRow, error: createError } = await window.ezsite.apis.tableCreate(SETTINGS_TABLE_ID, {
          setting_key: POSTER_KEY,
          setting_value: url
        });
        if (!createError && newRow?.ID) settingIdRef.current = newRow.ID;
      }

      setPosterUrl(url);
      setUploadMsg('Poster updated successfully!');
    } catch (err) {
      setUploadMsg('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };
  usePageMeta({
    title: 'Musical Talent Showcase 2026 — NZ Melting Pot Auckland',
    description:
    "Register for Auckland's annual Musical Talent Showcase — a celebration, not a competition. Soloists, duets, and trios — vocalists and instrumentalists, all ages welcome. Saturday 18 July 2026. Performer fee from $10 NZD per participant.",
    path: '/musical-talent-showcase'
  });

  // Scroll to hash on page load (e.g., #register from Terms page)
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
          // Focus on the first input in the form
          const firstInput = element.querySelector('input, select, textarea');
          if (firstInput) {
            firstInput.focus();
          }
        }
      }, 100);
    }
  }, [location.hash]);

  return (
    <>
      <OrganizationSchema />
      <TalentShowcaseEventSchema />

      {/* Page Hero */}
      <section className="page-hero page-hero--showcase">
        <div className="container">
          <p className="text-accent page-hero__tag">Saturday 18 July 2026</p>
          <h1>Musical Talent<br />Showcase</h1>
          <p>Auckland's annual stage for soloists, duets, and trios — vocalists and instrumentalists alike. Sign up, show up, and let your music do the talking.</p>
        </div>
        <div className="divider divider--bottom divider--tall">
          <svg viewBox="0 0 1440 90" preserveAspectRatio="none" fill="var(--color-white)">
            <path d="M0,56 C320,90 640,10 960,50 C1150,70 1340,30 1440,20 L1440,90 L0,90 Z" />
          </svg>
        </div>
      </section>

      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Musical Talent Showcase', to: '/musical-talent-showcase' }]} />

      {/* Event Info — "Your turn on stage" on the LEFT, poster on the RIGHT */}
      <section className="event-info" id="poster">
        <div className="container">
          <div className="event-info__grid" style={{ alignItems: 'flex-start' }}>

            {/* LEFT — Your turn on stage */}
            <div className="event-info__text reveal-left" data-delay="150">
              <p className="text-accent">About the Event</p>
              <h2>Your turn on stage</h2>
              <p>The Musical Talent Showcase is our flagship annual event — performers from across Auckland take the stage in front of a warm, welcoming community audience. It's a celebration of local talent, not a competition.</p>

              <div className="info-highlights">
                <div className="info-highlight reveal" data-delay="100">
                  <div className="info-highlight__icon">
                    <AnimatedIcon name="star" />
                  </div>
                  <div>
                    <strong>Open Stage</strong>
                    <p>First time or hundredth time — it doesn't matter. If you want to perform, there's a spot for you.</p>
                  </div>
                </div>
                <div className="info-highlight reveal" data-delay="180">
                  <div className="info-highlight__icon">
                    <AnimatedIcon name="grid" />
                  </div>
                  <div>
                    <strong>Multiple Categories</strong>
                    <p>Vocalists and instrumentalists — soloists, duets, and trios — plus age categories from under 12 to open.</p>
                  </div>
                </div>
                <div className="info-highlight reveal" data-delay="260">
                  <div className="info-highlight__icon">
                    <AnimatedIcon name="feedback" />
                  </div>
                  <div>
                    <strong>Warm, Encouraging Audience</strong>
                    <p>The audience cheers every performer on, and we celebrate everyone who takes the stage at the end of the day.</p>
                  </div>
                </div>
                <div className="info-highlight reveal" data-delay="340">
                  <div className="info-highlight__icon">
                    <AnimatedIcon name="handshake" />
                  </div>
                  <div>
                    <strong>Showcase, Not Competition</strong>
                    <p>It's a celebration of music and community. Everyone in the room is here because they care about the same thing you do — sharing the joy of performing.</p>
                  </div>
                </div>
              </div>

              <ul className="categories-list" aria-label="Performance categories">
                <li>Vocal Solo</li><li>Instrumental</li><li>Duet</li><li>Trio</li>
                <li>Under 12</li><li>12 – 17</li><li>18+</li><li>Open / Mixed</li>
              </ul>
            </div>

            {/* RIGHT — poster image + download buttons */}
            <div
              className="reveal-right"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                position: 'sticky',
                top: 20
              }}>

              {/* Poster image */}
              <div style={{ position: 'relative', width: '100%', maxWidth: 600 }}>
                <a
                  href={posterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open the full-size Musical Talent Showcase 2026 poster in a new tab"
                  style={{
                    display: 'block',
                    width: '100%',
                    borderRadius: 12,
                    overflow: 'hidden',
                    boxShadow: '0 12px 36px rgba(30, 25, 21, 0.18)',
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    transition: 'transform 0.25s ease, box-shadow 0.25s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = '0 18px 44px rgba(30, 25, 21, 0.22)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 12px 36px rgba(30, 25, 21, 0.18)';
                  }}>
                  <img
                    src={posterUrl}
                    alt="Musical Talent Showcase 2026 poster — Saturday 18 July, Blockhouse Bay Community Centre, Auckland"
                    loading="lazy"
                    width="800"
                    height="1185"
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                    className="object-contain" />
                </a>

                {/* Admin-only replace poster button */}
                {isAdmin &&
                <div style={{ marginTop: 10, textAlign: 'center' }}>
                    <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handlePosterUpload} />
                    <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    style={{
                      background: '#7B1E2D',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '9px 20px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: uploading ? 'not-allowed' : 'pointer',
                      opacity: uploading ? 0.7 : 1,
                      transition: 'opacity 0.2s'
                    }}>
                      {uploading ? 'Uploading…' : 'Replace Poster (Admin)'}
                    </button>
                    {uploadMsg &&
                  <p style={{
                    marginTop: 6,
                    fontSize: '0.82rem',
                    color: uploadMsg.startsWith('Poster updated') ? '#166534' : '#991b1b'
                  }}>
                        {uploadMsg}
                      </p>
                  }
                  </div>
                }
              </div>
              <div style={{
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                justifyContent: 'center',
                maxWidth: 460
              }}>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    "Musical Talent Showcase 2026 flyer — Saturday 18 July, Blockhouse Bay Community Centre, Auckland.\n\nhttps://www.nzmeltingpot.com/posters/talent-showcase-2026-poster.png"
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share the Musical Talent Showcase 2026 flyer on WhatsApp"
                  className="btn btn--primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>

                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347zm-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                  </svg>
                  Share on WhatsApp
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent(
                    "NZ Melting Pot Musical Talent Showcase 2026 — Event Flyer"
                  )}&body=${encodeURIComponent(
                    "Hi,\n\nPlease find the event flyer for the NZ Melting Pot Musical Talent Showcase 2026 below.\n\nDate: Saturday, 18 July 2026\nVenue: Blockhouse Bay Community Centre, 524 Blockhouse Bay Road, Auckland 0600\n\nFlyer image:\nhttps://www.nzmeltingpot.com/posters/talent-showcase-2026-poster.png\n\nSee you there!"
                  )}`}
                  aria-label="Share the Musical Talent Showcase 2026 by email"
                  className="btn btn--outline"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>

                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                  Share via Email
                </a>
              </div>
            </div>
          </div>

          {/* Event Details — full-width strip below the 2-col grid */}
          <div
            className="event-info__sidebar reveal"
            style={{ marginTop: 48 }}>

            <h3>Event Details</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
              marginBottom: 24
            }}>
              <div className="info-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                <div><strong>Date</strong><span>Saturday, 18 July 2026</span></div>
              </div>
              <div className="info-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                <div><strong>Time</strong><span>Doors open TBA</span></div>
              </div>
              <div className="info-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                <div><strong>Venue</strong><span>Blockhouse Bay Community Centre, 524 Blockhouse Bay Road, Blockhouse Bay, Auckland 0600</span></div>
              </div>
              <div className="info-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2M13 17v2M13 11v2" /></svg>
                <div><strong>Performer Fee</strong><span>$10 per participant</span></div>
              </div>
              <div className="info-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01" /></svg>
                <div><strong>Audience Tickets</strong><span>$10 per ticket · up to 10 per booking</span></div>
              </div>
              <div className="info-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                <div><strong>Who</strong><span>Open to all ages and skill levels</span></div>
              </div>
            </div>
            <div className="event-info__sidebar-cta" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <a href="#register" className="btn btn--primary event-info__sidebar-btn" onClick={(e) => {e.preventDefault();document.getElementById('register')?.scrollIntoView({ behavior: 'smooth' });}}>Register to Perform</a>
              <Link to="/book-tickets" className="btn btn--outline event-info__sidebar-btn">Book Audience Tickets</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Sponsor banner — placed just above the Sign-Up section */}
      <section id="sponsor" style={{ padding: '40px 20px 24px', background: 'var(--color-cream, #FBF5ED)' }}>
        <div className="container reveal" style={{ maxWidth: 900 }}>
          <p style={{
            textAlign: 'center',
            fontSize: '0.78rem',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: '#7B1E2D',
            margin: '0 0 16px 0',
            fontWeight: 600
          }}>
            Proudly Supported By Our Sponsor
          </p>
          <a
            href="https://www.jrfinance.co.nz"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visit JR Finance website (opens in a new tab)"
            style={{
              display: 'block',
              textDecoration: 'none',
              color: 'inherit',
              background: '#fff',
              border: '1.5px solid #e2e8f0',
              borderRadius: 14,
              padding: '24px 28px',
              boxShadow: '0 4px 16px rgba(30, 25, 21, 0.06)',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(30, 25, 21, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(30, 25, 21, 0.06)';
            }}>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 28,
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}>
              {/* JR Finance brand mark */}
              <div style={{ flex: '0 0 auto', textAlign: 'center', minWidth: 120 }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 700, color: '#3b6db8', letterSpacing: 1, lineHeight: 1 }}>JR</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: '#3b6db8', letterSpacing: 3, marginTop: 4 }}>FINANCE</div>
                <div style={{ fontSize: 10, color: '#6b86b3', letterSpacing: 1.5, marginTop: 6, textTransform: 'lowercase' }}>create wealth</div>
              </div>

              {/* Vertical divider */}
              <div style={{ width: 1, alignSelf: 'stretch', background: '#e2e8f0', flex: '0 0 1px' }} aria-hidden="true" />

              {/* Advisor details */}
              <div style={{ flex: '1 1 240px', minWidth: 240, color: '#374151', fontSize: '0.95rem', lineHeight: 1.5 }}>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1f2937', letterSpacing: 0.4 }}>JOHNRAE TANNEN</div>
                <div style={{ color: '#6b86b3', fontSize: '0.88rem', marginBottom: 8 }}>Financial Advisor</div>
                <div>+64 27-283-1946 &nbsp;·&nbsp; johnrae@jrfinance.co.nz</div>
                <div style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: 2 }}>1A/268 Manukau Road, Epsom, Auckland 1023</div>
              </div>
            </div>
          </a>
        </div>
      </section>

      {/* Registration Form */}
      <section className="register-section" id="register">
        <div className="divider divider--top">
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" fill="var(--color-white)">
            <path d="M0,40 C480,0 960,55 1440,15 L1440,0 L0,0 Z" />
          </svg>
        </div>
        <div className="container container--narrow">
          <div className="register-section__header reveal">
            <p className="text-accent">Registrations Open</p>
            <h2>Sign Up for 2026</h2>
            <p>Fill in your details below and we'll confirm your spot. Performer fee: $10 per participant.</p>
          </div>
          <div className="reveal" data-delay="150">
            <RegistrationForm idPrefix="tsc" />
          </div>
        </div>
        <div className="divider divider--bottom">
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" fill="var(--color-sand)">
            <path d="M0,10 C360,55 900,0 1440,35 L1440,60 L0,60 Z" />
          </svg>
        </div>
      </section>

      {/* Gallery */}
      <section className="gallery-section" id="gallery">
        <div className="container container--wide">
          <div className="gallery-section__header reveal">
            <p className="text-accent">From Previous Years</p>
            <h2>Gallery</h2>
            <p>Moments from the stage — performers and the crowd that makes it all happen.</p>
          </div>
          <div className="reveal" data-delay="100">
            <Gallery images={showcaseImages} />
          </div>
        </div>
      </section>

      {/* Cross-Promo — links to Musical Ensemble */}
      <section className="tickets-section tickets-section--dark">
        <div className="divider divider--top">
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" fill="var(--color-sand)">
            <path d="M0,45 C480,5 960,50 1440,10 L1440,0 L0,0 Z" />
          </svg>
        </div>
        <div className="container cross-promo">
          <div className="reveal">
            <p className="text-accent cross-promo__tag">Prefer Playing Together?</p>
            <h2>Join the Musical Ensemble</h2>
            <div className="cross-promo__features">
              <span className="cross-promo__pill">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>
                No Auditions
              </span>
              <span className="cross-promo__pill">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>
                No Pressure
              </span>
              <span className="cross-promo__pill">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>
                Community Jam
              </span>
            </div>
            <Link to="/musical-ensemble" className="btn btn--primary btn--large">Explore the Ensemble</Link>
          </div>
        </div>
      </section>
    </>);

}