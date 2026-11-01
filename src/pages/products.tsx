import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Flame, MapPin, Star, X, MessageSquare, Send, CheckCircle, Menu, User, ShoppingBag, ArrowRight, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useViewport } from '@/hooks/use-tablet'
import { api, resolveAssetUrl } from '@/lib/api'
import { fetchGeneralSettings, formatCurrencyAmount } from '@/lib/restaurantSettings'
import { useAuth } from '@/context/authcontext'

// ── Types & helpers ────────────────────────────────────────────────────────
const NAV_H = 64
const MAX_FB = 200
const CATEGORIES = ['All', 'Chicken', 'Sides', 'Drinks', 'Combos'] as const
type Category = (typeof CATEGORIES)[number]

interface Product { id: number; name: string; category: Category; rating: number; badge: string; description: string; price: number; spicy: boolean; img: string }
interface Flavor { name: string; accent: string; desc: string; img: string }
interface Promo { id: string; title: string; subtitle?: string; description: string; img: string; badge?: string; validUntil?: string; discount?: string; highlight?: boolean }

const fmt = (v: number) => formatCurrencyAmount(v)

const normCat = (v: unknown): Category => {
  const r = String(v ?? '').toLowerCase()
  if (r.includes('drink') || r.includes('beverage') || r.includes('soda')) return 'Drinks'
  if (r.includes('side')) return 'Sides'
  if (r.includes('combo')) return 'Combos'
  if (r.includes('chicken') || r.includes('rice meal') || r.includes('menu food')) return 'Chicken'
  return 'All'
}

const mapProducts = (data: unknown[]): Product[] =>
  data
    .map((r: any) => {
      const rawImage = String(r?.image ?? r?.img ?? '').trim();
      const resolvedImg = rawImage ? resolveAssetUrl(rawImage) : '';
      // Debug: log actual API image values for duplicate investigation
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
      };
    })
    .filter(p => p.id > 0 && p.name)

const timeLeft = (d?: string) => {
  if (!d) return null
  const diff = new Date(d).getTime() - Date.now()
  if (diff <= 0) return null
  const days = Math.floor(diff / 86400000)
  if (days > 30) return null
  return days > 0 ? `${days}d left` : `${Math.floor(diff / 3600000)}h left`
}

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
const HERO_IMAGE_1 = '/img/signatureglazed1.jpg'
const HERO_IMAGE_2 = '/img/signatureglazed2.jpg'

