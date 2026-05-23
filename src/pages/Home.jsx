import { Link } from 'react-router-dom';
import useScrollReveal from '../hooks/useScrollReveal';
import usePageMeta from '../hooks/usePageMeta';
import RegistrationForm from '../components/RegistrationForm';
import MusicParticles from '../components/MusicParticles';
import HeroMosaic from '../components/HeroMosaic';
import AnimatedIcon from '../components/AnimatedIcon';
import { OrganizationSchema, WebSiteSchema } from '../components/SchemaOrg';

export default function Home() {
  console.log('🏠 HOME PAGE LOADED - form should be below');
  useScrollReveal();
  usePageMeta({
    title: 'NZ Melting Pot — Auckland Community Music Events & Talent Showcase',
    description:
    'NZ Melting Pot is a not-for-profit charity in Auckland bringing communities together through two annual community music events — the Musical Talent Showcase and the Musical Ensemble.',
    path: '/'
  });

  return (
    <>
      <OrganizationSchema />
      <WebSiteSchema />

      {/* Hero */}
      <section className="hero">
        <MusicParticles />
        <div className="container hero__container">
          <div className="hero__content">
            <p className="hero__tag">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="15.5" r="2.5" /><path d="M8 17V5l12-2v12" /></svg>
              Auckland, New Zealand
            </p>
            <h1>
              <span className="sr-only">NZ Melting Pot Auckland — </span>
              <span className="hero__line">Every Voice.</span>
              <span className="hero__line">Every Rhythm.</span>
              <span className="hero__line"><em>NZ Melting Pot.</em></span>
            </h1>
            <p className="my-[25px] px-[0px] mx-[0px] py-[0px] hero__tagline">Enabling excellence by fostering unity and inclusivity in New Zealand's diverse society</p>
            <p className="text-[21px] my-[9px] hero__subtitle">NZ Melting Pot is a not-for-profit charity that brings Auckland's communities together through music. Two events. All backgrounds. No barriers.</p>
            <div className="hero__actions">
              <a href="#register" className="btn btn--primary btn--large" onClick={(e) => {e.preventDefault();document.getElementById('register')?.scrollIntoView({ behavior: 'smooth' });}}>Register for the Talent Showcase 2026</a>
              <a href="#events" className="btn btn--outline btn--large" onClick={(e) => {e.preventDefault();document.getElementById('events')?.scrollIntoView({ behavior: 'smooth' });}}>Our Events</a>
            </div>
          </div>
          <HeroMosaic />
        </div>
        {/* Scroll hint */}
        <div className="hero__scroll-hint" aria-hidden="true">
          <span />
        </div>
        <div className="divider divider--bottom divider--tall">
          <svg viewBox="0 0 1440 90" preserveAspectRatio="none" fill="var(--color-cream)">
            <path d="M0,64 C360,90 720,20 1080,56 C1260,72 1380,48 1440,36 L1440,90 L0,90 Z" />
          </svg>
        </div>
      </section>

      {/* Registration Form — right after hero so visitors can act immediately */}
      <section className="register-section" id="register">
        <div className="container container--narrow">
          <div className="register-section__header reveal">
            <p className="text-accent">Musical Talent Showcase 2026</p>
            <h2 className="">Come share the Stage</h2>
            <p>Sign up to perform at this year's showcase. Soloists, duets, and trios — vocalists and instrumentalists — everyone's welcome.</p>
          </div>
          <div className="reveal" data-delay="150">
            <RegistrationForm idPrefix="home" />
          </div>
        </div>
        <div className="divider divider--bottom">
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" fill="var(--color-white)">
            <path d="M0,0 C480,60 960,10 1440,40 L1440,60 L0,60 Z" />
          </svg>
        </div>
      </section>

      {/* About */}
      <section className="about-section" id="about">
        <div className="container">
          <div className="about__grid">
            <div className="about__text reveal-left">
              <p className="text-accent">Who We Are</p>
              <h2>Music runs through this city</h2>
              <p>Auckland is home to people from everywhere — different languages, traditions, and sounds. NZ Melting Pot exists because all of that deserves a stage.</p>
            </div>
            <div className="about__visual reveal-right" data-delay="150">
              <div className="about__img-wrapper">
                <img src="/images/talent-showcase/showcase-01.webp" alt="Performers at the NZ Melting Pot Musical Talent Showcase in Auckland" width="600" height="400" loading="lazy" decoding="async" />
              </div>
              <div className="about__img-accent" aria-hidden="true"></div>
            </div>
          </div>

          {/* Highlight cards — replaces dense paragraphs */}
          <div className="highlight-cards">
            <div className="highlight-card reveal" data-delay="0">
              <div className="highlight-card__icon">
                <AnimatedIcon name="heart" />
              </div>
              <h3>Not-for-Profit</h3>
              <p className="">No corporate sponsors calling the shots. Just a small team powered by a belief that live music brings people closer together.</p>
            </div>
            <div className="highlight-card reveal" data-delay="120">
              <div className="highlight-card__icon highlight-card__icon--amber">
                <AnimatedIcon name="notes" />
              </div>
              <h3>Two Events, One Goal</h3>
              <p className="">The <strong>Musical Talent Showcase</strong> is our flagship event — a celebration of local talent on stage in front of a warm community audience. The <strong>Musical Ensemble</strong> is relaxed and collaborative — no auditions, no competition. Both are annual, and both are open to everyone.</p>
            </div>
            <div className="highlight-card reveal" data-delay="240">
              <div className="highlight-card__icon highlight-card__icon--gold">
                <AnimatedIcon name="people" />
              </div>
              <h3>Open to All</h3>
              <p className="">All ages, all backgrounds, all skill levels. Whether you've been playing for decades or picked up an instrument just last month — there's room for you here.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Events Preview */}
      <section className="events-section" id="events">
        <div className="divider divider--top">
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" fill="var(--color-white)">
            <path d="M0,40 C360,0 720,60 1080,20 C1260,8 1380,30 1440,10 L1440,0 L0,0 Z" />
          </svg>
        </div>
        <div className="container">
          <div className="events-section__header reveal-scale">
            <p className="text-accent">What We Do</p>
            <h2>Two Events, One Goal</h2>
          </div>
          <div className="events__grid">
            <Link to="/musical-talent-showcase" className="event-card reveal-rotate" data-delay="0">
              <div className="event-card__img">
                <img src="/images/talent-showcase/showcase-05.webp" alt="Musical Talent Showcase performance on stage in Auckland" width="600" height="400" loading="lazy" decoding="async" />
                <span className="event-card__badge">Saturday 18 July 2026</span>
              </div>
              <div className="event-card__body">
                <h3>Musical Talent Showcase</h3>
                <p>Performers sign up, pick a category, and take the stage in front of a warm community audience. Soloists, duets, and trios — vocalists and instrumentalists — everyone's welcome.</p>
                <span className="event-card__link">
                  Learn more &amp; register
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </span>
              </div>
            </Link>

            <Link to="/musical-ensemble" className="event-card reveal-rotate" data-delay="150">
              <div className="event-card__img">
                <img src="/images/musical-ensemble/ensemble-01.webp" alt="Musicians gathered at the NZ Melting Pot Musical Ensemble in Auckland" width="600" height="400" loading="lazy" decoding="async" />
                <span className="event-card__badge">Annual Event</span>
              </div>
              <div className="event-card__body">
                <h3>Musical Ensemble</h3>
                <p>No auditions, no competition. Musicians from across Auckland come together for an afternoon of playing, learning, and making music as a group.</p>
                <span className="event-card__link">
                  See the gallery
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </span>
              </div>
            </Link>
          </div>
        </div>
        <div className="divider divider--bottom">
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" fill="var(--color-cream)">
            <path d="M0,20 C240,55 720,0 1200,40 C1350,50 1400,30 1440,25 L1440,60 L0,60 Z" />
          </svg>
        </div>
      </section>

      {/* Tickets */}
      <section className="tickets-section" id="tickets">
        <div className="container">
          <div className="tickets__inner">
            <div className="tickets__info reveal-left">
              <p className="text-accent">Mark Your Calendar</p>
              <h2>Musical Talent Showcase 2026</h2>
              <ul className="tickets__details">
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                  <span><strong>Date:</strong> Saturday, 18 July 2026</span>
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                  <span className="text-[#f96604]"><strong>Time:</strong> Doors open from TBA</span>
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  <span className=""><strong>Venue:</strong> 524 Blockhouse Bay Road, Blockhouse Bay, Auckland 0600</span>
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2M13 17v2M13 11v2" /></svg>
                  <span className=""><strong>Performer Fee:</strong> $10 per participant (Early Bird, until 01/06/2026) · $15 thereafter — community event</span>
                </li>
              </ul>
            </div>
            <div className="tickets__highlight reveal-scale" data-delay="150">
              <h3>Ready to Perform?</h3>
              <p className="date">18 July 2026</p>
              <p>Registrations are open. Pick your category, bring your best, and let Auckland hear you.</p>
              <br />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <a href="#register" className="btn" onClick={(e) => {e.preventDefault();document.getElementById('register')?.scrollIntoView({ behavior: 'smooth' });}}>Register to Perform</a>
                <Link to="/book-tickets" className="btn btn--outline">Book Audience Tickets</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>);

}