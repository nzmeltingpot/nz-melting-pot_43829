import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data, error } = await window.ezsite.apis.getUserInfo();
        if (!error && data && data.Roles) {
          const roles = data.Roles.split(',').map((r) => r.trim());
          setIsAdmin(roles.includes('Administrator'));
        }
      } catch {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, []);

  return (
    <footer className="footer">
      <div className="container">
        {/* Designer credit — top of footer, white text on dark background */}
        <div style={{
          textAlign: 'center',
          padding: '14px 16px 4px',
          color: '#ffffff'
        }}>
          <span style={{ fontSize: '0.9rem', letterSpacing: '0.5px' }}>
            Website by{' '}
            <a
              href="https://websmarthq.com/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#ffffff',
                fontWeight: 600,
                textDecoration: 'underline',
                textUnderlineOffset: '3px'
              }}>
              Web Smart HQ
            </a>
          </span>
          <span style={{
            display: 'inline-block',
            marginLeft: 10,
            fontSize: '0.78rem',
            color: '#ffffff',
            fontStyle: 'italic'
          }} className="">
            — Smart sites & smart SEO that get your business found., click here to find out more
          </span>
        </div>

        {/* Large typographic lockup */}
        <div className="footer__marquee" aria-hidden="true">
          <p className="footer__marquee-text">
            Every Voice<em>Every Rhythm</em>
          </p>
        </div>

        <div className="footer__grid">
          <div>
            <div className="footer__brand">
              <img src="/images/branding/logo-150x150.png" alt="NZ Melting Pot" width="44" height="44" />
              <span>NZ Melting Pot</span>
            </div>
            <p className="footer__about">
              A registered not-for-profit charity based in Auckland, New Zealand. We bring communities
              together through live music — two annual community events, open to all ages and backgrounds.
            </p>
          </div>
          <div>
            <p className="footer__heading">Events</p>
            <ul className="footer__links">
              <li><Link to="/musical-talent-showcase">Musical Talent Showcase</Link></li>
              <li><Link to="/musical-ensemble">Musical Ensemble</Link></li>
              <li><Link to="/musical-talent-showcase">Register to Perform</Link></li>
              <li><Link to="/book-tickets">Book Audience Tickets</Link></li>
            </ul>
          </div>
          <div>
            <p className="footer__heading">Get in Touch</p>
            <ul className="footer__links footer__contact">
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                <a href="mailto:info@nzmeltingpot.com">info@nzmeltingpot.com</a>
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                <span>Auckland, New Zealand</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer__bottom">
          <span>&copy; {new Date().getFullYear()} NZ Melting Pot. All rights reserved.</span>
          <span>A registered New Zealand charity</span>
          {isAdmin &&
          <Link to="/admin" className="footer__admin-link">Site Admin</Link>
          }
        </div>
      </div>
    </footer>);

}