// Promotional images for featured strip (use ChatGPT images that are promotional)
const PROMO_IMAGES = [
  '/img/ChatGPT Image Sep 29, 2026, 05_21_28 PM.png',
  '/img/ChatGPT Image Sep 29, 2026, 05_33_26 PM.png',
  '/img/ChatGPT Image Sep 29, 2026, 05_37_12 PM.png',
  '/img/ChatGPT Image Sep 29, 2026, 05_37_39 PM.png',
  '/img/ChatGPT Image Sep 29, 2026, 05_45_42 PM.png',
  '/img/ChatGPT Image Sep 29, 2026, 05_46_01 PM.png',
  '/img/ChatGPT Image Sep 29, 2026, 05_50_11 PM.png',
  '/img/ChatGPT Image Sep 29, 2026, 05_51_46 PM.png',
  '/img/ChatGPT Image Sep 29, 2026, 05_53_39 PM.png',
]

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
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
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:28px}
@media (min-width: 1200px){.grid{grid-template-columns:repeat(auto-fill,minmax(380px,1fr))}}
@media (min-width: 1440px){.grid{grid-template-columns:repeat(auto-fill,minmax(400px,1fr))}}
@media (max-width: 1024px){.grid{grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:24px}}
@media (max-width: 768px){.grid{grid-template-columns:repeat(auto-fill,minmax(100%,1fr));gap:20px}}
@media (max-width: 480px){.grid{gap:16px}}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;transition:border-color .2s,transform .2s;display:flex;flex-direction:column}
.card:hover{border-color:rgba(233,190,95,.45);transform:translateY(-4px)}
.thumb{position:relative;aspect-ratio:4/3;background:#1f1d1a;overflow:hidden}
.thumb img{width:100%;height:100%;object-fit:cover;display:block}
.chip{font-size:11px;font-weight:600;padding:3px 10px;border-radius:999px;background:rgba(89,92,86,0.3);color:var(--muted)}
.chip-gold{background:var(--butter);color:${CHARCOAL}}
.tabs{position:sticky;top:${NAV_H}px;z-index:50;background:rgba(26,26,26,.96);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}
.tabs-in{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding: 8px 0}
.tabs-in::-webkit-scrollbar{display:none}
.tab{position:relative;background:none;border:0;padding:14px 20px;font-size:14px;font-weight:500;color:var(--muted);cursor:pointer;white-space:nowrap;border-radius:12px;transition:color 0.2s ease, background 0.2s ease}
.tab:hover{color:var(--text);background:rgba(245,232,182,.06)}
.tab.on{color:var(--butter);font-weight:600;background:rgba(233,190,95,.12)}
.tab.on::after{content:'';position:absolute;left:50%;transform:translateX(-50%);bottom:6px;width:24px;height:3px;background:var(--butter);border-radius:2px;box-shadow:0 0 12px var(--butter)}
/* Section header improvements */
.section-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12;margin-bottom:28}
.section-title{font-size:clamp(26px,4vw,36px);font-weight:800;letter-spacing:-0.025em;line-height:1.1;margin:0;color:var(--blond)}
.section-subtitle{color:var(--muted);font-size:clamp(13px,1.6vw,14px);line-height:1.6;margin:0}
.h2{font-size:clamp(28px,4vw,44px);font-weight:800;letter-spacing:-.025em;line-height:1.1;color:var(--blond)}
.sub{color:var(--muted);font-size:14px;line-height:1.6}
.section{margin-top:100px}
.skel{border-radius:16px;background:linear-gradient(90deg,${CHARCOAL},${GREY_FOG},${CHARCOAL});background-size:200% 100%;animation:sh 1.4s infinite}
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
@media(max-width:768px){.links,.status.hide-m{display:none}.burger{display:flex}.grid{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`

// Normalize product name for lookup (lowercase, remove special chars)
// Used by FoodPreviewGallery to match local images to products
function normalizeProductName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

// All verified local food images (for gallery)
const VERIFIED_LOCAL_FOOD_IMAGES = [
  { filename: 'chickenhoneygarlic.jpg', displayName: 'Honey Garlic Chicken', path: '/img/chickenhoneygarlic.jpg' },
  { filename: 'chickenteriyaki.jpg', displayName: 'Teriyaki Chicken', path: '/img/chickenteriyaki.jpg' },
  { filename: 'chickentexasbbq.jpg', displayName: 'Texas BBQ Chicken', path: '/img/chickentexasbbq.jpg' },
  { filename: 'chickenspicekstyle.jpg', displayName: 'Spicy K-Style Chicken', path: '/img/chickenspicekstyle.jpg' },
  { filename: 'chickenspecialcheese.jpg', displayName: 'Special Cheese Chicken', path: '/img/chickenspecialcheese.jpg' },
  { filename: 'chickengarlicparmesan.jpg', displayName: 'Garlic Parmesan Chicken', path: '/img/chickengarlicparmesan.jpg' },
  { filename: 'chickenskin.jpg', displayName: 'Chicken Skin', path: '/img/chickenskin.jpg' },
  { filename: 'chicken poppers 2.jpg', displayName: 'Chicken Poppers', path: '/img/chicken poppers 2.jpg' },
  { filename: 'chickchicken.png', displayName: 'Classic Fried Chicken', path: '/img/chickchicken.png' },
  { filename: 'chicken1.jpg', displayName: 'Signature Chicken', path: '/img/chicken1.jpg' },
] as const;

const Skel = ({ h }: { h: number }) => <div className="skel" style={{ height: h }} />

function Photo({ src, alt, priority = false, style, className }: { src?: string; alt: string; priority?: boolean; style?: React.CSSProperties; className?: string }) {
  const [bad, setBad] = useState(false)
  const [loading, setLoading] = useState(true)

  // Reset error state when src changes so a newly valid image can load
  useEffect(() => {
    setBad(false)
    setLoading(true)
  }, [src])

  // For preview gallery: use LOCAL_IMAGE_MAP as verified local fallback
  // For product cards: rely ONLY on API-provided image (src), no static fallback
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
      {/* Loading placeholder */}
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
const staggerContainer = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const fadeUp = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOut } } }
const fadeIn = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.5 } } }

// ── Cards ──────────────────────────────────────────────────────────────────
function ProductCard({ p, onOrder }: { p: Product; onOrder: () => void }) {
  return (
    <motion.article
      className="card"
      variants={fadeUp}
      whileHover={{
        y: -8,
        boxShadow: '0 24px 48px -12px rgba(0,0,0,0.4)',
        transition: { duration: 0.3, ease: easeOut },
      }}
      whileTap={{ scale: 0.99 }}
      layout
      style={{
        background: 'linear-gradient(180deg, rgba(19,17,16,0.98) 0%, rgba(11,10,8,0.98) 100%)',
        border: '1px solid var(--line)',
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Image container with proper aspect ratio to prevent layout shift */}
      <motion.div
        className="thumb"
        whileHover={{ opacity: 1 }}
        style={{
          aspectRatio: '4/3',
          background: BLACK,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Photo src={p.img} alt={p.name} priority={false} />

        {/* Gradient overlay for text readability on hover */}
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, transparent 55%, rgba(11,10,8,0.85) 100%)',
            opacity: 0,
            transition: 'opacity 0.3s ease',
          }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        />

        {/* Badge - top left */}
        {p.badge && (
          <span
            className="chip chip-gold"
            style={{
              position: 'absolute',
              top: 14,
              left: 14,
              zIndex: 2,
              fontSize: 11,
              fontWeight: 700,
              padding: '5px 12px',
              borderRadius: 9999,
              boxShadow: '0 4px 16px rgba(245,200,66,0.3)',
            }}
          >
            {p.badge}
          </span>
        )}

        {/* Spicy indicator - top right */}
        {p.spicy && (
          <span
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              zIndex: 2,
              background: 'rgba(0,0,0,0.7)',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'grid',
              placeItems: 'center',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
            aria-label="Spicy level"
          >
            <Flame size={16} color="#f87171" />
          </span>
        )}

        {/* Rating badge - bottom left on hover */}
        {p.rating > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.2 }}
            style={{
              position: 'absolute',
              bottom: 14,
              left: 14,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              background: 'rgba(11,10,8,0.9)',
              backdropFilter: 'blur(12px)',
              borderRadius: 9999,
              border: '1px solid rgba(245,200,66,0.3)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}
          >
            <Star size={13} fill="var(--gold)" color="var(--gold)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>{p.rating.toFixed(1)}</span>
          </motion.div>
        )}
      </motion.div>

      {/* Content area */}
      <div style={{
        padding: 'clamp(18px,3vw,24px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        flex: 1,
        minHeight: 160,
      }}>
        {/* Name & category */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <h3 style={{
            fontSize: 'clamp(17px,2.2vw,20px)',
            fontWeight: 700,
            lineHeight: 1.25,
            color: 'var(--text)',
            letterSpacing: '-0.015em',
            margin: 0,
          }}>
            {p.name}
          </h3>
        </div>

        {/* Description */}
        {p.description && (
          <p style={{
            fontSize: 'clamp(13px,1.6vw,14.5px)',
            lineHeight: 1.55,
            color: 'var(--muted)',
            margin: 0,
            flex: 1,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {p.description}
          </p>
        )}

        {/* Price & Order button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 'auto',
          paddingTop: 8,
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}>
          <span style={{
            fontSize: 'clamp(22px,2.8vw,26px)',
            fontWeight: 800,
            color: 'var(--text)',
            letterSpacing: '-0.02em',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            {fmt(p.price)}
          </span>
          <motion.button
            className="btn btn-gold"
            onClick={onOrder}
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.02, boxShadow: '0 8px 28px rgba(245,200,66,0.35)' }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 24px',
              fontSize: 'clamp(13px,1.6vw,14.5px)',
              fontWeight: 600,
              borderRadius: 12,
              background: 'linear-gradient(180deg, var(--gold) 0%, var(--gold-dark) 100%)',
              color: '#15120a',
              border: 'none',
              boxShadow: '0 4px 16px rgba(245,200,66,0.3)',
            }}
            aria-label={`Order ${p.name}`}
          >
            <ShoppingBag size={16} />
            <span>Order Now</span>
            <ArrowRight size={16} style={{ transition: 'transform 0.2s ease' }} />
          </motion.button>
        </div>
      </div>
    </motion.article>
  )
}

function PromoCard({ p }: { p: Promo }) {
  const left = timeLeft(p.validUntil)
  return (
    <motion.article
      className="card"
      variants={fadeUp}
      whileHover={{ y: -8, boxShadow: '0 24px 48px -12px rgba(0,0,0,0.4)', transition: { duration: 0.3, ease: easeOut } }}
      whileTap={{ scale: 0.99 }}
      style={{
        background: 'linear-gradient(180deg, rgba(19,17,16,0.98) 0%, rgba(11,10,8,0.98) 100%)',
        border: '1px solid var(--line)',
        borderRadius: 20,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ aspectRatio: '16/9', position: 'relative', overflow: 'hidden', background: '#1a1712' }}>
        <Photo src={p.img ? resolveAssetUrl(p.img) : ''} alt={p.title} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(11,10,8,0.95) 100%)' }} />
        {p.badge && <span className="chip chip-gold" style={{ position: 'absolute', top: 16, left: 16, fontSize: 12, padding: '6px 14px', fontWeight: 700, boxShadow: '0 4px 16px rgba(245,200,66,0.3)' }}>{p.badge}</span>}
        {p.discount && <span className="chip chip-gold" style={{ position: 'absolute', bottom: 16, right: 16, fontSize: 13, fontWeight: 700, padding: '6px 14px', boxShadow: '0 4px 16px rgba(245,200,66,0.3)' }}>{p.discount}</span>}
      </div>
      <div style={{ padding: 'clamp(20px,3vw,24px)', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        <h3 style={{ fontSize: 'clamp(18px,2.2vw,21px)', fontWeight: 700, lineHeight: 1.2, margin: 0, color: 'var(--text)' }}>{p.title}</h3>
        {p.subtitle && <p style={{ fontSize: 'clamp(13px,1.6vw,14.5px)', fontWeight: 500, color: 'var(--gold)', margin: 0 }}>{p.subtitle}</p>}
        <p className="sub" style={{ fontSize: 'clamp(13px,1.6vw,14.5px)', lineHeight: 1.55, flex: 1, margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</p>
        {left && <span className="chip" style={{ alignSelf: 'flex-start', marginTop: 4, color: '#f87171', fontSize: 11, fontWeight: 600 }}>{left}</span>}
        <motion.button className="btn btn-gold" style={{
          marginTop: 'auto',
          padding: '14px 24px',
          fontSize: 'clamp(13px,1.6vw,14.5px)',
          fontWeight: 600,
          borderRadius: 12,
          background: 'linear-gradient(180deg, var(--gold) 0%, var(--gold-dark) 100%)',
          color: '#15120a',
          border: 'none',
          boxShadow: '0 4px 16px rgba(245,200,66,0.3)',
          width: 'fit-content',
        }} whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.02, boxShadow: '0 8px 28px rgba(245,200,66,0.35)' }}>
          Order Now
        </motion.button>
      </div>
    </motion.article>
  )
}

// ── Hero Section: Signature Glazed Chicken — Premium Black & Gold ─────────────
function HeroSection() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isMobile, setIsMobile] = useState(false)
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
      {/* Base: Solid black with subtle gold radial glow */}
      <div
        style={{
          position: 'absolute',
          inset: -80,
          background: `radial-gradient(ellipse 70% 60% at 50% 35%, ${GOLD}1A 0%, ${BLACK} 55%, #0a0a0a 100%)`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Ambient gold rim light at top edge */}
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

      {/* Layer 1: Oversized background typography (editorial, subtle) */}
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

      {/* Layer 2: Diagonal gold accent line */}
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

      {/* Layer 3: Secondary image (supporting) - bottom right */}
      <motion.div
        style={{
          position: 'absolute',
          bottom: isMobile ? '8%' : '5%',
          right: isMobile ? '4%' : '3%',
          width: isMobile ? '48%' : '32%',
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
        {/* Vignette for depth */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at center, transparent 45%, rgba(26,26,26,0.7) 100%)',
            pointerEvents: 'none',
          }}
        />
        {/* Gold corner accents */}
        <div style={{ position: 'absolute', top: 12, left: 12, width: 28, height: 28, borderTop: `2px solid ${GOLD}60`, borderLeft: `2px solid ${GOLD}60`, borderRadius: '6px 0 0 0', pointerEvents: 'none', zIndex: 4 }} />
        <div style={{ position: 'absolute', bottom: 12, right: 12, width: 28, height: 28, borderBottom: `2px solid ${GOLD}40`, borderRight: `2px solid ${GOLD}40`, borderRadius: '0 0 0 6px', pointerEvents: 'none', zIndex: 4 }} />
      </motion.div>

      {/* Layer 4: Primary image (hero) - dominant, overlapping */}
      <motion.div
        style={{
          position: 'absolute',
          top: isMobile ? '6%' : '10%',
          left: isMobile ? '4%' : '7%',
          width: isMobile ? '72%' : '50%',
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
        {/* Bottom gradient fade for text legibility */}
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
        {/* Top subtle gradient for depth */}
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
        {/* Gold corner brackets - premium framing */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 48, height: 48, borderTop: `2px solid ${GOLD}50`, borderLeft: `2px solid ${GOLD}50`, borderRadius: '22px 0 0 0', pointerEvents: 'none', zIndex: 5 }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: 48, height: 48, borderTop: `2px solid ${GOLD}50`, borderRight: `2px solid ${GOLD}50`, borderRadius: '0 22px 0 0', pointerEvents: 'none', zIndex: 5 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: 48, height: 48, borderBottom: `2px solid ${GOLD}30`, borderLeft: `2px solid ${GOLD}30`, borderRadius: '0 0 0 22px', pointerEvents: 'none', zIndex: 5 }} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 48, height: 48, borderBottom: `2px solid ${GOLD}30`, borderRight: `2px solid ${GOLD}30`, borderRadius: '0 0 22px 0', pointerEvents: 'none', zIndex: 5 }} />
        {/* "Hand-Glazed" badge on image */}
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

      {/* Layer 5: 2D Smoke Effects - smooth looping cinematic smoke */}
      {!reduceMotion && (
        <>
          {SMOKE_LAYERS.map((layer) => (
            <SmokeLayer key={layer.id} {...layer} reduceMotion={reduceMotion} />
          ))}
        </>
      )}

      {/* Layer 6: Content - Text, CTA, Trust badges */}
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
            maxWidth: isMobile ? '100%' : '600px',
            transform: reduceMotion ? 'none' : `translateZ(80px) translateX(${mousePos.x * -12}px) translateY(${mousePos.y * -8}px)`,
            transition: reduceMotion ? 'none' : 'transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 1, ease: easeOut }}
        >
          {/* Premium badge pill */}
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

          {/* Main Headline - editorial split styling */}
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.9, ease: easeOut }}
            style={{
              fontSize: 'clamp(38px, 7.5vw, 80px)',
              fontWeight: 800,
              letterSpacing: '-0.035em',
              lineHeight: 1.0,
              marginBottom: 'clamp(14px, 2.5vw, 20px)',
              fontFamily: 'Inter, system-ui, sans-serif',
              textShadow: `0 4px 40px rgba(0,0,0,0.5)`,
            }}
          >
            <span style={{ display: 'block', color: CREAM }}>SIGNATURE</span>
            <span style={{ display: 'block', color: GOLD, marginTop: '-0.04em' }}>GLAZED</span>
            <span style={{ display: 'block', color: CREAM, opacity: 0.92, fontWeight: 700, fontSize: 'clamp(30px, 6vw, 62px)', marginTop: '-0.015em' }}>CHICKEN</span>
          </motion.h2>

          {/* Supporting description */}
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.15, duration: 0.8, ease: easeOut }}
            style={{
              fontSize: 'clamp(15px, 2.3vw, 20px)',
              maxWidth: 560,
              marginBottom: 'clamp(32px, 4.5vw, 42px)',
              fontWeight: 400,
              lineHeight: 1.75,
              color: `rgba(245,240,232,0.85)`,
              textShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }}
          >
            Hand-crafted daily with our secret spice rubs. Choose from 7 signature glazes — each bite delivers the perfect crunch.
          </motion.p>

          {/* Explore Menu CTA - Gold button */}
          <motion.button
            style={{
              fontSize: 'clamp(15px, 2vw, 17px)',
              padding: 'clamp(17px, 2.8vw, 20px) clamp(36px, 6vw, 54px)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 14,
              width: 'fit-content',
              borderRadius: 16,
              background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
              color: BLACK,
              border: 'none',
              boxShadow: `0 10px 40px -6px ${GOLD}45, inset 0 1px 0 rgba(255,255,255,0.18), 0 0 0 1px ${GOLD}30`,
              fontWeight: 600,
              letterSpacing: '0.015em',
              position: 'relative',
              overflow: 'hidden',
              transform: reduceMotion ? 'none' : `translateZ(100px) translateX(${mousePos.x * -18}px) translateY(${mousePos.y * -10}px)`,
              transition: reduceMotion ? 'none' : 'transform 0.7s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease, background 0.3s ease',
            }}
            whileHover={{
              scale: 1.035,
              boxShadow: `0 20px 56px -8px ${GOLD}55, inset 0 1px 0 rgba(255,255,255,0.22), 0 0 0 1px ${GOLD}50`,
              background: `linear-gradient(135deg, ${GOLD_LIGHT} 0%, ${GOLD} 100%)`,
              transition: { duration: 0.35, ease: easeOut },
            }}
            whileTap={{ scale: 0.97 }}
            onClick={() => window.location.href = '/usersmenu?showOrderModal=true'}
          >
            <ShoppingBag size={20} />
            <span>Explore Menu</span>
            <ArrowRight size={20} style={{ transition: 'transform 0.35s ease' }} />
          </motion.button>
        </motion.div>

        {/* Trust badges / pills - dark surfaces, gold borders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 0.7, ease: easeOut }}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'clamp(12px, 1.8vw, 16px)',
            marginTop: 'clamp(32px, 5vw, 44px)',
            paddingTop: 'clamp(22px, 4vw, 28px)',
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
                gap: 10,
                padding: 'clamp(11px, 1.6vw, 13px) clamp(18px, 3vw, 22px)',
                background: `rgba(26,26,26,0.8)`,
                border: `1px solid ${GOLD}25`,
                borderRadius: 999,
                fontSize: 'clamp(12px, 2vw, 14px)',
                fontWeight: 500,
                color: `rgba(245,240,232,0.8)`,
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(12px)',
                transition: 'border-color 0.35s ease, color 0.35s ease, background 0.35s ease, box-shadow 0.35s ease',
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
              <badge.icon size={16} color={GOLD} />
              {badge.text}
            </motion.span>
          ))}
        </motion.div>
      </div>

      {/* Bottom gold accent line */}
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

