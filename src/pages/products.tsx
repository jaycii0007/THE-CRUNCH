import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Flame, Clock, ChevronDown, MapPin, Star, X, MessageSquare, Send, CheckCircle, Menu, User } from 'lucide-react'
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
    .map((r: any) => ({
      id: Number(r?.id ?? r?.product_id ?? 0),
      name: String(r?.name ?? r?.product_name ?? '').trim(),
      category: normCat(r?.category),
      rating: Number(r?.rating ?? 0),
      badge: String(r?.badge ?? '').trim(),
      description: String(r?.description ?? '').trim(),
      price: Number(r?.price ?? 0),
      spicy: Boolean(r?.spicy),
      img: typeof (r?.image ?? r?.img) === 'string' && String(r?.image ?? r?.img).trim() ? resolveAssetUrl(String(r?.image ?? r?.img).trim()) : '',
    }))
    .filter(p => p.id > 0 && p.name)

const timeLeft = (d?: string) => {
  if (!d) return null
  const diff = new Date(d).getTime() - Date.now()
  if (diff <= 0) return null
  const days = Math.floor(diff / 86400000)
  if (days > 30) return null
  return days > 0 ? `${days}d left` : `${Math.floor(diff / 3600000)}h left`
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
:root{--gold:#f5c842;--bg:#0b0a08;--card:#131110;--line:rgba(255,255,255,.08);--text:#f4f1ec;--muted:rgba(244,241,236,.58);--pad:clamp(16px,4vw,48px)}
body{background:var(--bg)}
.pc{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
.pc button{font-family:inherit}
.pc :focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.wrap{max-width:1240px;margin:0 auto;padding:0 var(--pad);width:100%}
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
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;transition:border-color .2s,transform .2s;display:flex;flex-direction:column}
.card:hover{border-color:rgba(245,200,66,.35);transform:translateY(-2px)}
.thumb{position:relative;aspect-ratio:4/3;background:#1a1712;overflow:hidden}
.thumb img{width:100%;height:100%;object-fit:cover;display:block}
.chip{font-size:11px;font-weight:600;padding:3px 10px;border-radius:999px;background:rgba(255,255,255,.06);color:var(--muted)}
.chip-gold{background:var(--gold);color:#15120a}
.tabs{position:sticky;top:${NAV_H}px;z-index:50;background:rgba(11,10,8,.94);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.tabs-in{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none}
.tabs-in::-webkit-scrollbar{display:none}
.tab{position:relative;background:none;border:0;padding:16px 14px;font-size:14px;font-weight:500;color:var(--muted);cursor:pointer;white-space:nowrap}
.tab.on{color:var(--gold);font-weight:600}
.tab.on::after{content:'';position:absolute;left:10px;right:10px;bottom:0;height:2px;background:var(--gold);border-radius:2px}
.h2{font-size:clamp(26px,3.6vw,38px);font-weight:800;letter-spacing:-.025em;line-height:1.1}
.sub{color:var(--muted);font-size:14px;line-height:1.6}
.section{margin-top:80px}
.skel{border-radius:16px;background:linear-gradient(90deg,#141210,#1c1915,#141210);background-size:200% 100%;animation:sh 1.4s infinite}
.fixed-btn{position:fixed;bottom:22px;right:22px;z-index:90}
.input{width:100%;font:inherit;font-size:14px;color:var(--text);background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:10px;padding:11px 14px;outline:none;transition:border-color .15s}
.input:focus{border-color:rgba(245,200,66,.5)}
.input option{color:#111}
@keyframes sh{to{background-position:-200% 0}}
@media(max-width:768px){.links,.status.hide-m{display:none}.burger{display:flex}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`

const Skel = ({ h }: { h: number }) => <div className="skel" style={{ height: h }} />

function Photo({ src, alt }: { src?: string; alt: string }) {
  const [bad, setBad] = useState(false)
  if (!src || bad) return <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 12 }}>No image</div>
  return <img src={src} alt={alt} loading="lazy" onError={() => setBad(true)} />
}

// ── Cards ──────────────────────────────────────────────────────────────────
function ProductCard({ p, onOrder }: { p: Product; onOrder: () => void }) {
  return (
    <article className="card">
      <div className="thumb">
        <Photo src={p.img} alt={p.name} />
        {p.badge && <span className="chip chip-gold" style={{ position: 'absolute', top: 12, left: 12 }}>{p.badge}</span>}
        {p.spicy && <span style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,.6)', borderRadius: '50%', width: 28, height: 28, display: 'grid', placeItems: 'center' }} aria-label="Spicy"><Flame size={14} color="#ef4444" /></span>}
      </div>
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.25 }}>{p.name}</h3>
          {p.rating > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}><Star size={12} fill="currentColor" />{p.rating.toFixed(1)}</span>}
        </div>
        {p.description && <p className="sub" style={{ fontSize: 13, flex: 1 }}>{p.description}</p>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 20, fontWeight: 800 }}>{fmt(p.price)}</span>
          <button className="btn btn-gold" onClick={onOrder}>Order</button>
        </div>
      </div>
    </article>
  )
}

function PromoCard({ p }: { p: Promo }) {
  const left = timeLeft(p.validUntil)
  return (
    <article className="card">
      <div className="thumb" style={{ aspectRatio: '16/9' }}>
        <Photo src={p.img ? resolveAssetUrl(p.img) : ''} alt={p.title} />
        {p.badge && <span className="chip chip-gold" style={{ position: 'absolute', top: 12, left: 12 }}>{p.badge}</span>}
        {p.discount && <span className="chip chip-gold" style={{ position: 'absolute', bottom: 12, right: 12, fontSize: 13 }}>{p.discount}</span>}
      </div>
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h3 style={{ fontSize: 17, fontWeight: 700 }}>{p.title}</h3>
        {p.subtitle && <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--gold)' }}>{p.subtitle}</p>}
        <p className="sub" style={{ fontSize: 13 }}>{p.description}</p>
        {left && <span className="chip" style={{ alignSelf: 'flex-start', marginTop: 4, color: '#f87171' }}>{left}</span>}
      </div>
    </article>
  )
}

function FlavorCard({ f, open, onToggle }: { f: Flavor; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ gridColumn: open ? 'span 2' : 'span 1' }}>
      <button onClick={onToggle} aria-expanded={open} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--card)', color: 'var(--text)', border: `1px solid ${open ? f.accent || 'var(--gold)' : 'var(--line)'}`, borderRadius: open ? '12px 12px 0 0' : 12, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
        {f.name}
        <ChevronDown size={15} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>
      {open && (
        <div style={{ border: `1px solid ${f.accent || 'var(--gold)'}`, borderTop: 0, borderRadius: '0 0 12px 12px', overflow: 'hidden', background: 'var(--card)' }}>
          <div className="thumb" style={{ aspectRatio: '16/9' }}><Photo src={f.img ? resolveAssetUrl(f.img) : ''} alt={f.name} /></div>
          {f.desc && <p className="sub" style={{ padding: 14, fontSize: 13 }}>{f.desc}</p>}
        </div>
      )}
    </div>
  )
}

function MenuCard({ s }: { s: MenuSection }) {
  return (
    <div className="card" style={{ padding: 22 }}>
      <h3 style={{ fontSize: 18, fontWeight: 700 }}>{s.title}</h3>
      {s.subtext && <p className="sub" style={{ fontSize: 12.5, marginTop: 4 }}>{s.subtext}</p>}
      <div style={{ marginTop: 12 }}>
        {s.items.map(it => (
          <div key={`${s.id}-${it.name}-${it.price}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--line)' }}>
            {it.img && <div className="thumb" style={{ width: 40, height: 40, aspectRatio: '1', borderRadius: 8, flexShrink: 0 }}><Photo src={resolveAssetUrl(it.img)} alt={it.name} /></div>}
            <span style={{ flex: 1, fontSize: 14 }}>{it.name} {it.tag && <span className="chip chip-gold" style={{ marginLeft: 6 }}>{it.tag}</span>}</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold)' }}>{fmt(it.price)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Feedback ───────────────────────────────────────────────────────────────
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
            <button className="btn btn-gold" onClick={submit} disabled={!can || status === 'sending'} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 12, opacity: can ? 1 : .45, cursor: can ? 'pointer' : 'not-allowed' }}>
              <Send size={14} />{status === 'sending' ? 'Sending…' : 'Send feedback'}
            </button>
          </div>
        )}
      </motion.div>
    </>
  )
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
      <header className={`nav ${scrolled || menuOpen ? 'on' : ''}`}>
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
                {user?.username && <span className="status"><User size={14} />{user.username}</span>}
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
                  <button className="btn btn-gold" style={{ flex: 1 }} onClick={() => { logout(); setMenuOpen(false) }}>Log out</button>
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
      </header>

      {/* HERO */}
      <section style={{ paddingTop: NAV_H + 72, paddingBottom: 56, background: 'radial-gradient(ellipse at 20% 0%,rgba(245,200,66,.10),transparent 55%)' }}>
        <div className="wrap">
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}><MapPin size={14} color="var(--gold)" />The Crunch, Fairview</p>
          <h1 style={{ fontSize: 'clamp(44px,8vw,88px)', fontWeight: 800, letterSpacing: '-.035em', lineHeight: 1 }}>Our menu</h1>
          <p className="sub" style={{ marginTop: 14, maxWidth: 440, fontSize: 15 }}>Fresh, hot, and made to order. Browse the full menu and order when you're ready.</p>
          <div style={{ position: 'relative', marginTop: 28, maxWidth: 380 }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input className="input" style={{ paddingLeft: 40, paddingRight: 38 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search the menu" aria-label="Search the menu" />
            {search && <button onClick={() => setSearch('')} aria-label="Clear search" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, color: 'var(--muted)', cursor: 'pointer', display: 'flex' }}><X size={16} /></button>}
          </div>
        </div>
      </section>

      {/* CATEGORY TABS */}
      <div className="tabs">
        <div className="wrap tabs-in" role="tablist">
          {CATEGORIES.map(c => (
            <button key={c} role="tab" aria-selected={category === c} className={`tab ${category === c ? 'on' : ''}`} onClick={() => setCategory(c)}>{c}</button>
          ))}
        </div>
      </div>

      <main className="wrap" style={{ paddingTop: 40, paddingBottom: 100 }}>
        {/* Products */}
        {loading.p ? (
          <div className="grid">{Array.from({ length: 6 }).map((_, i) => <Skel key={i} h={380} />)}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: 18, fontWeight: 700 }}>No items found</p>
            <p className="sub" style={{ marginTop: 4 }}>Try a different search or category.</p>
            {search && <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => setSearch('')}>Clear search</button>}
          </div>
        ) : (
          <>
            <p className="sub" style={{ fontSize: 13, marginBottom: 16 }}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</p>
            <div className="grid">{filtered.map(p => <ProductCard key={p.id} p={p} onOrder={goOrder} />)}</div>
          </>
        )}

        {/* Promos */}
        {(loading.r || promos.length > 0) && (
          <section className="section">
            <h2 className="h2">Deals and promos</h2>
            <p className="sub" style={{ marginTop: 8, marginBottom: 28 }}>Current offers and limited-time specials.</p>
            {loading.r ? (
              <div className="grid">{Array.from({ length: 3 }).map((_, i) => <Skel key={i} h={280} />)}</div>
            ) : (
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,320px),1fr))' }}>
                {[...featured, ...regular].map(p => <PromoCard key={p.id} p={p} />)}
              </div>
            )}
          </section>
        )}

        {/* Flavors */}
        {(loading.f || flavors.length > 0) && (
          <section className="section">
            <h2 className="h2">Signature flavors</h2>
            <p className="sub" style={{ marginTop: 8, marginBottom: 28 }}>Available on every chicken order. Tap a flavor to preview it.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
              {loading.f
                ? Array.from({ length: 6 }).map((_, i) => <Skel key={i} h={46} />)
                : flavors.map(f => <FlavorCard key={f.name} f={f} open={expanded === f.name} onToggle={() => setExpanded(expanded === f.name ? null : f.name)} />)}
            </div>
          </section>
        )}

        {/* Full menu */}
        {(loading.m || sections.length > 0) && (
          <section className="section">
            <h2 className="h2">Full menu</h2>
            <p className="sub" style={{ marginTop: 8, marginBottom: 28 }}>Everything we serve, by section.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,420px),1fr))', gap: 20 }}>
              {loading.m ? Array.from({ length: 4 }).map((_, i) => <Skel key={i} h={300} />) : sections.map(s => <MenuCard key={s.id} s={s} />)}
            </div>
          </section>
        )}
      </main>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--line)', padding: '40px 0 28px' }}>
        <div className="wrap">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 28 }}>
            <div>
              <p style={{ fontWeight: 800, fontSize: 17 }}>The <span style={{ color: 'var(--gold)' }}>Crunch</span></p>
              <p className="sub" style={{ marginTop: 6, fontSize: 13 }}>6 Falcon St., cor Dahlia Fairview,<br />Quezon City, Philippines</p>
              <a href="https://www.google.com/maps/place/The+Crunch+-+Fairview+Branch/@14.7002687,121.0662915,21z" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 13, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none' }}>
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
              <p className="sub" style={{ marginTop: 6, fontSize: 13 }}>Mon–Fri: 10 AM – 10 PM<br />Sat–Sun: 11 AM – 8:30 PM</p>
            </div>
          </div>
          <p className="sub" style={{ marginTop: 32, paddingTop: 18, borderTop: '1px solid var(--line)', fontSize: 12, textAlign: 'center' }}>© {new Date().getFullYear()} The Crunch Fairview. All rights reserved.</p>
        </div>
      </footer>

      {/* FEEDBACK */}
      <AnimatePresence>{feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} options={feedbackOptions} userId={userId} />}</AnimatePresence>
      <button className="btn btn-gold fixed-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, borderRadius: 999, padding: '11px 18px', boxShadow: '0 6px 24px rgba(0,0,0,.4)' }} onClick={() => setFeedbackOpen(v => !v)}>
        <MessageSquare size={15} />{feedbackOpen ? 'Close' : 'Feedback'}
      </button>
    </div>
  )
}