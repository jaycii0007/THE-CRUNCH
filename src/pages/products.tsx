import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Star, X, MessageSquare, Send, CheckCircle, ShoppingBag, ArrowRight, Clock } from 'lucide-react'
import { api, resolveAssetUrl } from '@/lib/api'
import { fetchGeneralSettings } from '@/lib/restaurantSettings'
import { useAuth } from '@/context/authcontext'
import { Navbar } from '@/components/Navbar';

// ── Types & helpers ────────────────────────────────────────────────────────
const NAV_H = 72
const MAX_FB = 200
type Category = string

interface Product { id: number; name: string; category: Category; rating: number; badge: string; description: string; price: number; spicy: boolean; img: string; archived: boolean }

const normCat = (v: unknown): Category => String(v ?? '').trim()

const mapProducts = (data: unknown[]): Product[] =>
  data
    .filter((r: any) =>
      String(r?.product_type ?? r?.item_type ?? "menu_item").trim().toLowerCase() === "menu_item" &&
      String(r?.category_system_key ?? "").trim().toLowerCase() !== "chicken_flavors" &&
      !["chicken flavors", "chicken flavor", "chicken_flavors"].includes(normCat(r?.category).toLowerCase()))
    .map((r: any) => {
      const rawImage = String(r?.image ?? r?.img ?? '').trim();
      const resolvedImg = rawImage ? resolveAssetUrl(rawImage) : '';
      if (import.meta.env.DEV && rawImage) {
        console.log('[mapProducts]', {
          id: r?.id ?? r?.product_id,
          name: r?.name ?? r?.product_name,
          rawImage,
          resolvedImg,
        });
      }
      return {
        id: Number(r?.id ?? r?.product_id ?? 0),
        name: String(r?.name ?? r?.product_name ?? '').trim(),
        category: normCat(r?.category),
        rating: Number(r?.rating ?? 0),
        badge: String(r?.badge ?? '').trim(),
        description: String(r?.description ?? '').trim(),
        price: Number(r?.price ?? 0),
        spicy: Boolean(r?.spicy),
        img: resolvedImg,
        archived: String(r?.availability_status ?? r?.availabilityStatus ?? '').trim().toLowerCase() === 'hidden',
      };
    })
    .filter(p => p.id > 0 && p.name)

// ── Design Tokens ──────────────────────────────────────────────────────────
// THE CRUNCH Premium Color Palette (Approved) — Signature Glazed Hero uses Black/Gold
const BLACK = '#1A1A1A'
const GOLD = '#C9A84C'
const GOLD_DARK = '#B8953A'
const GOLD_LIGHT = '#E8D4A0'
const CREAM = '#F5F0E8'
const CHARCOAL = '#282823'
const GREY_FOG = '#595C56'
const BUTTER = '#E9BE5F'
const BLOND = '#F5E8B6'

// Legacy aliases for backward compatibility
const CARD_BG = BLACK
const BORDER = 'rgba(89,92,86,0.25)'
const TEXT = CREAM
const MUTED = 'rgba(245,240,232,0.58)'
const PAD = 'clamp(20px,5vw,64px)'

// Hero images for Signature Glazed Chicken
const HERO_IMAGE_1 = '/img/signatureglazed1.webp'
const HERO_IMAGE_2 = '/img/signatureglazed2.webp'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@700;800&display=swap');

/* Pencerio Font — Hairline (only available weight) */
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
  --pad:${PAD};
}
body{background:var(--bg)}
.pc{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
.pc button{font-family:inherit}
.pc :focus-visible{outline:2px solid var(--butter);outline-offset:2px}
.wrap{max-width:1440px;margin:0 auto;padding:0 var(--pad);width:100%}
.nav{position:fixed;top:0;left:0;right:0;z-index:100;height:${NAV_H}px;display:flex;align-items:center;transition:background .25s,border-color .25s,box-shadow .25s;border-bottom:1px solid transparent}
.nav.on{background:rgba(26,26,26,.92);backdrop-filter:blur(16px);border-bottom-color:var(--line);box-shadow:0 8px 30px rgba(0,0,0,.35)}
.nav-in{display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand{display:flex;align-items:center;gap:10px;background:none;border:0;cursor:pointer;color:var(--text);font-weight:800;font-size:18px;letter-spacing:-.02em}
.links{display:flex;align-items:center;gap:4px}
.link{background:none;border:0;color:var(--muted);font-size:14px;font-weight:500;padding:8px 14px;border-radius:8px;cursor:pointer;transition:color .15s,background .15s}
.link:hover{color:var(--text);background:rgba(245,232,182,.08)}
.btn{border:0;border-radius:10px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;transition:transform .15s,opacity .15s}
.btn:active{transform:scale(.97)}
.btn-gold{background:var(--butter);color:${CHARCOAL}}
.btn-ghost{background:transparent;color:var(--text);border:1px solid var(--line)}
.btn-ghost:hover{background:rgba(245,232,182,.08)}
.status{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:var(--muted);padding:0 4px}
.dot{width:7px;height:7px;border-radius:50%}
.burger{display:none;background:none;border:0;color:var(--text);cursor:pointer;padding:8px}

/* Products Grid — Compact, Responsive Catalog */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 18px;
  width: 100%;
}
@media (min-width: 1280px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 20px;
  }
}
@media (min-width: 768px) and (max-width: 1023px) {
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }
}
@media (min-width: 360px) and (max-width: 767px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
}
@media (max-width: 359px) {
  .grid {
    grid-template-columns: 1fr;
    gap: 12px;
    max-width: 320px;
    margin: 0 auto;
  }
}