// ── Smoke Component (Realistic 2D Cinematic Smoke/Steam) ────────────────────────
// Organic, soft white-gray cloud layers that drift seamlessly
function SmokeLayer({
  id,
  startX,
  startY,
  driftX,
  driftY,
  scale,
  opacity,
  duration,
  delay,
  reduceMotion,
}: {
  id: number;
  startX: number;
  startY: number;
  driftX: number;
  driftY: number;
  scale: number;
  opacity: number;
  duration: number;
  delay: number;
  reduceMotion: boolean;
}) {
  if (reduceMotion) return null;

  // Pre-computed organic cloud shapes using CSS border-radius for soft plumes
  const shapes = [
    '45% 55% 60% 40% / 50% 60% 55% 45%',
    '55% 45% 50% 50% / 55% 50% 60% 40%',
    '40% 60% 55% 45% / 60% 55% 50% 50%',
    '50% 50% 45% 55% / 45% 55% 60% 40%',
  ];
  const shape = shapes[id % shapes.length];

  // Soft white-gray smoke colors
  const smokeColors = [
    'rgba(255,255,255,0.18)',  // Soft white
    'rgba(230,230,235,0.16)',  // Light gray-white
    'rgba(210,215,220,0.14)',  // Muted gray-white
    'rgba(200,205,210,0.12)',  // Subtle gray
  ];
  const baseColor = smokeColors[id % smokeColors.length];

  return (
    <motion.div
      style={{
        position: 'absolute',
        left: `${startX}%`,
        top: `${startY}%`,
        width: `clamp(80px, 14vw, 200px)`,
        height: `clamp(60px, 10vw, 160px)`,
        pointerEvents: 'none',
        zIndex: 3,
        transformOrigin: 'center center',
        willChange: 'transform, opacity',
      }}
      initial={false}
      animate={{
        opacity: [0, opacity, opacity * 0.7, opacity * 0.3, 0],
        y: [0, driftY * 0.3, driftY * 0.6, driftY * 0.85, driftY],
        x: [0, driftX * 0.25, driftX * 0.55, driftX * 0.8, driftX],
        scale: [scale * 0.5, scale * 0.85, scale * 1.1, scale * 1.25, scale * 1.35],
        rotate: [0, driftX * 0.3, driftX * -0.2, driftX * 0.15, 0],
        borderRadius: [shape, shape, shape, shape, shape],
      }}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94], // Custom easing for natural feel
        repeat: Infinity,
        repeatDelay: 0,
      }}
    >
      {/* Multi-layered plume for depth - each layer slightly offset */}
      {[0, 1, 2].map((layerIdx) => (
        <div
          key={layerIdx}
          style={{
            position: 'absolute',
            inset: `${layerIdx * 4}%`,
            background: `radial-gradient(ellipse 55% 50% at 50% 45%, ${baseColor} 0%, ${baseColor} 20%, ${baseColor.replace(/[\d.]+\)$/, '0)')} 70%, transparent 100%)`,
            borderRadius: shape,
            filter: `blur(${8 + layerIdx * 4}px)`,
            opacity: 1 - layerIdx * 0.15,
          }}
        />
      ))}
    </motion.div>
  );
}

