import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Flame, ChevronDown, MapPin, Star, X, MessageSquare, Send, CheckCircle, Menu, User, ShoppingBag, ArrowRight, Clock } from 'lucide-react'
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
interface MenuItem { name: string; price: number; tag?: string; img?: string }
interface MenuSection { id: string; title: string; subtext?: string; items: MenuItem[] }
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
const GOLD = '#f5c842'
const GOLD_DARK = '#d9aa2b'
const BG = '#0b0a08'
const CARD_BG = '#131110'
const BORDER = 'rgba(255,255,255,.08)'
const TEXT = '#f4f1ec'
const MUTED = 'rgba(244,241,236,.58)'
const PAD = 'clamp(20px,5vw,64px)' // Wider side padding for desktop

// Hero image - use crunch22.png (pure photography, no embedded text)
const HERO_IMAGE = '/img/crunch22.png'

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
  --gold:${GOLD};
  --gold-dark:${GOLD_DARK};
  --bg:${BG};
  --card:${CARD_BG};
  --line:${BORDER};
  --text:${TEXT};
  --muted:${MUTED};
  --pad:${PAD};
}
body{background:var(--bg)}
.pc{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
.pc button{font-family:inherit}
.pc :focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.wrap{max-width:1440px;margin:0 auto;padding:0 var(--pad);width:100%}
.nav{position:fixed;top:0;left:0;right:0;z-index:100;height:${NAV_H}px;display:flex;align-items:center;transition:background .25s,border-color .25s,box-shadow .25s;border-bottom:1px solid transparent}
.nav.on{background:rgba(11,10,8,.92);backdrop-filter:blur(16px);border-bottom-color:var(--line);box-shadow:0 8px 30px rgba(0,0,0,.35)}
.nav-in{display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand{display:flex;align-items:center;gap:10px;background:none;border:0;cursor:pointer;color:var(--text);font-weight:800;font-size:18px;letter-spacing:-.02em}
.links{display:flex;align-items:center;gap:4px}
.link{background:none;border:0;color:var(--muted);font-size:14px;font-weight:500;padding:8px 14px;border-radius:8px;cursor:pointer;transition:color .15s,background .15s}
.link:hover{color:var(--text);background:rgba(255,255,255,.05)}
.btn{border:0;border-radius:10px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;transition:transform .15s,opacity .15s}
.btn:active{transform:scale(.97)}
.btn-gold{background:var(--gold);color:#15120a}
.btn-ghost{background:transparent;color:var(--text);border:1px solid var(--line)}
.btn-ghost:hover{background:rgba(255,255,255,.05)}
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
.card:hover{border-color:rgba(245,200,66,.35);transform:translateY(-4px)}
.thumb{position:relative;aspect-ratio:4/3;background:#1a1712;overflow:hidden}
.thumb img{width:100%;height:100%;object-fit:cover;display:block}
.chip{font-size:11px;font-weight:600;padding:3px 10px;border-radius:999px;background:rgba(255,255,255,.06);color:var(--muted)}
.chip-gold{background:var(--gold);color:#15120a}
.tabs{position:sticky;top:${NAV_H}px;z-index:50;background:rgba(11,10,8,.96);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}
.tabs-in{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding: 8px 0}
.tabs-in::-webkit-scrollbar{display:none}
.tab{position:relative;background:none;border:0;padding:14px 20px;font-size:14px;font-weight:500;color:var(--muted);cursor:pointer;white-space:nowrap;border-radius:12px;transition:color 0.2s ease, background 0.2s ease}
.tab:hover{color:var(--text);background:rgba(255,255,255,0.04)}
.tab.on{color:var(--gold);font-weight:600;background:rgba(245,200,66,0.1)}
.tab.on::after{content:'';position:absolute;left:50%;transform:translateX(-50%);bottom:6px;width:24px;height:3px;background:var(--gold);border-radius:2px;box-shadow:0 0 12px var(--gold)}
/* Section header improvements */
.section-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12;margin-bottom:28}
.section-title{font-size:clamp(26px,4vw,36px);font-weight:800;letter-spacing:-0.025em;line-height:1.1;margin:0}
.section-subtitle{color:var(--muted);font-size:clamp(13px,1.6vw,14px);line-height:1.6;margin:0}
.h2{font-size:clamp(28px,4vw,44px);font-weight:800;letter-spacing:-.025em;line-height:1.1}
.sub{color:var(--muted);font-size:14px;line-height:1.6}
.section{margin-top:100px}
.skel{border-radius:16px;background:linear-gradient(90deg,#141210,#1c1915,#141210);background-size:200% 100%;animation:sh 1.4s infinite}
.fixed-btn{position:fixed;bottom:22px;right:22px;z-index:90}
.input{width:100%;font:inherit;font-size:14px;color:var(--text);background:rgba(255,255,255,0.04);border:1px solid var(--line);border-radius:12px;padding:14px 18px;outline:none;transition:border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease}
.input:focus{border-color:rgba(245,200,66,0.5);background:rgba(255,255,255,0.06);box-shadow:0 0 0 4px rgba(245,200,66,0.15)}
.input option{color:#111}
@keyframes sh{to{background-position:-200% 0}}
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
          background: '#1a1712',
          ...style
        }}
        role="img"
        aria-label={`${alt} - image not available`}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 17"/>
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
            background: 'linear-gradient(90deg, #141210 25%, #1c1915 50%, #141210 75%)',
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
const scaleIn = { hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: easeOut } } }

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
          background: '#1a1712',
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

function FlavorCard({ f, open, onToggle }: { f: Flavor; open: boolean; onToggle: () => void }) {
  return (
    <motion.div
      style={{ gridColumn: open ? 'span 2' : 'span 1' }}
      variants={scaleIn}
      animate={open ? 'show' : 'hidden'}
      transition={{ duration: 0.3, ease: easeOut }}
    >
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'var(--card)',
          color: 'var(--text)',
          border: `1px solid ${open ? f.accent || 'var(--gold)' : 'var(--line)'}`,
          borderRadius: open ? '16px 16px 0 0' : 16,
          cursor: 'pointer',
          fontSize: 'clamp(14px,1.8vw,15px)',
          fontWeight: 600,
          transition: 'border-color 0.2s ease, background 0.2s ease',
        }}
      >
        {f.name}
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={18} style={{ color: open ? f.accent || 'var(--gold)' : 'var(--muted)' }} />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: easeOut }}
            style={{
              border: `1px solid ${f.accent || 'var(--gold)'}`,
              borderTop: 0,
              borderRadius: '0 0 16px 16px',
              overflow: 'hidden',
              background: 'var(--card)',
              boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.03)',
            }}
          >
            <div className="thumb" style={{ aspectRatio: '16/9', background: '#1a1712' }}>
              <Photo src={f.img ? resolveAssetUrl(f.img) : ''} alt={f.name} />
            </div>
            {f.desc && <p className="sub" style={{ padding: 20, fontSize: 'clamp(13px,1.6vw,14.5px)', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function MenuCard({ s }: { s: MenuSection }) {
  return (
    <motion.div className="card" variants={fadeUp} style={{
      padding: 'clamp(20px,3vw,28px)',
      background: 'linear-gradient(180deg, rgba(19,17,16,0.98) 0%, rgba(11,10,8,0.98) 100%)',
      border: '1px solid var(--line)',
      borderRadius: 20,
      boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ fontSize: 'clamp(19px,2.4vw,22px)', fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.02em' }}>{s.title}</h3>
      </div>
      {s.subtext && <p className="sub" style={{ fontSize: 'clamp(13px,1.6vw,14px)', marginTop: 4, marginBottom: 16, color: 'var(--muted)' }}>{s.subtext}</p>}
      <div style={{ marginTop: 8 }}>
        {s.items.map(it => (
          <div key={`${s.id}-${it.name}-${it.price}`} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '16px 0',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            transition: 'background 0.2s ease',
            borderRadius: 12,
            margin: '0 -8px',
            paddingLeft: 8,
            paddingRight: 8,
          }}>
            {it.img && (
              <div className="thumb" style={{
                width: 56,
                height: 56,
                aspectRatio: '1',
                borderRadius: 12,
                flexShrink: 0,
                overflow: 'hidden',
                background: '#1a1712',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              }}>
                <Photo src={resolveAssetUrl(it.img)} alt={it.name} />
              </div>
            )}
            <span style={{ flex: 1, fontSize: 'clamp(14px,1.8vw,15.5px)', color: 'var(--text)', fontWeight: 500 }}>
              {it.name}
              {it.tag && <span className="chip chip-gold" style={{ marginLeft: 10, fontSize: 10.5, fontWeight: 600, padding: '4px 10px' }}>{it.tag}</span>}
            </span>
            <span style={{ fontWeight: 700, fontSize: 'clamp(15px,1.9vw,17px)', color: 'var(--gold)', whiteSpace: 'nowrap' }}>{fmt(it.price)}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ── Hero Section ──────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section style={{ position: 'relative', width: '100%', borderRadius: 28, overflow: 'hidden', background: '#1a1712', boxShadow: '0 20px 60px -20px rgba(0,0,0,0.5)' }}>
      {/* Background image with gradient overlay */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <div style={{ width: '100%', height: '100%' }}>
          <Photo src={HERO_IMAGE} alt="The Crunch - Golden Boneless Fried Chicken" priority />
        </div>
        {/* Dark gradient overlay - covers full height for text readability */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(11,10,8,0.9) 0%, rgba(11,10,8,0.6) 40%, rgba(11,10,8,0.35) 65%, rgba(11,10,8,0.9) 100%)' }} />
        {/* Subtle gold accent line */}
        <div style={{ position: 'absolute', bottom: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg, transparent, var(--gold), transparent)', opacity: 0.3 }} />
      </div>

      {/* Content - Flexbox layout, responsive */}
      <div style={{ position: 'relative', zIndex: 2, padding: 'clamp(40px,7vw,72px) clamp(24px,5vw,72px)', display: 'flex', flexDirection: 'column', minHeight: 'clamp(320px,60vw,480px)' }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: easeOut }}
          style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.4, ease: easeOut }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(245,200,66,0.15)', border: '1px solid rgba(245,200,66,0.3)', padding: 'clamp(10px,1.5vw,12px) clamp(18px,3vw,24px)', borderRadius: 999, fontSize: 'clamp(12px,2vw,14px)', fontWeight: 600, color: 'var(--gold)', width: 'fit-content', marginBottom: 'clamp(16px,2.5vw,24px)', letterSpacing: '0.02em' }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', animation: 'pulse 2s infinite', boxShadow: '0 0 12px var(--gold)' }} />
            Limited Time Offer
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6, ease: easeOut }}
            style={{ fontSize: 'clamp(32px,6vw,64px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: 'clamp(16px,2.5vw,20px)', color: 'var(--text)', fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            Signature Glazed Chicken
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.6, ease: easeOut }}
            className="sub"
            style={{ fontSize: 'clamp(15px,2.5vw,19px)', maxWidth: 520, marginBottom: 'clamp(24px,3.5vw,32px)', fontWeight: 400, lineHeight: 1.7 }}
          >
            Hand-crafted daily with our secret spice rubs. Choose from 7 signature glazes — each bite delivers the perfect crunch.
          </motion.p>
          <motion.button
            className="btn btn-gold"
            style={{ fontSize: 'clamp(15px,2vw,16px)', padding: 'clamp(16px,2.5vw,18px) clamp(28px,4vw,40px)', display: 'inline-flex', alignItems: 'center', gap: 12, width: 'fit-content', borderRadius: 14, background: 'linear-gradient(180deg, var(--gold) 0%, var(--gold-dark) 100%)', color: '#15120a', border: 'none', boxShadow: '0 6px 24px rgba(245,200,66,0.4)', fontWeight: 600 }}
            whileHover={{ scale: 1.03, boxShadow: '0 12px 40px rgba(245,200,66,0.5)' }}
            whileTap={{ scale: 0.97 }}
          >
            <ShoppingBag size={20} /> Explore Menu <ArrowRight size={20} />
          </motion.button>
        </motion.div>

        {/* Trust badges - positioned below content, flex wrap for mobile */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5, ease: easeOut }}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(10px,1.5vw,14px)', marginTop: 'clamp(24px,4vw,32px)', paddingTop: 'clamp(20px,3.5vw,24px)', borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: 'clamp(10px,1.5vw,12px) clamp(16px,2.5vw,20px)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)', borderRadius: 999, fontSize: 'clamp(12px,2vw,14px)', fontWeight: 500, color: 'var(--muted)', whiteSpace: 'nowrap', transition: 'border-color 0.2s ease, color 0.2s ease' }}>
            <CheckCircle size={16} color="var(--gold)" /> 7 Signature Glazes
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: 'clamp(10px,1.5vw,12px) clamp(16px,2.5vw,20px)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)', borderRadius: 999, fontSize: 'clamp(12px,2vw,14px)', fontWeight: 500, color: 'var(--muted)', whiteSpace: 'nowrap', transition: 'border-color 0.2s ease, color 0.2s ease' }}>
            <CheckCircle size={16} color="var(--gold)" /> 250+ Branches Nationwide
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: 'clamp(10px,1.5vw,12px) clamp(16px,2.5vw,20px)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)', borderRadius: 999, fontSize: 'clamp(12px,2vw,14px)', fontWeight: 500, color: 'var(--muted)', whiteSpace: 'nowrap', transition: 'border-color 0.2s ease, color 0.2s ease' }}>
            <CheckCircle size={16} color="var(--gold)" /> Fresh Daily, Never Frozen
          </span>
        </motion.div>
      </div>
    </section>
  )
}