/* Featured Menu — Responsive Poster Gallery */
.featured-menu-section {
  width: 100%;
  max-width: 1050px;
  margin: 0 auto;
  box-sizing: border-box;
}
.featured-menu-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-bottom: 24px;
}
.featured-menu-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  width: 100%;
  justify-content: center;
  justify-items: center;
  align-items: start;
  box-sizing: border-box;
}
.featured-menu-card {
  width: min(100%, 320px);
  max-width: 320px;
  border-radius: 14px;
  overflow: hidden;
  background: #1A1A1A;
  border: 1px solid rgba(201, 168, 76, 0.28);
  box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.65), 0 2px 6px -1px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  position: relative;
  transition: transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 300ms cubic-bezier(0.2, 0.8, 0.2, 1), border-color 300ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.featured-menu-card img {
  display: block;
  width: 100%;
  height: auto;
  max-width: 100%;
  max-height: 460px;
  object-fit: contain;
  object-position: center;
}

/* Tablet: 700px to 1099px — 2 columns, 3rd poster centered on row 2 */
@media (min-width: 700px) and (max-width: 1099px) {
  .featured-menu-grid {
    grid-template-columns: repeat(2, minmax(0, 300px));
    gap: 24px;
    justify-content: center;
    justify-items: center;
  }
  .featured-menu-card {
    width: 100%;
    max-width: 300px;
  }
  .featured-menu-card:nth-child(3) {
    grid-column: 1 / -1;
    justify-self: center;
  }
}

/* Desktop: 1100px and above — 3 columns in ONE centered row */
@media (min-width: 1100px) {
  .featured-menu-grid {
    grid-template-columns: repeat(3, minmax(260px, 300px));
    gap: 24px;
    justify-content: center;
    justify-items: center;
  }
  .featured-menu-card {
    width: 100%;
    max-width: 300px;
  }
  .featured-menu-card:nth-child(3) {
    grid-column: auto;
    justify-self: stretch;
  }
}

/* Desktop Hover */
@media (hover: hover) and (pointer: fine) {
  .featured-menu-card:hover {
    transform: translateY(-4px) scale(1.012);
    box-shadow: 0 16px 36px -6px rgba(0, 0, 0, 0.75), 0 0 18px 0 rgba(201, 168, 76, 0.22);
    border-color: rgba(201, 168, 76, 0.55);
  }
}