// Smoke configuration - 4 layers with varied timing for seamless looping
const SMOKE_LAYERS = [
  { id: 0, startX: 18, startY: 85, driftX: -12, driftY: -140, scale: 1.15, opacity: 0.22, duration: 14, delay: 0 },
  { id: 1, startX: 75, startY: 88, driftX: 10, driftY: -160, scale: 0.95, opacity: 0.18, duration: 18, delay: 2.5 },
  { id: 2, startX: 45, startY: 90, driftX: -6, driftY: -130, scale: 1.05, opacity: 0.15, duration: 22, delay: 5 },
  { id: 3, startX: 60, startY: 82, driftX: 8, driftY: -150, scale: 0.85, opacity: 0.12, duration: 26, delay: 7.5 },
] as const;

// ── Vertical Advertisement Poster Component ──────────────────────────────────
function VerticalAdPoster({
  image,
  title,
  subtitle,
  description,
  badge,
  price,
  showPrice = true,
  accentColor = GOLD,
  bgWords = '',
}: {
  image: string;
  title: string;
  subtitle?: string;
  description: string;
  badge?: string;
  price?: string | number;
  showPrice?: boolean;
  accentColor?: string;
  bgWords?: string;
}) {
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile once on mount
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Generate background typography from title
  const bgTypography = bgWords || title.toUpperCase().split(' ').slice(0, 2).join(' ');

  return (
    <motion.article
      variants={fadeUp}
      style={{
        position: 'relative',
        borderRadius: 16,
        overflow: 'visible',
        background: BLACK,
        border: '1px solid var(--line)',
        boxShadow: '0 8px 32px -8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.02)',
        transformStyle: 'preserve-3d',
        transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.4s cubic-bezier(0.22, 1, 0.36, 1), z-index 0s',
        cursor: isMobile ? 'pointer' : 'default',
        aspectRatio: '3/4',
        isolation: 'isolate',
      }}
      whileHover={!isMobile ? {
        y: -8,
        z: 40,
        scale: 1.035,
        rotateX: -2,
        rotateY: 1.5,
        boxShadow: '0 32px 64px -16px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,200,66,0.2), 0 0 40px -8px rgba(245,200,66,0.12)',
        transition: { duration: 0.4, ease: easeOut },
        zIndex: 20,
      } : {}}
      whileTap={{ scale: 0.985, transition: { duration: 0.1 } }}
      initial={{ opacity: 0, y: 30, rotateX: -5 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.7, ease: easeOut }}
    >
      {/* Layer 1: Ambient background glow */}
      <div
        style={{
          position: 'absolute',
          inset: -40,
          background: `radial-gradient(ellipse at center, ${accentColor}15 0%, transparent 70%)`,
          pointerEvents: 'none',
          zIndex: 0,
          borderRadius: '20px',
        }}
      />

      {/* Layer 2: Oversized background typography */}
      <div
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
        aria-hidden="true"
      >
        <motion.span
          style={{
            fontSize: 'clamp(120px, 25vw, 280px)',
            fontWeight: 900,
            lineHeight: 0.85,
            letterSpacing: '-0.04em',
            color: 'rgba(245,200,66,0.035)',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            transform: 'rotate(-2deg)',
            textShadow: '0 0 80px rgba(245,200,66,0.08)',
            userSelect: 'none',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.8, ease: easeOut }}
        >
          {bgTypography}
        </motion.span>
      </div>

      {/* Layer 3: Full-bleed food photography - MAIN VISUAL */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          borderRadius: 16,
          zIndex: 2,
        }}
      >
        <Photo
          src={image}
          alt={title}
          priority={true}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
            transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />

        {/* Subtle vignette for depth */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(11,10,8,0.35) 100%)',
            pointerEvents: 'none',
            zIndex: 3,
          }}
        />

        {/* Bottom gradient fade for text legibility - taller to accommodate content */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '60%',
            background: 'linear-gradient(180deg, transparent 0%, rgba(11,10,8,0.4) 30%, rgba(11,10,8,0.85) 60%, rgba(11,10,8,0.98) 100%)',
            pointerEvents: 'none',
            zIndex: 4,
          }}
        />

        {/* Top subtle gradient for badge legibility */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '25%',
            background: 'linear-gradient(180deg, rgba(11,10,8,0.4) 0%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 4,
          }}
        />

        {/* Badge - floating top left */}
        {badge && (
          <motion.span
            className="chip chip-gold"
            style={{
              position: 'absolute',
              top: 18,
              left: 18,
              zIndex: 10,
              fontSize: 'clamp(10px, 1.2vw, 12px)',
              fontWeight: 700,
              padding: '7px 16px',
              borderRadius: 999,
              boxShadow: '0 8px 24px rgba(245,200,66,0.4), 0 0 0 1px rgba(245,200,66,0.25)',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
              backdropFilter: 'blur(8px)',
              background: 'linear-gradient(180deg, var(--gold) 0%, var(--gold-dark) 100%)',
              color: '#15120a',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.5, ease: easeOut }}
          >
            {badge}
          </motion.span>
        )}

        {/* Accent corner brackets */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 60,
            height: 60,
            borderTop: '2px solid rgba(245,200,66,0.25)',
            borderLeft: '2px solid rgba(245,200,66,0.25)',
            borderRadius: '16px 0 0 0',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 60,
            height: 60,
            borderTop: '2px solid rgba(245,200,66,0.25)',
            borderRight: '2px solid rgba(245,200,66,0.25)',
            borderRadius: '0 16px 0 0',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: 60,
            height: 60,
            borderBottom: '2px solid rgba(245,200,66,0.15)',
            borderLeft: '2px solid rgba(245,200,66,0.15)',
            borderRadius: '0 0 0 16px',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 60,
            height: 60,
            borderBottom: '2px solid rgba(245,200,66,0.15)',
            borderRight: '2px solid rgba(245,200,66,0.15)',
            borderRadius: '0 0 16px 0',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        />

        {/* Layer 4: Product information integrated into poster - Structured bottom panel */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 'clamp(18px, 3.5vw, 28px)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            minHeight: '55%',
            justifyContent: 'flex-end',
          }}
        >
          {/* Title - Large editorial style, clamped to 3 lines */}
          <h3
            style={{
              fontSize: 'clamp(18px, 3.5vw, 28px)',
              fontWeight: 800,
              lineHeight: 1.15,
              margin: 0,
              color: 'var(--text)',
              letterSpacing: '-0.02em',
              textShadow: '0 2px 24px rgba(0,0,0,0.5)',
              fontFamily: 'Inter, system-ui, sans-serif',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {title}
          </h3>

          {/* Subtitle - Supporting context */}
          {subtitle && (
            <motion.p
              style={{
                fontSize: 'clamp(11px, 1.2vw, 13px)',
                fontWeight: 600,
                color: 'var(--gold)',
                margin: '8px 0 0 0',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                textShadow: '0 1px 8px rgba(0,0,0,0.4)',
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4, ease: easeOut }}
            >
              {subtitle}
            </motion.p>
          )}

          {/* Description - When space permits, clamped to 2 lines */}
          {description && (
            <motion.p
              className="sub"
              style={{
                fontSize: 'clamp(11.5px, 1.2vw, 13px)',
                lineHeight: 1.5,
                margin: '6px 0 0 0',
                color: 'rgba(244,241,236,0.78)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textShadow: '0 1px 4px rgba(0,0,0,0.4)',
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4, ease: easeOut }}
            >
              {description}
            </motion.p>
          )}

          {/* Price - Integrated into composition, always on own line with proper spacing */}
          {showPrice && price && (
            <motion.div
              style={{
                marginTop: 'auto',
                paddingTop: 'clamp(12px, 2vw, 16px)',
                borderTop: '1px solid rgba(245,200,66,0.18)',
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 16,
                minHeight: '48px',
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4, ease: easeOut }}
            >
              <span
                style={{
                  fontSize: 'clamp(20px, 3.5vw, 30px)',
                  fontWeight: 800,
                  color: 'var(--gold)',
                  letterSpacing: '-0.015em',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  textShadow: '0 2px 16px rgba(245,200,66,0.25)',
                  flexShrink: 0,
                }}
              >
                {typeof price === 'number' ? `₱${price}` : price}
              </span>
              {/* Subtle gold accent line */}
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: 'linear-gradient(90deg, var(--gold) 0%, transparent 100%)',
                  opacity: 0.25,
                  minWidth: 40,
                }}
              />
            </motion.div>
          )}

          {/* Spacer for non-priced cards to maintain visual balance */}
          {!showPrice && (
            <div style={{ marginTop: 'auto', minHeight: '48px' }} />
          )}
        </div>
      </div>

      {/* Layer 5: Subtle golden rim light on hover (handled via whileHover box-shadow) */}
    </motion.article>
  )
}