// ── Featured Promo Strip ───────────────────────────────────────────────────
function FeaturedStrip() {
  const featuredPromos = [
    { img: PROMO_IMAGES[0], title: 'Family Bucket', desc: '8pc chicken + 2 large sides + 4 drinks', price: '₱699', badge: 'Best Value' },
    { img: PROMO_IMAGES[1], title: 'Spicy Challenge', desc: 'Try our hottest glaze — free drink if you finish', price: '₱199', badge: 'New' },
    { img: PROMO_IMAGES[2], title: 'Lunch Combo', desc: '2pc chicken + rice + drink', price: '₱249', badge: 'Mon–Fri 11–2' },
  ]

  return (
    <section style={{ marginTop: 80 }}>
      <motion.div variants={fadeUp}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
          <h2 className="h2" style={{ fontSize: 'clamp(26px,4vw,36px)' }}>Featured Today</h2>
        </div>
      </motion.div>
      <motion.div
        variants={staggerContainer}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 24 }}
      >
        {featuredPromos.map((promo) => (
          <motion.article
            key={promo.title}
            variants={fadeUp}
            style={{
              position: 'relative',
              borderRadius: 20,
              overflow: 'hidden',
              background: 'linear-gradient(180deg, rgba(19,17,16,0.98) 0%, rgba(11,10,8,0.98) 100%)',
              border: '1px solid var(--line)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            }}
            whileHover={{ y: -8, boxShadow: '0 24px 48px -12px rgba(0,0,0,0.4)', transition: { duration: 0.3, ease: easeOut } }}
            whileTap={{ scale: 0.99 }}
          >
            <div style={{ aspectRatio: '16/9', position: 'relative', overflow: 'hidden' }}>
              <Photo src={promo.img} alt={promo.title} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 35%, rgba(11,10,8,0.95) 100%)' }} />
              <span className="chip chip-gold" style={{ position: 'absolute', top: 16, left: 16, fontSize: 12, padding: '7px 16px', fontWeight: 700, borderRadius: 999, boxShadow: '0 4px 16px rgba(245,200,66,0.35)' }}>{promo.badge}</span>
            </div>
            <div style={{ padding: 'clamp(20px,3vw,28px)', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              <h3 style={{ fontSize: 'clamp(19px,2.2vw,22px)', fontWeight: 700, margin: 0, color: 'var(--text)', lineHeight: 1.25 }}>{promo.title}</h3>
              <p className="sub" style={{ fontSize: 'clamp(13px,1.6vw,14.5px)', lineHeight: 1.55, margin: 0, flex: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{promo.desc}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: 'clamp(22px,2.8vw,26px)', fontWeight: 800, color: 'var(--gold)', letterSpacing: '-0.02em' }}>{promo.price}</span>
                <motion.button className="btn btn-gold" style={{
                  padding: '14px 24px',
                  fontSize: 'clamp(13px,1.6vw,14.5px)',
                  fontWeight: 600,
                  borderRadius: 12,
                  background: 'linear-gradient(180deg, var(--gold) 0%, var(--gold-dark) 100%)',
                  color: '#15120a',
                  border: 'none',
                  boxShadow: '0 4px 16px rgba(245,200,66,0.3)',
                }} whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.02, boxShadow: '0 8px 28px rgba(245,200,66,0.35)' }}>
                  Order Now
                </motion.button>
              </div>
            </div>
          </motion.article>
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

// ── Food Preview Gallery ─────────────────────────────────────────────────────
// Displays verified local food images. Images with matching products show price & Order Now.
// Images without products are shown as preview only (no price, no Order Now).
function FoodPreviewGallery({ products }: { products: Product[] }) {
  const galleryItems = VERIFIED_LOCAL_FOOD_IMAGES.map(item => {
    const normalized = normalizeProductName(item.displayName);
    const matchedProduct = products.find(p => normalizeProductName(p.name) === normalized);
    return {
      ...item,
      hasProduct: !!matchedProduct,
      product: matchedProduct,
    };
  });

  return (
    <motion.section className="section" variants={staggerContainer} style={{ marginTop: 80 }}>
      <div className="section-header">
        <motion.h2 className="section-title" variants={fadeUp}>Food Preview Gallery</motion.h2>
        <motion.p className="section-subtitle" variants={fadeUp}>
          Verified food photography from our kitchen. Items with prices are available to order.
        </motion.p>
      </div>
      <motion.div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))',
          gap: 24
        }}
        variants={staggerContainer}
        role="list"
      >
        {galleryItems.map((item) => (
          <motion.article
            key={item.filename}
            variants={fadeUp}
            role="listitem"
            style={{
              background: 'linear-gradient(180deg, rgba(19,17,16,0.98) 0%, rgba(11,10,8,0.98) 100%)',
              border: '1px solid var(--line)',
              borderRadius: 20,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            whileHover={{ y: -8, boxShadow: '0 24px 48px -12px rgba(0,0,0,0.4)', transition: { duration: 0.3, ease: easeOut } }}
            whileTap={{ scale: 0.99 }}
          >
            <div style={{ aspectRatio: '4/3', position: 'relative', overflow: 'hidden', background: '#1a1712' }}>
              <Photo src={item.path} alt={item.displayName} priority={false} />
              {!item.hasProduct && (
                <span style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: 'rgba(245,200,66,0.9)',
                  color: '#15120a',
                  padding: '4px 10px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  boxShadow: '0 4px 16px rgba(245,200,66,0.3)',
                }}>
                  Preview Only
                </span>
              )}
            </div>
            <div style={{ padding: 'clamp(16px,2vw,20px)', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              <h3 style={{ fontSize: 'clamp(16px,2vw,18px)', fontWeight: 700, margin: 0, color: 'var(--text)', lineHeight: 1.25 }}>
                {item.displayName}
              </h3>
              {item.hasProduct && item.product && (
                <>
                  <p className="sub" style={{ fontSize: 'clamp(13px,1.5vw,14px)', lineHeight: 1.5, margin: 0, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {item.product.description || 'Hand-crafted with our signature spices.'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: 'clamp(20px,2.5vw,24px)', fontWeight: 800, color: 'var(--gold)', letterSpacing: '-0.02em' }}>
                      {fmt(item.product.price)}
                    </span>
                    <motion.button className="btn btn-gold" style={{
                      padding: '12px 20px',
                      fontSize: 'clamp(12px,1.5vw,13.5px)',
                      fontWeight: 600,
                      borderRadius: 10,
                      background: 'linear-gradient(180deg, var(--gold) 0%, var(--gold-dark) 100%)',
                      color: '#15120a',
                      border: 'none',
                      boxShadow: '0 4px 16px rgba(245,200,66,0.3)',
                    }} whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.02, boxShadow: '0 8px 28px rgba(245,200,66,0.35)' }}>
                      Order Now
                    </motion.button>
                  </div>
                </>
              )}
              {!item.hasProduct && (
                <p className="sub" style={{ fontSize: 'clamp(13px,1.5vw,14px)', lineHeight: 1.5, margin: 0, color: 'var(--muted)', marginTop: 'auto' }}>
                  This item is not currently on the menu. Ask our staff about availability.
                </p>
              )}
            </div>
          </motion.article>
        ))}
      </motion.div>
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
  const [flavors, setFlavors] = useState<Flavor[]>([])
  const [sections, setSections] = useState<MenuSection[]>([])
  const [promos, setPromos] = useState<Promo[]>([])
  const [loading, setLoading] = useState({ p: true, f: true, m: true, r: true })
  const [category, setCategory] = useState<Category>('All')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
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
    const load = <T,>(url: string, key: 'p' | 'f' | 'm' | 'r', set: (d: T[]) => void, map?: (d: unknown[]) => T[]) =>
      api.get<unknown[]>(url)
        .then((d: unknown) => { if (!cancelled) { const r = Array.isArray(d) ? d : []; set(map ? map(r) : (r as T[])) } })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(s => ({ ...s, [key]: false })) })
    load<Product>('/api/products?item_type=menu_item', 'p', setProducts, mapProducts)
    load<Flavor>('/api/flavors', 'f', setFlavors)
    load<MenuSection>('/api/menu-sections', 'm', setSections)
    load<Promo>('/api/promos', 'r', setPromos)
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(
    () => products.filter(p => (category === 'All' || p.category === category) && p.name.toLowerCase().includes(search.toLowerCase())),
    [products, category, search]
  )
  const feedbackOptions = useMemo(() => products.map(p => ({ id: p.id, name: p.name })), [products])

  const goOrder = useCallback(() => navigate('/usersmenu?showOrderModal=true'), [navigate])
  const logout = useCallback(() => { onLogout?.(); navigate('/products') }, [onLogout, navigate])
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

      {/* HERO SECTION — Single immersive hero with pure photography */}
      <section style={{ paddingTop: NAV_H + 60, paddingBottom: 60, background: 'radial-gradient(ellipse at 20% 0%,rgba(245,200,66,.08),transparent 60%)' }}>
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

      {/* FEATURED STRIP */}
      <motion.section variants={staggerContainer} style={{ padding: '0 var(--pad) 60px' }}>
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

      <motion.main className="wrap" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ paddingTop: 40, paddingBottom: 120 }}>
        {/* PRODUCTS GRID */}
        <motion.section variants={staggerContainer}>
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
          <motion.section className="section" variants={staggerContainer}>
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

        {/* FLAVORS */}
        {!loading.f && flavors.length > 0 && (
          <motion.section className="section" variants={staggerContainer}>
            <div className="section-header">
              <motion.h2 className="section-title" variants={fadeUp}>Signature Flavors</motion.h2>
              <motion.p className="section-subtitle" variants={fadeUp}>Available on every chicken order. Tap a flavor to preview it.</motion.p>
            </div>
            <motion.div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14 }} variants={staggerContainer} role="list">
              {flavors.map(f => (
                <motion.div key={f.name} variants={fadeUp} role="listitem">
                  <FlavorCard f={f} open={expanded === f.name} onToggle={() => setExpanded(expanded === f.name ? null : f.name)} />
                </motion.div>
              ))}
            </motion.div>
          </motion.section>
        )}

        {/* FULL MENU */}
        {!loading.m && sections.length > 0 && (
          <motion.section className="section" variants={staggerContainer}>
            <div className="section-header">
              <motion.h2 className="section-title" variants={fadeUp}>Full Menu</motion.h2>
              <motion.p className="section-subtitle" variants={fadeUp}>Everything we serve, by section.</motion.p>
            </div>
            <motion.div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,460px),1fr))', gap: 24 }} variants={staggerContainer} role="list">
              {sections.map(s => (
                <motion.div key={s.id} variants={fadeUp} role="listitem">
                  <MenuCard s={s} />
                </motion.div>
              ))}
            </motion.div>
          </motion.section>
        )}

        {/* FOOD PREVIEW GALLERY - Frontend-only preview of verified local food images */}
        <FoodPreviewGallery products={products} />
      </motion.main>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--line)', padding: '48px 0 32px', marginTop: 60 }}>
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