/* Accessibility: Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .featured-menu-card,
  .featured-menu-card:hover {
    transform: none !important;
    transition: none !important;
  }
}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;transition:border-color .2s,transform .2s;display:flex;flex-direction:column}
.card:hover{border-color:rgba(233,190,95,.45);transform:translateY(-4px)}
.thumb{position:relative;aspect-ratio:16/10;max-height:200px;background:#1f1d1a;overflow:hidden}
.thumb img{width:100%;height:100%;object-fit:cover;display:block}
.chip{font-size:10px;font-weight:600;padding:2px 8px;border-radius:999px;background:rgba(89,92,86,0.3);color:var(--muted)}
.chip-gold{background:var(--butter);color:${CHARCOAL}}
.tabs{position:sticky;top:${NAV_H}px;z-index:50;background:rgba(26,26,26,.96);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}
.tabs-in{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding: 6px 0}
.tabs-in::-webkit-scrollbar{display:none}
.tab{position:relative;background:none;border:0;padding:10px 18px;font-size:13.5px;font-weight:500;color:var(--muted);cursor:pointer;white-space:nowrap;border-radius:10px;transition:color 0.2s ease, background 0.2s ease}
.tab:hover{color:var(--text);background:rgba(245,232,182,.06)}
.tab.on{color:var(--butter);font-weight:600;background:rgba(233,190,95,.12)}
.tab.on::after{content:'';position:absolute;left:50%;transform:translateX(-50%);bottom:4px;width:20px;height:3px;background:var(--butter);border-radius:2px;box-shadow:0 0 12px var(--butter)}
@media (max-width: 600px){.tab{padding:8px 12px;font-size:12px}}
/* Section header improvements */
.section-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:20px}
.section-title{font-size:clamp(22px,3vw,30px);font-weight:800;letter-spacing:-0.025em;line-height:1.1;margin:0;color:var(--blond)}
.section-subtitle{color:var(--muted);font-size:clamp(12px,1.4vw,13.5px);line-height:1.5;margin:0}
.h2{font-size:clamp(24px,3.5vw,36px);font-weight:800;letter-spacing:-.025em;line-height:1.1;color:var(--blond)}
.sub{color:var(--muted);font-size:13px;line-height:1.5}
.section{margin-top:60px}
.skel{border-radius:14px;background:linear-gradient(90deg,${CHARCOAL},${GREY_FOG},${CHARCOAL});background-size:200% 100%;animation:sh 1.4s infinite}
.fixed-btn{position:fixed;bottom:22px;right:22px;z-index:90}
.input{width:100%;font:inherit;font-size:14px;color:var(--text);background:rgba(89,92,86,0.15);border:1px solid var(--line);border-radius:12px;padding:14px 18px;outline:none;transition:border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease}
.input:focus{border-color:rgba(233,190,95,0.5);background:rgba(89,92,86,0.2);box-shadow:0 0 0 4px rgba(233,190,95,0.15)}
.input option{color:#111}
@keyframes sh{to{background-position:-200% 0}}
@keyframes steamMorph{
  0%,100%{border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;transform:translateX(0) scaleY(1)}
  25%{border-radius:40% 60% 60% 40% / 50% 50% 50% 50%;transform:translateX(-4px) scaleY(1.05)}
  50%{border-radius:60% 40% 50% 50% / 40% 60% 50% 50%;transform:translateX(4px) scaleY(0.95)}
  75%{border-radius:50% 50% 40% 60% / 50% 50% 60% 40%;transform:translateX(-2px) scaleY(1.02)}
}
@keyframes pulse{
  0%,100%{opacity:1;transform:scale(1)}
  50%{opacity:0.6;transform:scale(0.9)}
}
@media(max-width:768px){.links,.status.hide-m{display:none}.burger{display:flex}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`

function Photo({ src, alt, priority = false, style, className }: { src?: string; alt: string; priority?: boolean; style?: React.CSSProperties; className?: string }) {
  const [bad, setBad] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setBad(false)
    setLoading(true)
  }, [src])

  const effectiveSrc = src;

  if (!effectiveSrc || bad) {
    return (
      <div
        className={className}
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--muted)',
          fontSize: 12,
          background: BLACK,
          ...style
        }}
        role="img"
        aria-label={`${alt} - image not available`}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 17" />
        </svg>
      </div>
    )
  }

  return (
    <>
      {loading && (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, #1A1A1A 25%, #1A1A1A 50%, #1A1A1A 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.4s infinite',
            position: 'absolute',
            inset: 0,
            zIndex: 1,
          }}
        />
      )}
      <img
        src={effectiveSrc}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        onError={(e) => {
          if (import.meta.env.DEV) {
            console.error('[Photo:error]', { alt, src: effectiveSrc, productId: (e.currentTarget as HTMLImageElement).dataset?.productId });
          }
          setBad(true);
          setLoading(false);
        }}
        onLoad={() => {
          if (import.meta.env.DEV) {
            console.log('[Photo:loaded]', { alt, src: effectiveSrc });
          }
          setLoading(false);
        }}
        className={className}
        data-product-id={alt}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: loading ? 0 : 1,
          transition: 'opacity 0.4s ease-out',
          ...style
        }}
      />
    </>
  )
}

// ── Animated Components ────────────────────────────────────────────────────
const easeOut = [0.16, 1, 0.3, 1] as const
const fadeUp = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOut } } }

// ── Hero Section: Signature Glazed Chicken — Premium Black & Gold ─────────────
function HeroSection() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  )
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    const checkReduceMotion = () => setReduceMotion(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
    checkMobile()
    checkReduceMotion()
    window.addEventListener('resize', checkMobile)
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    mq.addEventListener?.('change', checkReduceMotion)
    return () => {
      window.removeEventListener('resize', checkMobile)
      mq.removeEventListener?.('change', checkReduceMotion)
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isMobile || reduceMotion) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2
    setMousePos({ x, y })
  }, [isMobile, reduceMotion])

  const handleMouseLeave = useCallback(() => {
    if (isMobile || reduceMotion) return
    setMousePos({ x: 0, y: 0 })
  }, [isMobile, reduceMotion])

  // Mobile View (< 768px): Dedicated clean layout — zero overlapping, professional hierarchy
  if (isMobile) {
    return (
      <motion.section
        style={{
          position: 'relative',
          width: '100%',
          borderRadius: 20,
          overflow: 'hidden',
          background: BLACK,
          boxShadow: '0 24px 60px -15px rgba(0,0,0,0.85), 0 0 0 1px rgba(201,168,76,0.18)',
          isolation: 'isolate',
        }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: easeOut }}
      >
        {/* Base: Subtle gold radial glow */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse 90% 50% at 50% 15%, ${GOLD}18 0%, ${BLACK} 65%, #0a0a0a 100%)`,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Ambient gold rim light at top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '8%',
            right: '8%',
            height: '2px',
            background: `linear-gradient(90deg, transparent, ${GOLD}40 20%, ${GOLD}80 50%, ${GOLD}40 80%, transparent)`,
            pointerEvents: 'none',
            zIndex: 1,
            filter: 'blur(0.5px)',
          }}
        />

        {/* Background watermark typography — faint, non-intrusive */}
        <div
          style={{
            position: 'absolute',
            top: '5%',
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pointerEvents: 'none',
            zIndex: 1,
            overflow: 'hidden',
            opacity: 0.05,
            fontSize: 'clamp(56px, 16vw, 90px)',
            fontWeight: 900,
            lineHeight: 0.8,
            letterSpacing: '-0.04em',
            color: GOLD,
            transform: 'rotate(-2deg)',
            userSelect: 'none',
          }}
          aria-hidden="true"
        >
          <span>SIGNATURE</span>
          <span>GLAZED</span>
          <span>CHICKEN</span>
        </div>

        {/* Mobile Content Stack — Zero overlap, professional hierarchy */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            padding: 'clamp(18px, 4.5vw, 24px)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* 1. Premium Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5, ease: easeOut }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: `linear-gradient(135deg, ${GOLD}1A 0%, ${GOLD}08 100%)`,
              border: `1px solid ${GOLD}40`,
              padding: '7px 14px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              color: GOLD_LIGHT,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              width: 'fit-content',
              marginBottom: 14,
              boxShadow: `0 4px 16px -4px ${GOLD}20`,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: GOLD,
                animation: reduceMotion ? 'none' : 'pulse 2.2s infinite ease-in-out',
                boxShadow: `0 0 8px ${GOLD}`,
              }}
            />
            7 Signature Glazes
          </motion.div>

          {/* 2. Main Headline */}
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.6, ease: easeOut }}
            style={{
              fontSize: 'clamp(28px, 7.5vw, 38px)',
              fontWeight: 800,
              letterSpacing: '-0.035em',
              lineHeight: 1.05,
              marginBottom: 16,
              fontFamily: 'Inter, system-ui, sans-serif',
              textShadow: '0 2px 20px rgba(0,0,0,0.6)',
            }}
          >
            <span style={{ display: 'block', color: CREAM }}>SIGNATURE</span>
            <span style={{ display: 'block', color: GOLD, marginTop: '-0.02em' }}>GLAZED</span>
            <span
              style={{
                display: 'block',
                color: CREAM,
                opacity: 0.92,
                fontWeight: 700,
                fontSize: 'clamp(22px, 6vw, 30px)',
                marginTop: '-0.01em',
              }}
            >
              CHICKEN
            </span>
          </motion.h2>

          {/* 3. Hero Visual Showcase — Framed appetizing food presentation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35, duration: 0.7, ease: easeOut }}
            style={{
              position: 'relative',
              width: '100%',
              height: 'clamp(200px, 54vw, 260px)',
              borderRadius: 16,
              overflow: 'hidden',
              marginBottom: 18,
              border: `1px solid ${GOLD}40`,
              boxShadow: `0 16px 40px -10px rgba(0,0,0,0.9), 0 0 30px -8px ${GOLD}20`,
              background: '#0d0d0d',
            }}
          >
            <Photo
              src={HERO_IMAGE_1}
              alt="Signature glazed chicken - hero view"
              priority
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center 35%',
              }}
            />

            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(180deg, rgba(10,10,10,0.2) 0%, transparent 45%, rgba(10,10,10,0.7) 100%)',
                pointerEvents: 'none',
              }}
            />

            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 24,
                height: 24,
                borderTop: `2px solid ${GOLD}80`,
                borderLeft: `2px solid ${GOLD}80`,
                borderRadius: '16px 0 0 0',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 24,
                height: 24,
                borderTop: `2px solid ${GOLD}80`,
                borderRight: `2px solid ${GOLD}80`,
                borderRadius: '0 16px 0 0',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: 24,
                height: 24,
                borderBottom: `2px solid ${GOLD}50`,
                borderLeft: `2px solid ${GOLD}50`,
                borderRadius: '0 0 0 16px',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 24,
                height: 24,
                borderBottom: `2px solid ${GOLD}50`,
                borderRight: `2px solid ${GOLD}50`,
                borderRadius: '0 0 16px 0',
                pointerEvents: 'none',
              }}
            />

            <div
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                zIndex: 3,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(10,10,10,0.88)',
                border: `1px solid ${GOLD}50`,
                padding: '5px 11px',
                borderRadius: 999,
                fontSize: 10.5,
                fontWeight: 600,
                color: GOLD_LIGHT,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: GOLD,
                  boxShadow: `0 0 6px ${GOLD}`,
                }}
              />
              Hand-Glazed
            </div>

            <div
              style={{
                position: 'absolute',
                bottom: 10,
                right: 10,
                width: 'clamp(68px, 18vw, 84px)',
                height: 'clamp(52px, 14vw, 64px)',
                borderRadius: 8,
                overflow: 'hidden',
                border: `1.5px solid ${GOLD}60`,
                boxShadow: '0 8px 20px rgba(0,0,0,0.85)',
                zIndex: 3,
              }}
            >
              <Photo
                src={HERO_IMAGE_2}
                alt="Signature glazed chicken - supporting view"
                priority
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center',
                }}
              />
            </div>
          </motion.div>

          {/* 4. Supporting Description */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.6, ease: easeOut }}
            style={{
              fontSize: 'clamp(13.5px, 3.6vw, 15px)',
              fontWeight: 400,
              lineHeight: 1.6,
              color: 'rgba(245,240,232,0.85)',
              marginBottom: 18,
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            }}
          >
            Hand-crafted daily with our secret spice rubs. Choose from 7 signature glazes — each bite delivers the perfect crunch.
          </motion.p>

          {/* 5. Explore Menu CTA Button */}
          <motion.button
            style={{
              width: '100%',
              fontSize: 15,
              padding: '13px 22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              borderRadius: 14,
              background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
              color: BLACK,
              border: 'none',
              boxShadow: `0 8px 24px -4px ${GOLD}40, inset 0 1px 0 rgba(255,255,255,0.2)`,
              fontWeight: 600,
              letterSpacing: '0.015em',
              cursor: 'pointer',
              marginBottom: 18,
            }}
            whileTap={{ scale: 0.98 }}
            onClick={() => (window.location.href = '/usersmenu?showOrderModal=true')}
          >
            <ShoppingBag size={18} />
            <span>Explore Menu</span>
            <ArrowRight size={18} />
          </motion.button>

          {/* 6. Trust Badges */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              paddingTop: 16,
              borderTop: `1px solid ${GOLD}18`,
            }}
          >
            {[
              { icon: CheckCircle, text: '7 Signature Glazes' },
              { icon: CheckCircle, text: '250+ Branches Nationwide' },
              { icon: CheckCircle, text: 'Fresh Daily, Never Frozen' },
            ].map((badge) => (
              <div
                key={badge.text}
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
                <badge.icon size={13} color={GOLD} style={{ flexShrink: 0 }} />
                <span>{badge.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom gold accent line */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: '8%',
            right: '8%',
            height: '1px',
            background: `linear-gradient(90deg, transparent, ${GOLD}40, ${GOLD}70 50%, ${GOLD}40, transparent)`,
            opacity: 0.6,
            pointerEvents: 'none',
            zIndex: 5,
          }}
        />
      </motion.section>
    )
  }

  // Desktop View (>= 768px): Cinematic 3D magazine composition
  return (
    <motion.section
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: 28,
        overflow: 'hidden',
        background: BLACK,
        boxShadow: '0 40px 100px -30px rgba(0,0,0,0.8), 0 0 0 1px rgba(201,168,76,0.15)',
        isolation: 'isolate',
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: easeOut }}
    >
      <div
        style={{
          position: 'absolute',
          inset: -80,
          background: `radial-gradient(ellipse 70% 60% at 50% 35%, ${GOLD}1A 0%, ${BLACK} 55%, #0a0a0a 100%)`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '10%',
          right: '10%',
          height: '3px',
          background: `linear-gradient(90deg, transparent, ${GOLD}40 20%, ${GOLD}80 50%, ${GOLD}40 80%, transparent)`,
          pointerEvents: 'none',
          zIndex: 1,
          filter: 'blur(1px)',
        }}
      />

      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 1,
          overflow: 'hidden',
        }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 1.4, ease: easeOut }}
        aria-hidden="true"
      >
        <div
          style={{
            fontSize: 'clamp(120px, 16vw, 280px)',
            fontWeight: 900,
            lineHeight: 0.78,
            letterSpacing: '-0.045em',
            color: `${GOLD}0D`,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            transform: 'rotate(-2.5deg)',
            textShadow: `0 0 100px ${GOLD}15`,
            userSelect: 'none',
            fontFamily: 'Inter, system-ui, sans-serif',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <span style={{ opacity: 0.5 }}>SIGNATURE</span>
          <span style={{ opacity: 0.7, marginLeft: '0.12em' }}>GLAZED</span>
          <span style={{ opacity: 0.45, marginLeft: '0.08em' }}>CHICKEN</span>
        </div>
      </motion.div>

      <motion.div
        style={{
          position: 'absolute',
          top: '18%',
          right: '-15%',
          width: '130%',
          height: '1.5px',
          background: `linear-gradient(135deg, transparent 0%, ${GOLD}30 25%, ${GOLD}70 50%, ${GOLD}30 75%, transparent 100%)`,
          transform: 'rotate(-10deg)',
          transformOrigin: 'center',
          pointerEvents: 'none',
          zIndex: 2,
        }}
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.5, duration: 1.2, ease: easeOut }}
      />

      <motion.div
        style={{
          position: 'absolute',
          bottom: '5%',
          right: '3%',
          width: '32%',
          aspectRatio: '4/3',
          borderRadius: '18px 6px 18px 6px',
          overflow: 'hidden',
          zIndex: 3,
          boxShadow: `
            0 24px 64px -16px rgba(0,0,0,0.85),
            inset 0 1px 0 rgba(255,255,255,0.04),
            0 0 0 1px ${GOLD}20,
            0 0 40px -8px ${GOLD}10
          `,
          transform: reduceMotion ? 'none' : `perspective(1000px) rotateY(${mousePos.x * -2.5}deg) rotateX(${mousePos.y * 1.5}deg) translateZ(16px)`,
          transition: reduceMotion ? 'none' : 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        initial={{ opacity: 0, y: 50, scale: 0.93 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.6, duration: 1, ease: easeOut }}
      >
        <Photo
          src={HERO_IMAGE_2}
          alt="Signature glazed chicken - supporting view"
          priority
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            transform: 'scale(1.03)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at center, transparent 45%, rgba(26,26,26,0.7) 100%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'absolute', top: 12, left: 12, width: 28, height: 28, borderTop: `2px solid ${GOLD}60`, borderLeft: `2px solid ${GOLD}60`, borderRadius: '6px 0 0 0', pointerEvents: 'none', zIndex: 4 }} />
        <div style={{ position: 'absolute', bottom: 12, right: 12, width: 28, height: 28, borderBottom: `2px solid ${GOLD}40`, borderRight: `2px solid ${GOLD}40`, borderRadius: '0 0 0 6px', pointerEvents: 'none', zIndex: 4 }} />
      </motion.div>

      <motion.div
        style={{
          position: 'absolute',
          top: '10%',
          left: '7%',
          width: '50%',
          aspectRatio: '3/4',
          borderRadius: '22px 10px 22px 10px',
          overflow: 'hidden',
          zIndex: 4,
          boxShadow: `
            0 40px 100px -20px rgba(0,0,0,0.9),
            inset 0 1px 0 rgba(255,255,255,0.06),
            0 0 0 1.5px ${GOLD}35,
            0 0 80px -15px ${GOLD}20
          `,
          transform: reduceMotion ? 'none' : `perspective(1000px) rotateY(${mousePos.x * 3.5}deg) rotateX(${mousePos.y * -2.5}deg) translateZ(32px)`,
          transition: reduceMotion ? 'none' : 'transform 0.65s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        initial={{ opacity: 0, y: 40, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.35, duration: 1.1, ease: easeOut }}
      >
        <Photo
          src={HERO_IMAGE_1}
          alt="Signature glazed chicken - hero view"
          priority
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
            transform: 'scale(1.015)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '45%',
            background: 'linear-gradient(180deg, transparent 0%, rgba(26,26,26,0.35) 35%, rgba(10,10,10,0.98) 100%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '18%',
            background: 'linear-gradient(180deg, rgba(10,10,10,0.35) 0%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'absolute', top: 0, left: 0, width: 48, height: 48, borderTop: `2px solid ${GOLD}50`, borderLeft: `2px solid ${GOLD}50`, borderRadius: '22px 0 0 0', pointerEvents: 'none', zIndex: 5 }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: 48, height: 48, borderTop: `2px solid ${GOLD}50`, borderRight: `2px solid ${GOLD}50`, borderRadius: '0 22px 0 0', pointerEvents: 'none', zIndex: 5 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: 48, height: 48, borderBottom: `2px solid ${GOLD}30`, borderLeft: `2px solid ${GOLD}30`, borderRadius: '0 0 0 22px', pointerEvents: 'none', zIndex: 5 }} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 48, height: 48, borderBottom: `2px solid ${GOLD}30`, borderRight: `2px solid ${GOLD}30`, borderRadius: '0 0 22px 0', pointerEvents: 'none', zIndex: 5 }} />
        <motion.div
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            zIndex: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: `linear-gradient(135deg, rgba(26,26,26,0.95) 0%, rgba(10,10,10,0.98) 100%)`,
            border: `1px solid ${GOLD}40`,
            padding: '10px 16px',
            borderRadius: 999,
            fontSize: 'clamp(10px, 1.3vw, 12px)',
            fontWeight: 600,
            color: GOLD_LIGHT,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            backdropFilter: 'blur(16px)',
            boxShadow: `0 8px 32px -8px ${GOLD}25, inset 0 1px 0 rgba(255,255,255,0.03)`,
          }}
          initial={{ opacity: 0, y: -16, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.7, ease: easeOut }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD, animation: reduceMotion ? 'none' : 'pulse 2.2s infinite ease-in-out', boxShadow: `0 0 8px ${GOLD}` }} />
          Hand-Glazed
        </motion.div>
      </motion.div>

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          padding: 'clamp(48px, 9vw, 96px) clamp(28px, 6vw, 96px)',
          minHeight: 'clamp(480px, 70vw, 640px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}
      >
        <motion.div
          style={{
            maxWidth: '600px',
            transform: reduceMotion ? 'none' : `translateZ(80px) translateX(${mousePos.x * -12}px) translateY(${mousePos.y * -8}px)`,
            transition: reduceMotion ? 'none' : 'transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 1, ease: easeOut }}
        >
          <motion.span
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.85, duration: 0.7, ease: easeOut }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              background: `linear-gradient(135deg, ${GOLD}18 0%, ${GOLD}0A 100%)`,
              border: `1px solid ${GOLD}35`,
              padding: 'clamp(11px, 1.6vw, 13px) clamp(20px, 3.5vw, 28px)',
              borderRadius: 999,
              fontSize: 'clamp(11px, 1.7vw, 13px)',
              fontWeight: 600,
              color: GOLD_LIGHT,
              width: 'fit-content',
              marginBottom: 'clamp(18px, 3vw, 26px)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              backdropFilter: 'blur(16px)',
              boxShadow: `0 6px 32px -6px ${GOLD}20, inset 0 1px 0 rgba(255,255,255,0.02)`,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: GOLD, animation: reduceMotion ? 'none' : 'pulse 2.5s infinite ease-in-out', boxShadow: `0 0 12px ${GOLD}` }} />
            7 Signature Glazes
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.9, ease: easeOut }}
            style={{
              fontSize: 'clamp(38px, 7.5vw, 80px)',
              fontWeight: 800,
              letterSpacing: '-0.035em',
              lineHeight: 1.0,
              marginBottom: 'clamp(16px, 2.5vw, 24px)',
              fontFamily: 'Poppins, Inter, system-ui, sans-serif',
              textShadow: `0 4px 40px rgba(0,0,0,0.5)`,
            }}
          >
            <span style={{ display: 'block', color: CREAM, fontWeight: 800, letterSpacing: '-0.03em' }}>SIGNATURE</span>
            <span style={{ display: 'block', color: GOLD, marginTop: '-0.04em', fontWeight: 800, letterSpacing: '-0.03em' }}>GLAZED</span>
            <span style={{ display: 'block', color: CREAM, opacity: 0.92, fontWeight: 800, fontSize: 'clamp(30px, 6vw, 62px)', marginTop: '-0.015em', letterSpacing: '-0.03em' }}>CHICKEN</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.15, duration: 0.8, ease: easeOut }}
            style={{
              fontSize: 'clamp(13px, 1.8vw, 16px)',
              maxWidth: 480,
              marginBottom: 'clamp(20px, 3.5vw, 28px)',
              fontWeight: 500,
              lineHeight: 1.6,
              color: `rgba(245,240,232,0.85)`,
              textShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }}
          >
            Hand-crafted daily with our secret spice rubs. Choose from 7 signature glazes — each bite delivers the perfect crunch.
          </motion.p>

          <motion.button
            style={{
              fontSize: 'clamp(14px, 1.6vw, 15px)',
              padding: 'clamp(12px, 2vw, 14px) clamp(22px, 4vw, 28px)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              width: 'fit-content',
              borderRadius: 12,
              background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
              color: BLACK,
              border: 'none',
              boxShadow: `0 6px 24px -4px ${GOLD}40, inset 0 1px 0 rgba(255,255,255,0.15), 0 0 0 1px ${GOLD}25`,
              fontWeight: 600,
              letterSpacing: '0.01em',
              position: 'relative',
              overflow: 'hidden',
              transform: reduceMotion ? 'none' : `translateZ(100px) translateX(${mousePos.x * -18}px) translateY(${mousePos.y * -10}px)`,
              transition: reduceMotion ? 'none' : 'transform 0.7s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.2s ease, background 0.2s ease',
            }}
            whileHover={{
              y: -2,
              boxShadow: `0 12px 32px -6px ${GOLD}50, inset 0 1px 0 rgba(255,255,255,0.2), 0 0 0 1px ${GOLD}40`,
              background: `linear-gradient(135deg, ${GOLD_LIGHT} 0%, ${GOLD} 100%)`,
              transition: { duration: 0.2, ease: easeOut },
            }}
            whileTap={{ scale: 0.98, y: 0 }}
            onClick={() => window.location.href = '/usersmenu?showOrderModal=true'}
          >
            <ShoppingBag size={17} />
            <span>Explore Menu</span>
            <ArrowRight size={17} style={{ transition: 'transform 0.2s ease' }} />
          </motion.button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 0.7, ease: easeOut }}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'clamp(8px, 1.2vw, 12px)',
            marginTop: 'clamp(24px, 4vw, 32px)',
            paddingTop: 'clamp(16px, 3vw, 24px)',
            borderTop: `1px solid ${GOLD}18`,
          }}
        >
          {[
            { icon: CheckCircle, text: '7 Signature Glazes' },
            { icon: CheckCircle, text: '250+ Branches Nationwide' },
            { icon: CheckCircle, text: 'Fresh Daily, Never Frozen' },
          ].map((badge, i) => (
            <motion.span
              key={badge.text}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 1.35 + i * 0.12, duration: 0.55, ease: easeOut }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: 'clamp(8px, 1.2vw, 10px) clamp(12px, 2vw, 16px)',
                background: `rgba(26,26,26,0.8)`,
                border: `1px solid ${GOLD}25`,
                borderRadius: 999,
                fontSize: 'clamp(11px, 1.4vw, 12px)',
                fontWeight: 600,
                color: `rgba(245,240,232,0.8)`,
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(12px)',
                transition: 'border-color 0.25s ease, color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${GOLD}60`
                e.currentTarget.style.color = GOLD_LIGHT
                e.currentTarget.style.background = `rgba(201,168,76,0.12)`
                e.currentTarget.style.boxShadow = `0 0 24px -4px ${GOLD}25`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `${GOLD}25`
                e.currentTarget.style.color = `rgba(245,240,232,0.8)`
                e.currentTarget.style.background = `rgba(26,26,26,0.8)`
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <badge.icon size={14} color={GOLD} />
              {badge.text}
            </motion.span>
          ))}
        </motion.div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '10%',
          right: '10%',
          height: 1.5,
          background: `linear-gradient(90deg, transparent, ${GOLD}35, ${GOLD}70 50%, ${GOLD}35, transparent)`,
          opacity: 0.6,
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />
    </motion.section>
  )
}