// ── Featured Today — Premium Vertical Campaign Posters ──────────────────────
function FeaturedStrip() {
  const featuredPromos = [
    {
      img: PROMO_IMAGES[0],
      title: 'Family Bucket',
      subtitle: 'Perfect for sharing',
      desc: '8pc chicken + 2 large sides + 4 drinks',
      price: '₱699',
      badge: 'Best Value',
      accent: '#f5c842',
      bgWords: 'FAMILY BUCKET',
    },
    {
      img: PROMO_IMAGES[1],
      title: 'Spicy Challenge',
      subtitle: 'Dare to try',
      desc: 'Try our hottest glaze — free drink if you finish',
      price: '₱199',
      badge: 'New',
      accent: '#f87171',
      bgWords: 'SPICY CHALLENGE',
    },
    {
      img: PROMO_IMAGES[2],
      title: 'Lunch Combo',
      subtitle: 'Mon–Fri 11 AM – 2 PM',
      desc: '2pc chicken + rice + drink',
      price: '₱249',
      badge: 'Limited Time',
      accent: '#f5c842',
      bgWords: 'LUNCH COMBO',
    },
  ]

  return (
    <section style={{ marginTop: 80 }}>
      <motion.div variants={fadeUp}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
          <h2 className="h2" style={{ fontSize: 'clamp(28px,5vw,44px)' }}>Featured Today</h2>
          <p className="sub" style={{ maxWidth: 420 }}>Hand-picked specials crafted for maximum flavor</p>
        </div>
      </motion.div>
      <motion.div
        variants={staggerContainer}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))',
          gap: 'clamp(20px, 3vw, 28px)',
          perspective: '1200px',
        }}
      >
        {featuredPromos.map((promo) => (
          <VerticalAdPoster
            key={promo.title}
            image={promo.img}
            title={promo.title}
            subtitle={promo.subtitle}
            description={promo.desc}
            badge={promo.badge}
            price={promo.price}
            showPrice={true}
            accentColor={promo.accent}
            bgWords={promo.bgWords}
          />
        ))}
      </motion.div>
    </section>
  )
}

