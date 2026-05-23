import { useState } from 'react';
import useScrollReveal from '../hooks/useScrollReveal';
import usePageMeta from '../hooks/usePageMeta';

export default function Contact() {
  useScrollReveal();
  usePageMeta({
    title: 'Contact Us — NZ Melting Pot',
    description: 'Get in touch with NZ Melting Pot. We\'d love to hear from you about our Auckland community music events.',
    path: '/contact'
  });

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', message: '' });

    const ADMIN_EMAILS = ['thenzmp@gmail.com', 'gragmire@gmail.com'];
    const FROM_ADDRESS = 'NZ Melting Pot Contact <noreply@nzmeltingpot.com>';

    // Build the admin-facing email (someone wrote to us)
    const subjectMap = {
      general: 'General Inquiry',
      events: 'Event Information',
      volunteer: 'Volunteering',
      partnership: 'Partnership / Sponsorship',
      media: 'Media Inquiry',
      other: 'Other'
    };
    const subjectLabel = subjectMap[formData.subject] || formData.subject;

    const escapeHtml = (s) => String(s ?? '').
    replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').
    replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const messageHtml = escapeHtml(formData.message).replace(/\n/g, '<br/>');

    try {
      // 1. Send the message to the admin
      const adminResult = await window.ezsite.apis.sendEmail({
        from: FROM_ADDRESS,
        to: ADMIN_EMAILS,
        replyTo: [formData.email.trim()],
        subject: `Contact form — ${subjectLabel} (from ${formData.name.trim()})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width:640px; margin:0 auto; padding:20px; color:#1f2937;">
            <h2 style="color:#7B1E2D; margin:0 0 8px 0;">📨 New Contact Form Message</h2>
            <p style="color:#6b7280; font-size:14px; margin:0 0 20px 0;">
              Someone has just sent a message via the contact page on nzmeltingpot.com.
            </p>
            <table style="width:100%; border-collapse:collapse; background:#fff; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; font-size:14px;">
              <tr><td style="padding:10px 14px; font-weight:600; color:#374151; width:140px; border-bottom:1px solid #e5e7eb;">Name</td><td style="padding:10px 14px; color:#1f2937; border-bottom:1px solid #e5e7eb;">${escapeHtml(formData.name)}</td></tr>
              <tr><td style="padding:10px 14px; font-weight:600; color:#374151; border-bottom:1px solid #e5e7eb;">Email</td><td style="padding:10px 14px; color:#1f2937; border-bottom:1px solid #e5e7eb;"><a href="mailto:${escapeHtml(formData.email)}" style="color:#7B1E2D;">${escapeHtml(formData.email)}</a></td></tr>
              <tr><td style="padding:10px 14px; font-weight:600; color:#374151; border-bottom:1px solid #e5e7eb;">Subject</td><td style="padding:10px 14px; color:#1f2937; border-bottom:1px solid #e5e7eb;">${escapeHtml(subjectLabel)}</td></tr>
              <tr><td style="padding:10px 14px; font-weight:600; color:#374151; vertical-align:top;">Message</td><td style="padding:10px 14px; color:#1f2937; line-height:1.6;">${messageHtml}</td></tr>
            </table>
            <p style="color:#9ca3af; font-size:12px; margin-top:20px;">Reply directly to this email to respond — the sender's address is set as Reply-To.</p>
          </div>
        `
      });

      if (adminResult?.error) {
        throw new Error(adminResult.error);
      }

      // 2. Send a confirmation to the sender (best-effort — don't fail the whole flow if this errors)
      try {
        await window.ezsite.apis.sendEmail({
          from: FROM_ADDRESS,
          to: [formData.email.trim()],
          subject: 'Thanks for contacting NZ Melting Pot',
          html: `
            <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto; padding:20px; color:#2d3748;">
              <p>Hi ${escapeHtml(formData.name)},</p>
              <p>Thank you for getting in touch with NZ Melting Pot. We've received your message and will get back to you within 48 hours.</p>
              <div style="background:#f9fafb; border-left:4px solid #7B1E2D; padding:12px 16px; margin:18px 0; font-size:13px; color:#374151;">
                <strong>Your message (${escapeHtml(subjectLabel)}):</strong><br/>
                <span style="white-space:pre-wrap;">${messageHtml}</span>
              </div>
              <p>Warm regards,<br/>The NZ Melting Pot Team</p>
              <hr style="border:none; border-top:1px solid #e2e8f0; margin:20px 0;"/>
              <p style="font-size:11px; color:#a0aec0;">NZ Melting Pot · Auckland, New Zealand · <a href="https://www.nzmeltingpot.com" style="color:#a0aec0;">www.nzmeltingpot.com</a></p>
            </div>
          `
        });
      } catch (confirmErr) {
        console.warn('Confirmation email to user failed (non-blocking):', confirmErr);
      }

      setStatus({
        type: 'success',
        message: "Thank you for your message! We've received it and will get back to you within 48 hours."
      });
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      console.error('Contact form submit failed:', err);
      setStatus({
        type: 'error',
        message: 'Sorry — something went wrong sending your message. Please email us directly at info@nzmeltingpot.com.'
      });
    }

    setLoading(false);
  };

  return (
    <>
      {/* Hero */}
      <section className="page-hero">
        <div className="container">
          <div className="page-hero__content reveal">
            <p className="text-accent">Say Hello</p>
            <h1>Contact Us</h1>
            <p className="page-hero__subtitle">
              Have a question, suggestion, or just want to connect? We'd love to hear from you.
            </p>
          </div>
        </div>
        <div className="divider divider--bottom">
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" fill="var(--color-cream)">
            <path d="M0,20 C480,60 960,10 1440,40 L1440,60 L0,60 Z" />
          </svg>
        </div>
      </section>

      {/* Contact Content */}
      <section className="contact-section">
        <div className="container">
          <div className="contact-grid">
            {/* Contact Info */}
            <div className="contact-info reveal-left">
              <h2>Get in Touch</h2>
              <p>
                Whether you have questions about our events, want to volunteer, or are interested in partnerships —
                we're here to help.
              </p>

              <div className="contact-details">
                <div className="contact-detail">
                  <div className="contact-detail__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <div>
                    <h3>Location</h3>
                    <p>Auckland, New Zealand</p>
                  </div>
                </div>

                <div className="contact-detail">
                  <div className="contact-detail__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                  <div>
                    <h3>Email</h3>
                    <p><a href="mailto:info@nzmeltingpot.com" style={{ color: 'inherit', textDecoration: 'none' }}>info@nzmeltingpot.com</a></p>
                  </div>
                </div>

                <div className="contact-detail">
                  <div className="contact-detail__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  </div>
                  <div>
                    <h3>Response Time</h3>
                    <p>We typically respond within 48 hours</p>
                  </div>
                </div>
              </div>

              <div className="contact-social">
                <h3>Follow Us</h3>
                <div className="contact-social__links">
                  <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                    </svg>
                  </a>
                  <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="2" y="2" width="20" height="20" rx="5" />
                      <circle cx="12" cy="12" r="4" />
                      <circle cx="18" cy="6" r="1" />
                    </svg>
                  </a>
                  <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
                      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="var(--color-white)" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="contact-form-wrapper reveal-right" data-delay="150">
              <form className="contact-form" onSubmit={handleSubmit}>
                <h2>Send a Message</h2>

                {status.message &&
                <div className={`contact-form__status contact-form__status--${status.type}`}>
                    {status.message}
                  </div>
                }

                <div className="form-group">
                  <label htmlFor="contact-name">Your Name</label>
                  <input
                    type="text"
                    id="contact-name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="John Smith" />

                </div>

                <div className="form-group">
                  <label htmlFor="contact-email">Email Address</label>
                  <input
                    type="email"
                    id="contact-email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="john@example.com" />

                </div>

                <div className="form-group">
                  <label htmlFor="contact-subject">Subject</label>
                  <select
                    id="contact-subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required>

                    <option value="">Select a subject</option>
                    <option value="general">General Inquiry</option>
                    <option value="events">Event Information</option>
                    <option value="volunteer">Volunteering</option>
                    <option value="partnership">Partnership / Sponsorship</option>
                    <option value="media">Media Inquiry</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="contact-message">Your Message</label>
                  <textarea
                    id="contact-message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows="5"
                    placeholder="Tell us what's on your mind..." />

                </div>

                <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </>);

}