// ── Our Story Section ──────────────────────────────────────────────────────
function OurStory() {
  return (
    <motion.section
      style={{
        padding: 'var(--section-py) var(--container-pad)',
        background: 'transparent',
        position: 'relative',
        zIndex: 1,
      }}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: easeOut }}
    >
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', textAlign: 'center' }}>
        <motion.span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 24px',
            fontSize: 'clamp(11px, 1.4vw, 13px)',
            fontWeight: 600,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--gold)',
            background: 'rgba(245,185,68,0.08)',
            border: '1px solid rgba(245,185,68,0.4)',
            borderRadius: '9999px',
            fontFamily: "'JetBrains Mono', monospace",
            marginBottom: 'clamp(20px, 3vw, 32px)',
          }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6, ease: easeOut }}
        >
          OUR STORY
        </motion.span>

        <motion.h2
          style={{
            fontSize: 'clamp(38px, 6vw, 64px)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: 'clamp(20px, 3vw, 32px)',
            fontFamily: 'Poppins, Inter, sans-serif',
            background: 'var(--gold-gradient)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
            textShadow: '0 0 40px rgba(245,185,68,0.2)',
          }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7, ease: easeOut }}
        >
          Where Flavor Meets Craft
        </motion.h2>

        <motion.p
          style={{
            fontSize: 'clamp(16px, 2vw, 20px)',
            lineHeight: 1.7,
            maxWidth: '46ch',
            margin: '0 auto',
            color: 'var(--muted)',
            fontWeight: 400,
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7, ease: easeOut }}
        >
          Every piece of chicken begins with a 24-hour brine, hand-dredged in our signature spice blend, and fried to a golden crunch. Then comes the glaze — seven recipes developed over years, each brushed on by hand so the flavor clings to every ridge. No shortcuts. No central kitchen shortcuts. Just honest work, fresh daily, across 250+ branches.
        </motion.p>
      </div>
    </motion.section>
  )
}