// ── Feedback Modal (unchanged functionality) ────────────────────────────────
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
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 900 }} />
      <motion.div role="dialog" aria-label="Send feedback" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
        style={{ position: 'fixed', zIndex: 901, right: 16, bottom: 80, width: 'min(400px,calc(100vw - 32px))', maxHeight: 'calc(100vh - 110px)', overflowY: 'auto', background: '#15130f', border: '1px solid var(--line)', borderRadius: 16, padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div><p style={{ fontSize: 17, fontWeight: 700 }}>Send feedback</p><p className="sub" style={{ fontSize: 12.5 }}>Tell us how we did.</p></div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 0, color: 'var(--muted)', cursor: 'pointer', height: 28 }}><X size={18} /></button>
        </div>
        {status === 'done' ? (
          <div style={{ textAlign: 'center', padding: '20px 0', display: 'grid', gap: 10, justifyItems: 'center' }}>
            <CheckCircle size={38} color="#22c55e" />
            <p style={{ fontWeight: 700 }}>Feedback sent</p>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <p className="sub" style={{ fontSize: 12, marginBottom: 6 }}>Rating</p>
              <div style={{ display: 'flex', gap: 4 }} onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)} style={{ background: 'none', border: 0, cursor: 'pointer', lineHeight: 0 }}>
                    <Star size={26} color={n <= (hover || rating) ? '#f5c842' : 'rgba(255,255,255,.25)'} fill={n <= (hover || rating) ? '#f5c842' : 'none'} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="sub" style={{ fontSize: 12, marginBottom: 6 }}>Product</p>
              <select className="input" value={productId ?? ''} onChange={e => setProductId(+e.target.value || null)} disabled={!options.length || status === 'sending'}>
                {options.length === 0 ? <option value="">No products available</option> : options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <p className="sub" style={{ fontSize: 12, marginBottom: 6 }}>Comment</p>
              <textarea className="input" rows={4} maxLength={MAX_FB} value={message} onChange={e => setMessage(e.target.value)} placeholder="What did you like or dislike?" style={{ resize: 'none' }} />
              <p className="sub" style={{ fontSize: 11, textAlign: 'right', marginTop: 2 }}>{message.length}/{MAX_FB}</p>
            </div>
            {status === 'error' && <p role="alert" style={{ fontSize: 12.5, color: '#f87171' }}>{err}</p>}
            <motion.button className="btn btn-gold" onClick={submit} disabled={!can || status === 'sending'} whileTap={{ scale: 0.98 }} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 12, opacity: can ? 1 : .45, cursor: can ? 'pointer' : 'not-allowed' }}>
              <Send size={14} />{status === 'sending' ? 'Sending…' : 'Send feedback'}
            </motion.button>
          </div>
        )}
      </motion.div>
    </>
  )
}

