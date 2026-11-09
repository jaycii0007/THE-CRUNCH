import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, CheckCircle, ShoppingBag, ArrowRight, X, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { ImageStreamHero } from '@/components/ui/image-stream-hero';
import { ShaderBackground } from '@/components/ui/daa';

// ── Design Tokens ──────────────────────────────────────────────────────────
const BLACK = '#1A1A1A';
const GOLD = '#C9A84C';
const GOLD_DARK = '#B8953A';
const GOLD_LIGHT = '#E8D4A0';
const CREAM = '#F5F0E8';
const CHARCOAL = '#282823';
const GREY_FOG = '#595C56';
const BUTTER = '#E9BE5F';
const BLOND = '#F5E8B6';

const CARD_BG = BLACK;
const BORDER = 'rgba(89,92,86,0.25)';
const TEXT = CREAM;
const MUTED = 'rgba(245,240,232,0.58)';

// ── Verified Local Food Images ─────────────────────────────────────────────
// All images verified to exist in public/img/
const HERO_IMAGES = [
  '/img/signatureglazed1.webp',
  '/img/signatureglazed2.webp',
  '/img/chickenhoneygarlic.webp',
  '/img/chickenteriyaki.webp',
  '/img/chickentexasbbq.webp',
  '/img/chickenspicekstyle.webp',
  '/img/chickenspecialcheese.webp',
  '/img/chickengarlicparmesan.webp',
  '/img/chickenskin.webp',
  '/img/chicken poppers 2.webp',
  '/img/chickchicken.webp',
  '/img/chicken1.webp',
];

// ── Types ──────────────────────────────────────────────────────────────────
interface ProductsProps {
  isAuthenticated?: boolean;
}

// ── Animation Variants ─────────────────────────────────────────────────────
const easeOut = [0.16, 1, 0.3, 1] as const;