// ── Footer ─────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: 'transparent', borderTop: '1px solid rgba(245,185,68,0.15)', padding: '48px 0 32px', marginTop: 60, position: 'relative', zIndex: 1 }}>
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '0 var(--container-pad)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 28 }}>
          <div style={{ flex: '1 1 280px', minWidth: 240 }}>
            <p style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>The <span style={{ color: 'var(--gold)' }}>Crunch</span></p>
            <p style={{ marginTop: 6, fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>6 Falcon St., cor Dahlia Fairview,<br />Quezon City, Philippines</p>
            <a href="https://www.google.com/maps/place/The+Crunch+-+Fairview+Branch/@14.7002687,121.0662915,21z" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 13.5, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none', transition: 'opacity 200ms' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'} onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
              <MapPin size={14} />View on Google Maps
            </a>
          </div>
          <div style={{ flex: '1 1 180px', minWidth: 160, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>Follow us</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              <a href="https://www.instagram.com/thecrunchfairview" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'var(--gold)', transition: 'opacity 200ms', fontSize: 14 }} onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'} onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>Instagram</a>
              <a href="https://www.facebook.com/thecrunchfairview" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'var(--gold)', transition: 'opacity 200ms', fontSize: 14 }} onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'} onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>Facebook</a>
            </div>
          </div>
          <div style={{ flex: '1 1 200px', minWidth: 180, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <p style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={13} />Hours</p>
            <p style={{ marginTop: 6, fontSize: 13.5, textAlign: 'right', color: 'var(--text)', lineHeight: 1.6 }}>Mon–Fri: 10 AM – 10 PM<br />Sat–Sun: 11 AM – 8:30 PM</p>
          </div>
        </div>
        <p style={{ marginTop: 36, paddingTop: 18, borderTop: '1px solid rgba(245,185,68,0.15)', fontSize: 12, textAlign: 'center', color: 'var(--muted)' }}>© {new Date().getFullYear()} The Crunch Fairview. All rights reserved.</p>
      </div>
    </footer>
  )
}

