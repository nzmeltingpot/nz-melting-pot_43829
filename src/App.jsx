import { Routes, Route, useLocation, useNavigationType } from 'react-router-dom';
import { useEffect, useLayoutEffect, lazy, Suspense, useRef } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

/* Route-based code splitting — each page loads only when visited */
const Home = lazy(() => import('./pages/Home'));
const TalentShowcase = lazy(() => import('./pages/TalentShowcase'));
const MusicalEnsemble = lazy(() => import('./pages/MusicalEnsemble'));
const GalleryPage = lazy(() => import('./pages/GalleryPage'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Terms = lazy(() => import('./pages/Terms'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Admin = lazy(() => import('./pages/Admin'));
const EmailTest = lazy(() => import('./pages/EmailTest'));
const Unsubscribe = lazy(() => import('./pages/Unsubscribe'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const PaymentCancelled = lazy(() => import('./pages/PaymentCancelled'));
const BookTickets = lazy(() => import('./pages/BookTickets'));
const BookingSuccess = lazy(() => import('./pages/BookingSuccess'));
const TicketPreview = lazy(() => import('./pages/TicketPreview'));

/**
 * RouteScrollManager handles scroll position on navigation.
 * Uses a hide-scroll-reveal pattern to prevent flash of footer.
 */
function RouteScrollManager() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const prevPathRef = useRef(pathname);

  useLayoutEffect(() => {
    // Only act on actual route changes (not initial load)
    if (prevPathRef.current !== pathname) {
      // Immediately hide everything by adding class to body
      document.body.classList.add('navigating');

      // Scroll to top instantly
      window.scrollTo(0, 0);

      // Use requestAnimationFrame to ensure scroll happened, then reveal
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.body.classList.remove('navigating');
        });
      });

      prevPathRef.current = pathname;
    }
  }, [pathname, navigationType]);

  // Handle initial page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return null;
}

export default function App() {
  console.log('🌐 APP COMPONENT LOADED');
  return (
    <>
      {/* Skip-to-content — first focusable element on every page */}
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>

      <RouteScrollManager />

      <header>
        <Navbar />
      </header>

      <main id="main-content">
        <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/musical-talent-showcase" element={<TalentShowcase />} />
            <Route path="/musical-ensemble" element={<MusicalEnsemble />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/email-test" element={<EmailTest />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/payment-cancelled" element={<PaymentCancelled />} />
            <Route path="/book-tickets" element={<BookTickets />} />
            <Route path="/booking-success" element={<BookingSuccess />} />
            <Route path="/ticket-preview" element={<TicketPreview />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>

      <Footer />

      {/* Subtle grain texture for warmth */}
      <div className="grain-overlay" aria-hidden="true" />
    </>);

}