// ── Food Preview Gallery — Vertical Food Advertisement Posters ───────────────
// Displays verified local food images as premium vertical campaign posters.
// Images with matching products show price; preview-only items show no price.
function FoodPreviewGallery({ products }: { products: Product[] }) {
  const { isMobile, isTablet, isCompactDesktop } = useViewport()

  // Accent color mapping for each food item to give each poster its own character
  const accentMap: Record<string, string> = {
    'Honey Garlic Chicken': '#f5c842',
    'Teriyaki Chicken': '#fbbf24',
    'Texas BBQ Chicken': '#fb923c',
    'Spicy K-Style Chicken': '#f87171',
    'Special Cheese Chicken': '#fde047',
    'Garlic Parmesan Chicken': '#f5c842',
    'Chicken Skin': '#d9aa2b',
    'Chicken Poppers': '#fbbf24',
    'Classic Fried Chicken': '#f5c842',
    'Signature Chicken': '#fde047',
  };

  const galleryItems = VERIFIED_LOCAL_FOOD_IMAGES.map(item => {
    const normalized = normalizeProductName(item.displayName);
    const matchedProduct = products.find(p => normalizeProductName(p.name) === normalized);
    return {
      ...item,
      hasProduct: !!matchedProduct,
      product: matchedProduct,
      accent: accentMap[item.displayName] || '#f5c842',
    };
  });

  // Responsive column count based on viewport
  // isMobile: < 768px, isTablet: < 1024px, isCompactDesktop: < 1280px
  const getColumns = () => {
    if (isMobile) return 1
    if (isTablet) return 2
    if (isCompactDesktop) return 4
    return 5
  }

  return (
    <motion.section className="section" variants={staggerContainer} style={{ marginTop: 80, background: BLACK }}>
      <div className="section-header" style={{ maxWidth: 1280, margin: '0 auto 28px', padding: '0 24px' }}>
        <motion.h2 className="section-title" variants={fadeUp}>Food Preview Gallery</motion.h2>
        <motion.p className="section-subtitle" variants={fadeUp}>
          Verified food photography from our kitchen. Prices shown where available — visit Our Menu to order.
        </motion.p>
      </div>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
        <motion.div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${getColumns()}, 1fr)`,
            gap: 'clamp(18px, 2vw, 24px)',
            perspective: '1200px',
          }}
          variants={staggerContainer}
          role="list"
        >
          {galleryItems.map((item) => (
            <VerticalAdPoster
              key={item.filename}
              image={item.path}
              title={item.displayName}
              subtitle={item.hasProduct ? 'Available to order' : 'Preview only'}
              description={item.hasProduct && item.product
                ? item.product.description || 'Hand-crafted with our signature spices.'
                : 'This item is not currently on the menu. Ask our staff about availability.'}
              badge={item.hasProduct ? 'On Menu' : 'Preview'}
              price={item.hasProduct && item.product ? fmt(item.product.price) : undefined}
              showPrice={item.hasProduct}
              accentColor={item.accent}
              bgWords={item.displayName.toUpperCase().split(' ').slice(0, 2).join(' ')}
            />
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
interface ProductsProps { isAuthenticated?: boolean; onLogout?: () => void }

export default function Products({ isAuthenticated = false, onLogout }: ProductsProps) {
  const navigate = useNavigate()
  const { isPhone } = useViewport()
  const { user } = useAuth()

  const [products, setProducts] = useState<Product[]>([])
  const [_flavors, setFlavors] = useState<Flavor[]>([])
  const [promos, setPromos] = useState<Promo[]>([])
  const [loading, setLoading] = useState({ p: true, f: true, r: true })
  const [category, setCategory] = useState<Category>('All')
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const userId = isAuthenticated && user && Number(user.userId) > 0 ? Number(user.userId) : null

  useEffect(() => { void fetchGeneralSettings() }, [])

  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'products-css'
    el.innerHTML = CSS
    document.head.appendChild(el)
    return () => el.remove()
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const check = () => {
      const n = new Date(), d = n.getDay(), t = n.getHours() + n.getMinutes() / 60
      setIsOpen((d >= 1 && d <= 5 && t >= 10 && t < 22) || ((d === 0 || d === 6) && t >= 11 && t < 20.5))
    }
    check()
    const id = setInterval(check, 60000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = <T,>(url: string, key: 'p' | 'f' | 'r', set: (d: T[]) => void, map?: (d: unknown[]) => T[]) =>
      api.get<unknown[]>(url)
        .then((d: unknown) => { if (!cancelled) { const r = Array.isArray(d) ? d : []; set(map ? map(r) : (r as T[])) } })
        .catch(() => { })
        .finally(() => { if (!cancelled) setLoading(s => ({ ...s, [key]: false })) })
    load<Product>('/api/products?item_type=menu_item', 'p', setProducts, mapProducts)
    load<Flavor>('/api/flavors', 'f', setFlavors)
    load<Promo>('/api/promos', 'r', setPromos)
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(
    () => products.filter(p => (category === 'All' || p.category === category) && p.name.toLowerCase().includes(search.toLowerCase())),
    [products, category, search]
  )
  const feedbackOptions = useMemo(() => products.map(p => ({ id: p.id, name: p.name })), [products])

  const goOrder = useCallback(() => navigate('/usersmenu?showOrderModal=true'), [navigate])
  const logout = useCallback(() => { onLogout?.(); navigate('/') }, [onLogout, navigate])
  const navLinks = [
    { label: 'Home', action: () => navigate('/') },
    { label: 'Menu', action: goOrder },
    { label: 'About', action: () => navigate('/aboutthecrunch') },
  ]
  const featured = promos.filter(p => p.highlight)
  const regular = promos.filter(p => !p.highlight)

  return (
    <div className="pc">
      {/* NAVBAR — fixed, always visible while scrolling */}
      <motion.header
        className={`nav ${scrolled || menuOpen ? 'on' : ''}`}
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: easeOut }}
      >
        <div className="wrap nav-in">
          <button className="brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top">
            <img src="/img/logo24.png" alt="" width={32} height={32} style={{ objectFit: 'contain' }} />
            {!isPhone && <span>The <span style={{ color: 'var(--gold)' }}>Crunch</span></span>}
          </button>

          <nav className="links" aria-label="Main">
            <span className="status" title="Store hours: Mon–Fri 10 AM–10 PM, Sat–Sun 11 AM–8:30 PM">
              <span className="dot" style={{ background: isOpen ? '#22c55e' : '#ef4444' }} />
              {isOpen ? 'Open now' : 'Closed'}
            </span>
            {navLinks.map(l => <button key={l.label} className="link" onClick={l.action}>{l.label}</button>)}
            <span style={{ width: 1, height: 18, background: 'var(--line)', margin: '0 8px' }} />
            {isAuthenticated ? (
              <>
                {user?.username && (
                  <button className="status" onClick={() => navigate('/my-account')} title="Open My Account">
                    <User size={14} />{user.username}
                  </button>
                )}
                <button className="btn btn-gold" onClick={logout}>Log out</button>
              </>
            ) : (
              <>
                <button className="btn btn-ghost" onClick={() => navigate('/login')}>Log in</button>
                <button className="btn btn-gold" style={{ marginLeft: 8 }} onClick={() => navigate('/login?tab=signup')}>Sign up</button>
              </>
            )}
          </nav>

          <button className="burger" onClick={() => setMenuOpen(v => !v)} aria-label="Toggle menu" aria-expanded={menuOpen}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .2 }}
              style={{ position: 'absolute', top: NAV_H, left: 0, right: 0, background: 'rgba(11,10,8,.98)', borderBottom: '1px solid var(--line)', padding: '8px var(--pad) 18px', display: 'grid', gap: 4 }}>
              {navLinks.map(l => <button key={l.label} className="link" style={{ textAlign: 'left', fontSize: 15 }} onClick={() => { l.action(); setMenuOpen(false) }}>{l.label}</button>)}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {isAuthenticated ? (
                  <>
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { navigate('/my-account'); setMenuOpen(false) }}>My Account</button>
                    <button className="btn btn-gold" style={{ flex: 1 }} onClick={() => { logout(); setMenuOpen(false) }}>Log out</button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { navigate('/login'); setMenuOpen(false) }}>Log in</button>
                    <button className="btn btn-gold" style={{ flex: 1 }} onClick={() => { navigate('/login?tab=signup'); setMenuOpen(false) }}>Sign up</button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* HERO SECTION — Signature Glazed Chicken: Premium Black & Gold */}
      <section style={{ paddingTop: NAV_H + 60, paddingBottom: 60, background: BLACK }}>
        <div className="wrap">
          <motion.div variants={fadeUp}>
            <HeroSection />
          </motion.div>

          {/* Search Bar */}
          <motion.div variants={fadeUp} style={{ marginTop: 40 }}>
            <div style={{ position: 'relative', maxWidth: 560 }}>
              <Search size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                className="input"
                style={{ paddingLeft: 48, paddingRight: 48, fontSize: 15, height: 52 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search chicken, sides, drinks, combos..."
                aria-label="Search the menu"
              />
              {search && <button onClick={() => setSearch('')} aria-label="Clear search" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, color: 'var(--muted)', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>}
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOD PREVIEW GALLERY - Moved up to appear after Hero */}
      <FoodPreviewGallery products={products} />

      {/* FEATURED STRIP */}
      <motion.section variants={staggerContainer} style={{ padding: '0 var(--pad) 60px', background: BLACK }}>
        <div className="wrap">
          <FeaturedStrip />
        </div>
      </motion.section>

      {/* CATEGORY TABS */}
      <div className="tabs">
        <div className="wrap tabs-in" role="tablist">
          {CATEGORIES.map(c => (
            <motion.button
              key={c}
              role="tab"
              aria-selected={category === c}
              className={`tab ${category === c ? 'on' : ''}`}
              onClick={() => setCategory(c)}
              whileTap={{ scale: 0.97 }}
              variants={fadeIn}
            >
              {c}
            </motion.button>
          ))}
        </div>
      </div>

      <motion.main className="wrap" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ paddingTop: 40, paddingBottom: 120, background: BLACK }}>
        {/* PRODUCTS GRID */}
        <motion.section variants={staggerContainer} style={{ background: BLACK }}>
          <div className="section-header">
            <motion.h2 className="section-title" variants={fadeUp}>Our Menu</motion.h2>
            <motion.p className="section-subtitle" variants={fadeUp}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</motion.p>
          </div>

          {loading.p ? (
            <div className="grid" role="status" aria-label="Loading products">
              {Array.from({ length: 6 }).map((_, _idx) => <motion.div key={_idx} variants={fadeUp}><Skel h={400} /></motion.div>)}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div variants={fadeIn} style={{ textAlign: 'center', padding: '80px 0' }}>
              <p style={{ fontSize: 18, fontWeight: 700 }}>No items found</p>
              <p className="sub" style={{ marginTop: 4 }}>Try a different search or category.</p>
              {search && <motion.button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => setSearch('')} whileTap={{ scale: 0.97 }}>Clear search</motion.button>}
            </motion.div>
          ) : (
            <motion.div className="grid" role="list" variants={staggerContainer}>
              {filtered.map((p) => (
                <motion.div key={p.id} variants={fadeUp} style={{ display: 'flex', flexDirection: 'column' }} role="listitem">
                  <ProductCard p={p} onOrder={goOrder} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.section>

        {/* PROMOS */}
        {!loading.r && promos.length > 0 && (
          <motion.section className="section" variants={staggerContainer} style={{ background: BLACK }}>
            <div className="section-header">
              <motion.h2 className="section-title" variants={fadeUp}>Deals & Promos</motion.h2>
              <motion.p className="section-subtitle" variants={fadeUp}>Current offers and limited-time specials.</motion.p>
            </div>
            <motion.div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,340px),1fr))' }} variants={staggerContainer} role="list">
              {[...featured, ...regular].map(p => (
                <motion.div key={p.id} variants={fadeUp} role="listitem">
                  <PromoCard p={p} />
                </motion.div>
              ))}
            </motion.div>
          </motion.section>
        )}

      </motion.main>

      {/* FOOTER */}
      <footer style={{ background: BLACK, borderTop: '1px solid var(--line)', padding: '48px 0 32px', marginTop: 60 }}>
        <div className="wrap">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 28 }}>
            <div>
              <p style={{ fontWeight: 800, fontSize: 18 }}>The <span style={{ color: 'var(--gold)' }}>Crunch</span></p>
              <p className="sub" style={{ marginTop: 6, fontSize: 13.5 }}>6 Falcon St., cor Dahlia Fairview,<br />Quezon City, Philippines</p>
              <a href="https://www.google.com/maps/place/The+Crunch+-+Fairview+Branch/@14.7002687,121.0662915,21z" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 13.5, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none' }}>
                <MapPin size={14} />View on Google Maps
              </a>
            </div>
            <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
              <p className="sub" style={{ fontSize: 12 }}>Follow us</p>
              <a className="link" style={{ padding: 0, textDecoration: 'none' }} href="https://www.instagram.com/thecrunchfairview" target="_blank" rel="noopener noreferrer">Instagram</a>
              <a className="link" style={{ padding: 0, textDecoration: 'none' }} href="https://www.facebook.com/thecrunchfairview" target="_blank" rel="noopener noreferrer">Facebook</a>
            </div>
            <div>
              <p className="sub" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={13} />Hours</p>
              <p className="sub" style={{ marginTop: 6, fontSize: 13.5 }}>Mon–Fri: 10 AM – 10 PM<br />Sat–Sun: 11 AM – 8:30 PM</p>
            </div>
          </div>
          <p className="sub" style={{ marginTop: 36, paddingTop: 18, borderTop: '1px solid var(--line)', fontSize: 12, textAlign: 'center' }}>© {new Date().getFullYear()} The Crunch Fairview. All rights reserved.</p>
        </div>
      </footer>

      {/* FEEDBACK */}
      <AnimatePresence>{feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} options={feedbackOptions} userId={userId} />}</AnimatePresence>
      <motion.button className="btn btn-gold fixed-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, borderRadius: 999, padding: '11px 18px', boxShadow: '0 6px 24px rgba(0,0,0,.4)' }} onClick={() => setFeedbackOpen(v => !v)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
        <MessageSquare size={15} />{feedbackOpen ? 'Close' : 'Feedback'}
      </motion.button>
    </div>
  )
}