// ── Feedback Modal (unchanged logic) ───────────────────────────────────────
function FeedbackModal({ onClose, options, userId }: { onClose: () => void; options: { id: number; name: string }[]; userId: number | null }) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [message, setMessage] = useState('')
  const [productId, setProductId] = useState<number | null>(options[0]?.id ?? null)
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [err, setErr] = useState('')
  const text = message.trim()
  const can = productId !== null && rating > 0 && text.length > 0 && text.length <= MAX_FB

  const submit = async () => {
    if (!can) return
    setStatus('sending'); setErr('')
    try {
      await api.post('/feedback', { product_id: productId, customer_user_id: userId, rating, comment: text })
      setStatus('done')
    } catch (e: any) {
      setErr(e?.message || 'Could not send your feedback. Try again.')
      setStatus('error')
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 900, pointerEvents: 'auto' }} />
      <motion.div role="dialog" aria-label="Send feedback" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
        style={{ position: 'fixed', zIndex: 901, right: 16, bottom: 80, width: 'min(400px,calc(100vw - 32px))', maxHeight: 'calc(100vh - 110px)', overflowY: 'auto', background: 'var(--bg)', border: '1px solid rgba(245,185,68,0.15)', borderRadius: 16, padding: 22, pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, pointerEvents: 'auto' }}>
          <div style={{ pointerEvents: 'auto' }}><p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Send feedback</p><p style={{ fontSize: 12.5, color: 'var(--muted)' }}>Tell us how we did.</p></div>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close" style={{ background: 'none', border: 0, color: 'var(--muted)', cursor: 'pointer', height: 28, pointerEvents: 'auto' }}><X size={18} /></button>
        </div>
        {status === 'done' ? (
          <div style={{ textAlign: 'center', padding: '20px 0', display: 'grid', gap: 10, justifyItems: 'center' }}>
            <CheckCircle size={38} color="#22c55e" />
            <p style={{ fontWeight: 700, color: 'var(--text)' }}>Feedback sent</p>
            <button className="btn-secondary" onClick={onClose}>Close</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <p style={{ fontSize: 12, marginBottom: 6, color: 'var(--muted)' }}>Rating</p>
              <div style={{ display: 'flex', gap: 4 }} onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)} style={{ background: 'none', border: 0, cursor: 'pointer', lineHeight: 0 }}>
                    <Star size={26} color={n <= (hover || rating) ? 'var(--gold)' : 'rgba(255,255,255,.25)'} fill={n <= (hover || rating) ? 'var(--gold)' : 'none'} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 12, marginBottom: 6, color: 'var(--muted)' }}>Product</p>
              <select style={{ width: '100%', font: 'inherit', fontSize: 14, color: 'var(--text)', background: 'rgba(245,185,68,0.05)', border: '1px solid rgba(245,185,68,0.15)', borderRadius: 12, padding: '14px 18px', outline: 'none' }} value={productId ?? ''} onChange={e => setProductId(+e.target.value || null)} disabled={!options.length || status === 'sending'}>
                {options.length === 0 ? <option value="">No products available</option> : options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <p style={{ fontSize: 12, marginBottom: 6, color: 'var(--muted)' }}>Comment</p>
              <textarea style={{ width: '100%', font: 'inherit', fontSize: 14, color: 'var(--text)', background: 'rgba(245,185,68,0.05)', border: '1px solid rgba(245,185,68,0.15)', borderRadius: 12, padding: '14px 18px', outline: 'none', resize: 'none', minHeight: 100 }} rows={4} maxLength={MAX_FB} value={message} onChange={e => setMessage(e.target.value)} placeholder="What did you like or dislike?" />
              <p style={{ fontSize: 11, textAlign: 'right', marginTop: 2, color: 'var(--muted)' }}>{message.length}/{MAX_FB}</p>
            </div>
            {status === 'error' && <p role="alert" style={{ fontSize: 12.5, color: '#f87171' }}>{err}</p>}
            <motion.button style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 12, opacity: can ? 1 : .45, cursor: can ? 'pointer' : 'not-allowed', background: 'var(--gold-gradient)', color: '#1A1208', border: 'none', borderRadius: 12, fontWeight: 600, fontSize: 14, boxShadow: '0 4px 16px rgba(245,185,66,0.3)' }} onClick={submit} disabled={!can || status === 'sending'} whileTap={{ scale: 0.98 }}>
              <Send size={14} />{status === 'sending' ? 'Sending…' : 'Send feedback'}
            </motion.button>
          </div>
        )}
      </motion.div>
    </>
  )
}