// ── Trust Badge ────────────────────────────────────────────────────────────
function TrustBadge({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '7px 12px',
        background: 'rgba(26,26,26,0.75)',
        border: `1px solid ${GOLD}22`,
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 500,
        color: 'rgba(245,240,232,0.85)',
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={13} color={GOLD} style={{ flexShrink: 0 }} />
      <span>{text}</span>
    </div>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: BLACK, borderTop: '1px solid var(--line)', padding: '48px 0 32px', marginTop: 60 }}>
      <div className="wrap" style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 28 }}>
          {/* Left — Business Information */}
          <div style={{ flex: '1 1 280px', minWidth: 240 }}>
            <p style={{ fontWeight: 800, fontSize: 18 }}>The <span style={{ color: GOLD }}>Crunch</span></p>
            <p style={{ color: MUTED, marginTop: 6, fontSize: 13.5 }}>6 Falcon St., cor Dahlia Fairview,<br />Quezon City, Philippines</p>
            <a href="https://www.google.com/maps/place/The+Crunch+-+Fairview+Branch/@14.7002687,121.0662915,21z" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 13.5, fontWeight: 600, color: GOLD, textDecoration: 'none' }}>
              <MapPin size={14} />View on Google Maps
            </a>
          </div>
          {/* Center — Social Media */}
          <div style={{ flex: '1 1 180px', minWidth: 160, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <p style={{ color: MUTED, fontSize: 12 }}>Follow us</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              <a style={{ color: GOLD, transition: 'color 0.2s ease', textDecoration: 'none' }} href="https://www.instagram.com/thecrunchfairview" target="_blank" rel="noopener noreferrer">Instagram</a>
              <a style={{ color: GOLD, transition: 'color 0.2s ease', textDecoration: 'none' }} href="https://www.facebook.com/thecrunchfairview" target="_blank" rel="noopener noreferrer">Facebook</a>
            </div>
          </div>
          {/* Right — Operating Hours */}
          <div style={{ flex: '1 1 200px', minWidth: 180, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <p style={{ color: MUTED, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={13} />Hours</p>
            <p style={{ color: MUTED, marginTop: 6, fontSize: 13.5, textAlign: 'right' }}>Mon–Fri: 10 AM – 10 PM<br />Sat–Sun: 11 AM – 8:30 PM</p>
          </div>
        </div>
        <p style={{ color: MUTED, marginTop: 36, paddingTop: 18, borderTop: '1px solid var(--line)', fontSize: 12, textAlign: 'center' }}>© {new Date().getFullYear()} The Crunch Fairview. All rights reserved.</p>
      </div>
    </footer>
  );
}

// ── Global Styles Injection ────────────────────────────────────────────────
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@700;800&display=swap');

@font-face {
  font-family: 'Pencerio';
  src: url('/fonts/ClashDisplay_Complete/Pencerio_Complete/Fonts/WEB/fonts/Pencerio-Hairline.woff2') format('woff2'),
       url('/fonts/ClashDisplay_Complete/Pencerio_Complete/Fonts/WEB/fonts/Pencerio-Hairline.woff') format('woff'),
       url('/fonts/ClashDisplay_Complete/Pencerio_Complete/Fonts/WEB/fonts/Pencerio-Hairline.ttf') format('truetype');
  font-weight: 100;
  font-style: normal;
  font-display: swap;
}

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
:root{
  --charcoal:${CHARCOAL};
  --grey-fog:${GREY_FOG};
  --butter:${BUTTER};
  --blond:${BLOND};
  --black:${BLACK};
  --gold:${GOLD};
  --gold-dark:${GOLD_DARK};
  --gold-light:${GOLD_LIGHT};
  --cream:${CREAM};
  --bg:${BLACK};
  --card:${CARD_BG};
  --line:${BORDER};
  --text:${TEXT};
  --muted:${MUTED};
}
body{background:var(--bg);font-family:'Inter',system-ui,sans-serif;color:var(--text)}
.pc{background:var(--bg);color:var(--text);min-height:100vh}
.pc button{font-family:inherit}
.pc :focus-visible{outline:2px solid var(--butter);outline-offset:2px}
.wrap{max-width:1280px;margin:0 auto;padding:0 24px;width:100%}
@keyframes shimmer{to{background-position:-200% 0}}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.6;transform:scale(0.9)}}
@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}
@media(max-width:768px){.links,.status.hide-m{display:none}.burger{display:flex}}
`;

// ── Main Products Page ─────────────────────────────────────────────────────
export default function Products(_props: ProductsProps) {
  const navigate = useNavigate();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    const checkReduceMotion = () => setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    checkReduceMotion();
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener?.('change', checkReduceMotion);
    return () => mq.removeEventListener?.('change', checkReduceMotion);
  }, []);

  const goOrder = useCallback(() => navigate('/usersmenu?showOrderModal=true'), [navigate]);

  // Inject global styles
  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'products-global-css';
    el.innerHTML = GLOBAL_CSS;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  return (
    <div className="pc">
      <Navbar />

      {/* ── HERO SECTION ── */}
      <section
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 'calc(100svh - 72px)',
          maxHeight: 'calc(100svh - 72px)',
          background: BLACK,
          overflow: 'hidden',
          isolation: 'isolate',
          paddingTop: '72px', /* Account for fixed navbar height */
        }}
        aria-label="The Crunch hero"
      >
        {/* Layer 1: ShaderBackground - backmost, full bleed */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
          <ShaderBackground fallbackColor={BLACK} />
        </div>

        {/* Layer 2: Very subtle dark scrim for contrast control - barely visible */}
        <div
          className="pointer-events-none"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            background: 'linear-gradient(180deg, rgba(26,26,26,0.35) 0%, rgba(26,26,26,0.1) 35%, transparent 55%, transparent 100%)',
          }}
          aria-hidden="true"
        />

        {/* Layer 3: ImageStreamHero - full size corridor, transparent bg so shader shows through */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}>
          <ImageStreamHero
            images={HERO_IMAGES}
            speed={35}
            axis={0.5}
            cards={14}
            path={0.12}
            className="bg-transparent h-full min-h-0"
          />
        </div>

        {/* Layer 4: Inner focus scrim - very subtle, only protects headline legibility */}
        <div
          className="pointer-events-none"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            background: 'radial-gradient(ellipse 55% 45% at 50% 50%, transparent 0%, rgba(26,26,26,0.08) 35%, rgba(26,26,26,0.25) 65%, rgba(10,10,10,0.55) 100%)',
          }}
          aria-hidden="true"
        />

        {/* Layer 5: Centered Content - zIndex 10 */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'clamp(16px, 3vw, 32px) clamp(20px, 4vw, 32px)',
            textAlign: 'center',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: easeOut }}
            style={{ maxWidth: '680px', width: '100%' }}
          >
            {/* Premium Badge */}
            <motion.span
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6, ease: easeOut }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: `linear-gradient(135deg, ${GOLD}1A 0%, ${GOLD}08 100%)`,
                border: `1px solid ${GOLD}40`,
                padding: '8px 16px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                color: GOLD_LIGHT,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                width: 'fit-content',
                margin: '0 auto 20px',
                boxShadow: `0 4px 16px -4px ${GOLD}20`,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD, animation: reduceMotion ? 'none' : 'pulse 2.2s infinite ease-in-out', boxShadow: `0 0 8px ${GOLD}` }} />
              7 Signature Glazes
            </motion.span>

            {/* Main Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.8, ease: easeOut }}
              style={{
                fontSize: 'clamp(2.75rem, 6vw, 5.25rem)',
                fontWeight: 800,
                letterSpacing: '-0.035em',
                lineHeight: 1.02,
                marginBottom: 'clamp(16px, 2.5vw, 24px)',
                fontFamily: 'Poppins, Inter, system-ui, sans-serif',
                textShadow: '0 4px 40px rgba(0,0,0,0.5)',
                color: CREAM,
              }}
            >
              <span style={{ display: 'block', color: CREAM, fontWeight: 800 }}>THE CRUNCH</span>
              <span style={{ display: 'block', color: GOLD, marginTop: '-0.04em', fontWeight: 800 }}>SIGNATURE</span>
              <span style={{ display: 'block', color: CREAM, opacity: 0.92, fontWeight: 700, fontSize: 'clamp(2rem, 4.5vw, 3.5rem)', marginTop: '-0.015em' }}>CHICKEN</span>
            </motion.h1>

            {/* Supporting Description */}
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.7, ease: easeOut }}
              style={{
                fontSize: 'clamp(1rem, 1.8vw, 1.125rem)',
                maxWidth: '520px',
                margin: '0 auto 28px',
                fontWeight: 400,
                lineHeight: 1.7,
                color: 'rgba(245,240,232,0.85)',
                textShadow: '0 1px 3px rgba(0,0,0,0.4)',
              }}
            >
              Hand-crafted daily with our secret spice rubs. Choose from 7 signature glazes — each bite delivers the perfect crunch.
            </motion.p>

            {/* Explore Menu CTA */}
            <motion.button
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.65, duration: 0.6, ease: easeOut }}
              whileHover={{ scale: 1.02, boxShadow: `0 12px 32px -6px ${GOLD}50, inset 0 1px 0 rgba(255,255,255,0.2), 0 0 0 1px ${GOLD}40`, y: -2 }}
              whileTap={{ scale: 0.98, y: 0 }}
              onClick={goOrder}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: 'clamp(12px, 2vw, 14px) clamp(28px, 4vw, 36px)',
                fontSize: 'clamp(14px, 1.6vw, 15px)',
                fontWeight: 600,
                letterSpacing: '0.01em',
                borderRadius: 12,
                background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
                color: BLACK,
                border: 'none',
                boxShadow: `0 6px 24px -4px ${GOLD}40, inset 0 1px 0 rgba(255,255,255,0.15), 0 0 0 1px ${GOLD}25`,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <ShoppingBag size={17} />
              <span>Explore Menu</span>
              <ArrowRight size={17} />
            </motion.button>

            {/* Trust Badges */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85, duration: 0.6, ease: easeOut }}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'clamp(8px, 1.2vw, 12px)',
                marginTop: 'clamp(28px, 5vw, 40px)',
                paddingTop: 'clamp(20px, 4vw, 28px)',
                borderTop: `1px solid ${GOLD}18`,
                justifyContent: 'center',
              }}
            >
              <TrustBadge icon={CheckCircle} text="7 Signature Glazes" />
              <TrustBadge icon={CheckCircle} text="250+ Branches Nationwide" />
              <TrustBadge icon={CheckCircle} text="Fresh Daily, Never Frozen" />
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom gold accent line */}
        <div
          className="pointer-events-none"
          style={{
            position: 'absolute',
            bottom: 0,
            left: '10%',
            right: '10%',
            height: 1.5,
            background: `linear-gradient(90deg, transparent, ${GOLD}35, ${GOLD}70 50%, ${GOLD}35, transparent)`,
            opacity: 0.6,
            zIndex: 5,
          }}
          aria-hidden="true"
        />
      </section>

      {/* ── BRAND STORY SECTION ── */}
      <section style={{ background: BLACK, padding: 'clamp(60px, 8vw, 100px) 0' }}>
        <div className="wrap">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8, ease: easeOut }}
            style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center' }}
          >
            <motion.span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: `linear-gradient(135deg, ${GOLD}12 0%, ${GOLD}06 100%)`,
                border: `1px solid ${GOLD}30`,
                padding: '6px 14px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                color: GOLD_LIGHT,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 20,
              }}
            >
              Our Story
            </motion.span>

            <motion.h2
              style={{
                fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                lineHeight: 1.15,
                marginBottom: 20,
                fontFamily: 'Poppins, Inter, system-ui, sans-serif',
                color: BLOND,
              }}
            >
              Where Flavor Meets Craft
            </motion.h2>

            <motion.p
              style={{
                fontSize: 'clamp(1rem, 1.6vw, 1.125rem)',
                lineHeight: 1.8,
                color: 'rgba(245,240,232,0.75)',
                maxWidth: '600px',
                margin: '0 auto',
              }}
            >
              Every piece of chicken at The Crunch starts with a 24-hour brine, a secret spice rub
              passed down through generations, and a hand-glazed finish that caramelizes to perfection.
              Seven signature glazes. One unforgettable crunch.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <Footer />

      {/* ── FEEDBACK BUTTON ── */}
      <motion.button
        className="btn btn-gold"
        style={{
          position: 'fixed',
          bottom: 22,
          right: 22,
          zIndex: 90,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          borderRadius: 999,
          padding: '11px 18px',
          background: `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
          color: '#15120a',
          border: 'none',
          boxShadow: '0 4px 16px rgba(245,200,66,0.3)',
        }}
        onClick={() => setFeedbackOpen(v => !v)}
        whileHover={{ scale: 1.03, boxShadow: '0 8px 28px rgba(245,200,66,0.35)' }}
        whileTap={{ scale: 0.97 }}
      >
        <MessageSquare size={15} />{feedbackOpen ? 'Close' : 'Feedback'}
      </motion.button>

      {/* ── FEEDBACK MODAL ── */}
      <AnimatePresence>
        {feedbackOpen && (
          <>
            <div onClick={() => setFeedbackOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 900 }} />
            <motion.div
              role="dialog"
              aria-label="Send feedback"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              style={{
                position: 'fixed',
                zIndex: 901,
                right: 16,
                bottom: 80,
                width: 'min(400px, calc(100vw - 32px))',
                maxHeight: 'calc(100vh - 110px)',
                overflowY: 'auto',
                background: '#15130f',
                border: '1px solid var(--line)',
                borderRadius: 16,
                padding: 22,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 17, fontWeight: 700 }}>Send Feedback</p>
                  <p style={{ color: MUTED, fontSize: 12.5 }}>Tell us how we did.</p>
                </div>
                <button onClick={() => setFeedbackOpen(false)} aria-label="Close" style={{ background: 'none', border: 0, color: MUTED, cursor: 'pointer', height: 28 }}><X size={18} /></button>
              </div>
              <p style={{ color: MUTED, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                Feedback form connects to your existing backend. Configure the API endpoint in the FeedbackModal component.
              </p>
              <motion.button
                className="btn btn-gold"
                onClick={() => setFeedbackOpen(false)}
                whileTap={{ scale: 0.98 }}
                style={{ width: '100%', padding: 12, marginTop: 8 }}
              >
                Close
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}