// ── Page Component ─────────────────────────────────────────────────────────
interface ProductsProps { isAuthenticated?: boolean }

export default function Products({ isAuthenticated = false }: ProductsProps) {
  const { user } = useAuth()

  const [products, setProducts] = useState<Product[]>([])
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const userId = isAuthenticated && user && Number(user.userId) > 0 ? Number(user.userId) : null

  useEffect(() => { void fetchGeneralSettings() }, [])

  useEffect(() => {
    let cancelled = false
    const load = <T,>(url: string, set: (d: T[]) => void, map?: (d: unknown[]) => T[]) =>
      api.get<unknown[]>(url)
        .then((d: unknown) => { if (!cancelled) { const r = Array.isArray(d) ? d : []; set(map ? map(r) : (r as T[])) } })
        .catch(() => { })
        .finally(() => { })
    load<Product>('/api/products?item_type=menu_item', setProducts, mapProducts)
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    api.get<unknown[]>('/api/products?item_type=menu_item')
      .then((d: unknown) => { if (!cancelled) { const r = Array.isArray(d) ? d : []; setProducts(mapProducts(r)) } })
      .catch(() => { })
      .finally(() => { })
    return () => { cancelled = true }
  }, [])

  const feedbackOptions = useMemo(() => products.filter(p => !p.archived).map(p => ({ id: p.id, name: p.name })), [products])

  return (
    <div className="pc" style={{ background: BLACK, minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <Navbar />

      {/* HERO SECTION — Signature Glazed Chicken: Premium Black & Gold */}
      <section style={{ paddingTop: NAV_H + 60, paddingBottom: 60, background: BLACK }}>
        <div className="wrap">
          <motion.div variants={fadeUp}>
            <HeroSection />
          </motion.div>
        </div>
      </section>

      {/* OUR STORY */}
      <OurStory />

      {/* FOOTER */}
      <Footer />

      {/* FEEDBACK */}
      <AnimatePresence>{feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} options={feedbackOptions} userId={userId} />}</AnimatePresence>
      <motion.button className="btn btn-gold fixed-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, borderRadius: 999, padding: '11px 18px', background: 'linear-gradient(180deg, var(--gold) 0%, var(--gold-dark) 100%)', color: '#15120a', border: 'none', boxShadow: '0 4px 16px rgba(245,200,66,0.3)' }} onClick={() => setFeedbackOpen(v => !v)} whileHover={{ scale: 1.03, boxShadow: '0 8px 28px rgba(245,200,66,0.35)' }} whileTap={{ scale: 0.97 }}>
        <MessageSquare size={15} />{feedbackOpen ? 'Close' : 'Feedback'}
      </motion.button>
    </div>
  )
}