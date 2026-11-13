import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type RefObject,
} from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { MapPin, Star, X, MessageSquare, Send, CheckCircle, ArrowRight, Clock, ChevronLeft, ChevronRight, Flame, Pause, Play } from 'lucide-react'
import { api, resolveAssetUrl } from '@/lib/api'
import { fetchGeneralSettings } from '@/lib/restaurantSettings'
import { useAuth } from '@/context/authcontext'
import { Navbar } from '@/components/Navbar'

// Product data and existing API mapping
const MAX_FB = 200
type Category = string

interface Product {
  id: number
  name: string
  category: Category
  categorySystemKey: string | null
  glazeColor: string | null
  spiceFlag: boolean | null
  availabilityStatus: string
  rating: number
  badge: string
  description: string
  price: number
  spicy: boolean
  img: string
  archived: boolean
}

const normCat = (value: unknown): Category => String(value ?? '').trim()

// Optional presentation details are used only when the API actually supplies them.
const readGlazeColor = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const color = value.trim()
  return /^#[0-9a-f]{6}$/i.test(color) ? color : null
}

const readSpiceFlag = (value: unknown): boolean | null => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : value
  if (normalized === true || normalized === 1 || normalized === 'true' || normalized === '1') return true
  if (normalized === false || normalized === 0 || normalized === 'false' || normalized === '0') return false
  return null
}

const mapProducts = (data: unknown[]): Product[] =>
  data
    .map((entry) => {
      const r = entry !== null && typeof entry === 'object'
        ? entry as Record<string, unknown>
        : {}
      const rawImage = String(r?.image ?? r?.img ?? '').trim()
      const resolvedImg = rawImage ? resolveAssetUrl(rawImage) : ''
      if (import.meta.env.DEV && rawImage) {
        console.log('[mapProducts]', {
          id: r?.id ?? r?.product_id,
          name: r?.name ?? r?.product_name,
          rawImage,
          resolvedImg,
        })
      }
      return {
        id: Number(r?.id ?? r?.product_id ?? 0),
        name: String(r?.name ?? r?.product_name ?? '').trim(),
        category: normCat(r?.category),
        categorySystemKey: String(r?.category_system_key ?? '').trim().toLowerCase() || null,
        glazeColor: readGlazeColor(r?.glaze_color),
        spiceFlag: readSpiceFlag(r?.spicy),
        availabilityStatus: String(r?.availability_status ?? r?.availabilityStatus ?? '').trim().toLowerCase(),
        rating: Number(r?.rating ?? 0),
        badge: String(r?.badge ?? '').trim(),
        description: String(r?.description ?? '').trim(),
        price: Number(r?.price ?? 0),
        spicy: Boolean(r?.spicy),
        img: resolvedImg,
        archived: String(r?.availability_status ?? r?.availabilityStatus ?? '').trim().toLowerCase() === 'hidden',
      }
    })
    .filter(product => product.id > 0 && product.name)

const BLACK = '#17110F'
const HERO_IMAGE = '/img/signatureglazed2.webp'
const easeOut = [0.22, 1, 0.36, 1] as const

// All page styles and font declarations are installed only while this page is mounted.
const CSS = `
@font-face {
  font-family: 'Crunch Display';
  src: url('/fonts/ClashDisplay_Complete/Fonts/WEB/fonts/ClashDisplay-Variable.woff2') format('woff2');
  font-style: normal;
  font-weight: 200 700;
  font-display: swap;
}

.crunch-page {
  --crunch-base: #17110f;
  --crunch-surface: #291c17;
  --crunch-elevated: #35231c;
  --crunch-border: #654336;
  --crunch-text: #fff4e6;
  --crunch-muted: #d1beb0;
  --crunch-accent: #e8a63c;
  --crunch-accent-hover: #f3bd62;
  --crunch-accent-pressed: #ca8324;
  --crunch-on-accent: #24170d;
  --crunch-chili: #b4442c;
  --crunch-success: #94d3a0;
  --crunch-warning: #efbe6e;
  --crunch-error: #f4a099;
  --crunch-amber-haze: rgba(232, 166, 60, 0.16);
  --crunch-chili-haze: rgba(180, 68, 44, 0.15);
  --crunch-glass: rgba(53, 35, 28, 0.82);
  --crunch-image-line: rgba(255, 244, 230, 0.24);
  --crunch-space-1: 0.5rem;
  --crunch-space-2: 1rem;
  --crunch-space-3: 1.5rem;
  --crunch-space-4: 2rem;
  --crunch-space-5: 3rem;
  --crunch-space-6: 4rem;
  --crunch-space-7: 6rem;
  --crunch-radius-sm: 0.65rem;
  --crunch-radius-md: 1rem;
  --crunch-radius-lg: 1.6rem;
  --crunch-radius-pill: 999px;
  --crunch-shadow-card: 0 26px 80px rgba(0, 0, 0, 0.3);
  --crunch-shadow-glow: 0 12px 35px rgba(232, 166, 60, 0.17);
  --crunch-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --crunch-duration-fast: 160ms;
  --crunch-duration-base: 320ms;
  --crunch-duration-slow: 650ms;
  --crunch-type-xs: clamp(0.67rem, 0.75vw, 0.75rem);
  --crunch-type-sm: clamp(0.8rem, 0.95vw, 0.9rem);
  --crunch-type-body: clamp(0.98rem, 1.15vw, 1.12rem);
  --crunch-type-display: clamp(2.55rem, 6.65vw, 7rem);
  --crunch-page-pad: clamp(1.25rem, 4.2vw, 4.5rem);
  --crunch-page-width: 100rem;
  --crunch-font-display: 'Crunch Display', 'Arial Narrow', sans-serif;
  --crunch-font-body: 'Instrument Sans', system-ui, sans-serif;

  /* Compatibility values for the existing story, footer, and feedback until Stage 3. */
  --bg: var(--crunch-base);
  --gold: var(--crunch-accent);
  --gold-dark: var(--crunch-accent-pressed);
  --gold-gradient: linear-gradient(115deg, var(--crunch-accent-hover), var(--crunch-accent));
  --text: var(--crunch-text);
  --muted: var(--crunch-muted);
  --container-max: var(--crunch-page-width);
  --container-pad: var(--crunch-page-pad);
  --section-py: clamp(4rem, 8vw, 8rem);
  position: relative;
  isolation: isolate;
  min-height: 100dvh;
  width: 100%;
  overflow-x: clip;
  background: var(--crunch-base);
  color: var(--crunch-text);
  font-family: var(--crunch-font-body);
}

.crunch-page :where(h1, p, figure) { margin: 0; }
.crunch-page .crunch-main :focus-visible,
.crunch-page footer :focus-visible,
.crunch-page .crunch-feedback:focus-visible,
.crunch-page [role="dialog"] :focus-visible {
  outline: 2px solid var(--crunch-accent-hover);
  outline-offset: 4px;
}
.crunch-page .crunch-main { position: relative; z-index: 1; }
.crunch-page .crunch-ambient {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}
.crunch-page .crunch-ambient__wash,
.crunch-page .crunch-ambient__ember,
.crunch-page .crunch-ambient__interaction {
  position: absolute;
  pointer-events: none;
}
.crunch-page .crunch-ambient__wash {
  width: min(75vw, 75rem);
  aspect-ratio: 1;
  top: -35%;
  right: -13%;
  border-radius: 50%;
  background: radial-gradient(circle, var(--crunch-amber-haze), transparent 68%);
  will-change: transform;
}
.crunch-page .crunch-ambient__ember {
  width: min(62vw, 58rem);
  aspect-ratio: 1;
  left: -25%;
  bottom: -35%;
  border-radius: 50%;
  background: radial-gradient(circle, var(--crunch-chili-haze), transparent 70%);
}
.crunch-page .crunch-ambient__interaction {
  width: min(34rem, 72vw);
  aspect-ratio: 1;
  top: 0;
  left: 0;
  border-radius: 50%;
  opacity: 0;
  background: radial-gradient(circle, var(--crunch-active-glow, var(--crunch-accent)), transparent 68%);
  transition: opacity var(--crunch-duration-base) var(--crunch-ease);
  will-change: transform, opacity;
}

.crunch-page .crunch-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--crunch-space-1);
  min-width: 44px;
  min-height: 44px;
  border: 1px solid transparent;
  border-radius: var(--crunch-radius-sm);
  font-family: var(--crunch-font-body);
  font-weight: 700;
  line-height: 1.1;
  text-decoration: none;
  cursor: pointer;
  transition: transform var(--crunch-duration-fast) var(--crunch-ease),
    background var(--crunch-duration-fast) var(--crunch-ease),
    border-color var(--crunch-duration-fast) var(--crunch-ease),
    box-shadow var(--crunch-duration-base) var(--crunch-ease);
}
.crunch-page .crunch-button--sm { padding: 0.65rem var(--crunch-space-2); font-size: var(--crunch-type-sm); }
.crunch-page .crunch-button--md { min-height: 52px; padding: 0.8rem var(--crunch-space-3); font-size: var(--crunch-type-sm); }
.crunch-page .crunch-button--lg { min-height: 56px; padding: 0.9rem var(--crunch-space-4); font-size: var(--crunch-type-body); }
.crunch-page .crunch-button--primary { background: var(--crunch-accent); color: var(--crunch-on-accent); box-shadow: var(--crunch-shadow-glow); }
.crunch-page .crunch-button--glass { background: var(--crunch-glass); color: var(--crunch-text); border-color: var(--crunch-border); }
.crunch-page .crunch-button--ghost { background: transparent; color: var(--crunch-text); border-color: var(--crunch-border); }
.crunch-page .crunch-button--icon { width: 44px; padding: 0; background: var(--crunch-glass); color: var(--crunch-text); border-color: var(--crunch-border); }
.crunch-page .crunch-button:active:not(:disabled) { transform: translateY(1px) scale(0.98); }
.crunch-page .crunch-button:disabled { cursor: not-allowed; opacity: 0.62; box-shadow: none; }
.crunch-page .crunch-button__content { display: inline-flex; align-items: center; justify-content: center; gap: var(--crunch-space-1); }
.crunch-page .crunch-button__icon { display: inline-flex; align-items: center; justify-content: center; flex: none; }
.crunch-page .crunch-button__icon svg { width: 1.1rem; height: 1.1rem; stroke-width: 1.8; }
@media (hover: hover) and (pointer: fine) {
  .crunch-page .crunch-button--primary:hover:not(:disabled) { background: var(--crunch-accent-hover); transform: translateY(-2px); }
  .crunch-page .crunch-button--glass:hover:not(:disabled),
  .crunch-page .crunch-button--ghost:hover:not(:disabled),
  .crunch-page .crunch-button--icon:hover:not(:disabled) { border-color: var(--crunch-accent); transform: translateY(-2px); }
}

.crunch-page .crunch-hero {
  width: min(100%, var(--crunch-page-width));
  margin-inline: auto;
  padding: calc(72px + clamp(2.5rem, 5vw, 5rem)) var(--crunch-page-pad) clamp(3.5rem, 7vw, 7rem);
}
.crunch-page .crunch-hero__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.03fr) minmax(0, 0.97fr);
  align-items: center;
  gap: clamp(2.5rem, 6vw, 7rem);
}
.crunch-page .crunch-hero__copy { min-width: 0; }
.crunch-page .crunch-hero__eyebrow {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  color: var(--crunch-accent-hover);
  font-size: var(--crunch-type-xs);
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}
.crunch-page .crunch-hero__eyebrow::before {
  content: '';
  width: 2.6rem;
  height: 2px;
  background: var(--crunch-accent);
}
.crunch-page .crunch-hero__title {
  margin-block: clamp(1.25rem, 2.5vw, 2.6rem) var(--crunch-space-3);
  font-family: var(--crunch-font-display);
  font-size: var(--crunch-type-display);
  font-weight: 700;
  letter-spacing: -0.055em;
  line-height: 0.9;
  text-transform: uppercase;
}
.crunch-page .crunch-hero__title span { display: block; }
.crunch-page .crunch-hero__title span:last-child { color: var(--crunch-accent); }
.crunch-page .crunch-hero__description {
  max-width: 31rem;
  color: var(--crunch-muted);
  font-size: var(--crunch-type-body);
  line-height: 1.75;
}
.crunch-page .crunch-hero__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--crunch-space-3);
  margin-top: clamp(1.5rem, 3vw, 2.5rem);
}
.crunch-page .crunch-hero__action-note {
  color: var(--crunch-muted);
  font-size: var(--crunch-type-xs);
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.crunch-page .crunch-hero__visual { min-width: 0; width: 100%; }
.crunch-page .crunch-hero__frame {
  position: relative;
  padding: clamp(0.55rem, 1vw, 0.9rem);
  background: var(--crunch-elevated);
  border: 1px solid var(--crunch-border);
  border-radius: var(--crunch-radius-lg) var(--crunch-radius-lg) var(--crunch-radius-sm) var(--crunch-radius-sm);
  box-shadow: var(--crunch-shadow-card);
}
.crunch-page .crunch-hero__photo {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1.05;
  overflow: hidden;
  background: var(--crunch-surface);
  border-radius: calc(var(--crunch-radius-lg) - 0.5rem) calc(var(--crunch-radius-lg) - 0.5rem) var(--crunch-radius-sm) var(--crunch-radius-sm);
}
.crunch-page .crunch-hero__photo img { display: block; }
.crunch-page .crunch-hero__caption {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--crunch-space-2);
  padding: var(--crunch-space-2) 0.2rem 0.2rem;
}
.crunch-page .crunch-hero__caption-label {
  display: grid;
  gap: 0.3rem;
  color: var(--crunch-text);
  font-size: var(--crunch-type-sm);
  font-weight: 700;
}
.crunch-page .crunch-hero__caption-label small,
.crunch-page .crunch-hero__caption-count small {
  color: var(--crunch-muted);
  font-size: var(--crunch-type-xs);
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.crunch-page .crunch-hero__caption-count {
  display: flex;
  align-items: center;
  gap: var(--crunch-space-1);
  color: var(--crunch-accent);
  font-family: var(--crunch-font-display);
  font-size: clamp(2rem, 3.8vw, 3.8rem);
  font-weight: 600;
  line-height: 0.9;
}
.crunch-page .crunch-hero__caption-count small { max-width: 4.5rem; line-height: 1.35; font-family: var(--crunch-font-body); }
.crunch-page .crunch-hero__promises {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--crunch-space-3);
  margin-top: clamp(3rem, 6vw, 5.5rem);
  padding-top: var(--crunch-space-3);
  border-top: 1px solid var(--crunch-border);
}
.crunch-page .crunch-hero__promise { display: flex; align-items: center; gap: 0.75rem; min-width: 0; color: var(--crunch-text); font-size: var(--crunch-type-sm); font-weight: 600; }
.crunch-page .crunch-hero__promise-mark { flex: none; width: 0.5rem; height: 0.5rem; background: var(--crunch-accent); border-radius: 50%; }

/* Stage 2: glaze carousel. Cards use the same surface and spacing system as the hero. */
.crunch-page .crunch-glazes {
  width: min(100%, var(--crunch-page-width));
  margin-inline: auto;
  padding: clamp(4rem, 8vw, 8rem) var(--crunch-page-pad);
  border-top: 1px solid var(--crunch-border);
}
.crunch-page .crunch-glazes__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--crunch-space-3);
  margin-bottom: var(--crunch-space-4);
}
.crunch-page .crunch-glazes__eyebrow {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  color: var(--crunch-accent-hover);
  font-size: var(--crunch-type-xs);
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.crunch-page .crunch-glazes__eyebrow::before { content: ''; width: 2.6rem; height: 2px; background: var(--crunch-accent); }
.crunch-page .crunch-glazes__heading {
  margin: var(--crunch-space-2) 0 0;
  max-width: 15ch;
  color: var(--crunch-text);
  font-family: var(--crunch-font-display);
  font-size: clamp(2.4rem, 5.5vw, 5.8rem);
  font-weight: 650;
  letter-spacing: -0.055em;
  line-height: 0.95;
}
.crunch-page .crunch-glazes__intro {
  max-width: 22rem;
  color: var(--crunch-muted);
  font-size: var(--crunch-type-sm);
  line-height: 1.7;
}
.crunch-page .crunch-glazes__notice {
  margin-bottom: var(--crunch-space-2);
  padding: var(--crunch-space-2) var(--crunch-space-3);
  border: 1px solid var(--crunch-border);
  border-radius: var(--crunch-radius-sm);
  background: var(--crunch-surface);
  color: var(--crunch-text);
  font-size: var(--crunch-type-sm);
  line-height: 1.55;
}
.crunch-page .crunch-glazes__stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: stretch;
  justify-items: center;
  width: 100%;
  padding-block: var(--crunch-space-2);
  overflow: hidden;
  perspective: clamp(720px, 78vw, 1100px);
  touch-action: pan-y;
  user-select: none;
  cursor: grab;
}
.crunch-page .crunch-glazes__stage::before {
  content: '';
  grid-area: 1 / 1;
  align-self: end;
  width: min(82%, 60rem);
  height: 4rem;
  border: 1px solid var(--crunch-border);
  border-radius: 50%;
  background: radial-gradient(ellipse, var(--crunch-amber-haze), transparent 70%);
  opacity: 0.65;
  transform: translateY(42%) rotateX(65deg);
  pointer-events: none;
}
.crunch-page .crunch-glazes__stage:active { cursor: grabbing; }
.crunch-page .crunch-glazes__stage > .crunch-glazes__card {
  grid-area: 1 / 1;
  width: min(72%, 54rem);
  transform-style: preserve-3d;
  backface-visibility: hidden;
}
.crunch-page .crunch-glazes__track {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: var(--crunch-space-2);
  width: 100%;
  padding: var(--crunch-space-2) max(0px, calc((100% - min(82%, 54rem)) / 2));
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scroll-snap-type: x mandatory;
  scrollbar-width: thin;
  scrollbar-color: var(--crunch-border) transparent;
  cursor: grab;
  user-select: none;
}
.crunch-page .crunch-glazes__track:active { cursor: grabbing; }
.crunch-page .crunch-glazes__track[data-dragging="true"] { scroll-snap-type: none; cursor: grabbing; }
.crunch-page .crunch-glazes__track > .crunch-glazes__card {
  flex: 0 0 min(82%, 54rem);
  scroll-snap-align: center;
  scroll-snap-stop: always;
}
.crunch-page .crunch-glazes__card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--crunch-border);
  border-radius: var(--crunch-radius-lg);
  background: var(--crunch-surface);
  box-shadow: var(--crunch-shadow-card);
  color: var(--crunch-text);
  text-align: left;
}
.crunch-page .crunch-glazes__media {
  position: relative;
  min-height: 22rem;
  overflow: hidden;
  background: var(--crunch-elevated);
}
.crunch-page .crunch-glazes__media img { display: block; }
.crunch-page .crunch-glazes__empty-media {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--crunch-space-2);
  width: 100%;
  height: 100%;
  min-height: inherit;
  padding: var(--crunch-space-3);
  background: radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--crunch-card-accent) 18%, transparent), transparent 58%), var(--crunch-elevated);
  color: var(--crunch-muted);
  font-size: var(--crunch-type-xs);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-align: center;
  text-transform: uppercase;
}
.crunch-page .crunch-glazes__empty-media svg { width: 2rem; height: 2rem; color: var(--crunch-accent-hover); stroke-width: 1.5; }
.crunch-page .crunch-glazes__copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  padding: clamp(1.5rem, 3.1vw, 3rem);
}
.crunch-page .crunch-glazes__card-label {
  color: var(--crunch-accent-hover);
  font-size: var(--crunch-type-xs);
  font-weight: 700;
  letter-spacing: 0.16em;
  line-height: 1.5;
  text-transform: uppercase;
}
.crunch-page .crunch-glazes__name {
  margin: var(--crunch-space-2) 0;
  max-width: 100%;
  color: var(--crunch-text);
  font-family: var(--crunch-font-display);
  font-size: clamp(2rem, 3.7vw, 3.8rem);
  font-weight: 650;
  letter-spacing: -0.045em;
  line-height: 1;
  overflow-wrap: anywhere;
}
.crunch-page .crunch-glazes__description { color: var(--crunch-muted); font-size: var(--crunch-type-sm); line-height: 1.7; overflow-wrap: anywhere; }
.crunch-page .crunch-glazes__detail {
  display: flex;
  align-items: center;
  gap: var(--crunch-space-1);
  margin-top: var(--crunch-space-3);
  color: var(--crunch-text);
  font-size: var(--crunch-type-xs);
  font-weight: 600;
  line-height: 1.4;
}
.crunch-page .crunch-glazes__availability { margin-top: var(--crunch-space-2); color: var(--crunch-warning); font-size: var(--crunch-type-xs); font-weight: 700; }
.crunch-page .crunch-glazes__detail svg { width: 1rem; height: 1rem; flex: none; color: var(--crunch-accent-hover); stroke-width: 1.8; }
.crunch-page .crunch-glazes__action { margin-top: auto; padding-top: var(--crunch-space-4); }
.crunch-page .crunch-glazes__controls {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--crunch-space-1);
  margin-top: var(--crunch-space-2);
}
.crunch-page .crunch-glazes__dots { display: flex; justify-content: center; flex-wrap: wrap; }
.crunch-page .crunch-glazes__dot { width: 44px; height: 44px; padding: 0; border-color: transparent; background: transparent; box-shadow: none; }
.crunch-page .crunch-glazes__dot-mark { width: 0.55rem; height: 0.55rem; border: 1px solid var(--crunch-muted); border-radius: 50%; background: transparent; }
.crunch-page .crunch-glazes__dot[aria-current="true"] .crunch-glazes__dot-mark { border-color: var(--crunch-accent); background: var(--crunch-accent); }
.crunch-page .crunch-glazes__counter { min-width: 5rem; color: var(--crunch-muted); font-size: var(--crunch-type-xs); font-weight: 700; letter-spacing: 0.1em; text-align: center; }
.crunch-page .crunch-glazes__help { margin-top: var(--crunch-space-2); color: var(--crunch-muted); font-size: var(--crunch-type-xs); line-height: 1.5; text-align: center; }
.crunch-page .crunch-glazes__sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.crunch-page .crunch-glazes__loading {
  display: grid;
  grid-template-columns: 0.95fr 1.05fr;
  width: min(82%, 54rem);
  min-height: 22rem;
  margin: var(--crunch-space-2) auto;
  overflow: hidden;
  border: 1px solid var(--crunch-border);
  border-radius: var(--crunch-radius-lg);
  background: var(--crunch-surface);
}
.crunch-page .crunch-glazes__loading-media { background: var(--crunch-elevated); }
.crunch-page .crunch-glazes__loading-copy { display: grid; align-content: center; gap: var(--crunch-space-2); padding: var(--crunch-space-4); }
.crunch-page .crunch-glazes__loading-line { height: 0.8rem; border-radius: var(--crunch-radius-pill); background: var(--crunch-border); }
.crunch-page .crunch-glazes__loading-line:first-child { width: 35%; }
.crunch-page .crunch-glazes__loading-line:nth-child(2) { width: 85%; height: 2.6rem; }
.crunch-page .crunch-glazes__loading-line:last-child { width: 60%; }
@media (max-width: 700px) {
  .crunch-page .crunch-glazes__header { align-items: start; flex-direction: column; }
  .crunch-page .crunch-glazes__stage > .crunch-glazes__card { width: min(86%, 32rem); }
  .crunch-page .crunch-glazes__track { padding-inline: max(0px, calc((100% - min(86%, 32rem)) / 2)); }
  .crunch-page .crunch-glazes__track > .crunch-glazes__card { flex-basis: min(86%, 32rem); }
  .crunch-page .crunch-glazes__card { grid-template-columns: minmax(0, 1fr); }
  .crunch-page .crunch-glazes__media { min-height: 0; aspect-ratio: 16 / 9; }
  .crunch-page .crunch-glazes__empty-media { min-height: 100%; }
  .crunch-page .crunch-glazes__loading { grid-template-columns: 1fr; width: min(86%, 32rem); }
  .crunch-page .crunch-glazes__loading-media { min-height: 10rem; }
  .crunch-page .crunch-glazes__loading-copy { min-height: 12rem; }
}

.crunch-page .crunch-feedback {
  position: fixed;
  right: max(1rem, env(safe-area-inset-right));
  bottom: max(1rem, env(safe-area-inset-bottom));
  z-index: 90;
  border-radius: var(--crunch-radius-pill);
  box-shadow: var(--crunch-shadow-card);
}
.crunch-page .btn-secondary {
  min-height: 44px;
  padding: 0.65rem var(--crunch-space-3);
  border: 1px solid var(--crunch-border);
  border-radius: var(--crunch-radius-sm);
  background: var(--crunch-glass);
  color: var(--crunch-text);
  cursor: pointer;
}
@media (max-width: 850px) {
  .crunch-page .crunch-hero__grid { grid-template-columns: 1fr; gap: var(--crunch-space-5); }
  .crunch-page .crunch-hero__copy { max-width: 42rem; }
  .crunch-page .crunch-hero__visual { width: min(100%, 38rem); margin-left: auto; }
  .crunch-page .crunch-hero__title { font-size: clamp(2.55rem, 10.1vw, 5.8rem); }
  .crunch-page .crunch-hero__photo { aspect-ratio: 1.18 / 1; }
}
@media (max-width: 520px) {
  .crunch-page .crunch-hero { padding-top: calc(72px + 2.4rem); }
  .crunch-page .crunch-hero__grid { gap: var(--crunch-space-4); }
  .crunch-page .crunch-hero__title { font-size: clamp(2.55rem, 11.2vw, 4.2rem); }
  .crunch-page .crunch-hero__description { line-height: 1.65; }
  .crunch-page .crunch-hero__actions { align-items: flex-start; flex-direction: column; gap: var(--crunch-space-2); }
  .crunch-page .crunch-hero__visual { width: 94%; }
  .crunch-page .crunch-hero__promises { grid-template-columns: 1fr; gap: var(--crunch-space-2); }
  .crunch-page .crunch-hero__caption-count { font-size: 2.3rem; }
}
@media (prefers-reduced-motion: reduce) {
  .crunch-page .crunch-button,
  .crunch-page .crunch-ambient__interaction { transition: none; }
}
`

// High-frequency interaction data stays in refs; it does not rerender the page.
interface CrunchSceneState {
  pointerX: number
  pointerY: number
  hoveredControl: string | null
  hoverX: number
  hoverY: number
  activeGlazeColor: string | null
  activeSlide: number
  currentSection: string
  scrollProgress: number
}
interface CrunchScene {
  root: RefObject<HTMLDivElement | null>
  state: RefObject<CrunchSceneState>
}
const CrunchSceneContext = createContext<CrunchScene | null>(null)

function useCrunchScene(): CrunchScene {
  const scene = useContext(CrunchSceneContext)
  if (!scene) throw new Error('Crunch scene is unavailable')
  return scene
}

// A shared button vocabulary for page-owned controls.
interface CrunchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'glass' | 'ghost' | 'icon'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  buttonId: string
}
function CrunchButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  buttonId,
  className = '',
  children,
  disabled,
  type = 'button',
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  ...props
}: CrunchButtonProps) {
  const scene = useCrunchScene()
  const markHovered = (element: HTMLButtonElement) => {
    const bounds = element.getBoundingClientRect()
    scene.state.current.hoveredControl = buttonId
    scene.state.current.hoverX = bounds.left + bounds.width / 2
    scene.state.current.hoverY = bounds.top + bounds.height / 2
  }
  const clearHovered = () => {
    if (scene.state.current.hoveredControl === buttonId) scene.state.current.hoveredControl = null
  }
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={'crunch-button crunch-button--' + variant + ' crunch-button--' + size + ' ' + className}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') markHovered(event.currentTarget)
        onPointerEnter?.(event)
      }}
      onPointerLeave={(event) => { clearHovered(); onPointerLeave?.(event) }}
      onFocus={(event) => { markHovered(event.currentTarget); onFocus?.(event) }}
      onBlur={(event) => { clearHovered(); onBlur?.(event) }}
    >
      <span className="crunch-button__content">{loading ? 'Loading…' : children}</span>
    </button>
  )
}

// The background reads the shared state directly, and pauses while the tab is hidden.
function CrunchAmbientBackground() {
  const scene = useCrunchScene()
  const washRef = useRef<HTMLDivElement>(null)
  const emberRef = useRef<HTMLDivElement>(null)
  const interactionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = scene.root.current
    const wash = washRef.current
    const ember = emberRef.current
    const interaction = interactionRef.current
    if (!root || !wash || !ember || !interaction) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    let frame: number | null = null
    let pointerAttached = false
    let elapsed = 0
    let lastFrame = 0
    let lastGlazeColor: string | null = null

    const onPointerMove = (event: PointerEvent) => {
      scene.state.current.pointerX = event.clientX / Math.max(window.innerWidth, 1)
      scene.state.current.pointerY = event.clientY / Math.max(window.innerHeight, 1)
    }
    const onScroll = () => {
      const scrollable = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)
      scene.state.current.scrollProgress = Math.min(1, Math.max(0, window.scrollY / scrollable))
    }
    const render = (time: number) => {
      if (document.hidden) { frame = null; lastFrame = 0; return }
      if (lastFrame) elapsed += Math.min(time - lastFrame, 50)
      lastFrame = time
      const state = scene.state.current
      const pointerX = (state.pointerX - 0.5) * 28
      const pointerY = (state.pointerY - 0.5) * 20
      const sectionShift = state.currentSection === 'glazes' ? -18 : state.currentSection === 'story' ? 18 : state.currentSection === 'footer' ? 32 : 0
      const slideShift = state.activeSlide * 2
      wash.style.transform = 'translate3d(' + (pointerX + Math.sin(elapsed / 2600) * 12 + slideShift) + 'px,' + (pointerY + state.scrollProgress * 45) + 'px,0)'
      ember.style.transform = 'translate3d(' + (-pointerX * 0.4) + 'px,' + (-state.scrollProgress * 45 - sectionShift + Math.sin(elapsed / 3200) * 9) + 'px,0)'
      interaction.style.transform = 'translate3d(' + state.hoverX + 'px,' + state.hoverY + 'px,0) translate(-50%,-50%)'
      interaction.style.opacity = state.hoveredControl ? '0.16' : '0'
      if (state.activeGlazeColor !== lastGlazeColor) {
        lastGlazeColor = state.activeGlazeColor
        if (lastGlazeColor && /^#[0-9a-f]{6}$/i.test(lastGlazeColor)) {
          interaction.style.setProperty('--crunch-active-glow', lastGlazeColor)
          wash.style.background = 'radial-gradient(circle, ' + lastGlazeColor + '29, transparent 68%)'
        } else {
          interaction.style.removeProperty('--crunch-active-glow')
          wash.style.removeProperty('background')
        }
      }
      frame = window.requestAnimationFrame(render)
    }
    const stop = () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      frame = null
      lastFrame = 0
    }
    const syncMode = () => {
      const lowEndPhone = window.innerWidth < 768 && (navigator.hardwareConcurrency || 2) <= 4
      const motionAllowed = !reduceMotion.matches && !lowEndPhone
      const pointerAllowed = motionAllowed && finePointer.matches && window.innerWidth >= 768
      if (pointerAllowed && !pointerAttached) {
        root.addEventListener('pointermove', onPointerMove, { passive: true })
        pointerAttached = true
      } else if (!pointerAllowed && pointerAttached) {
        root.removeEventListener('pointermove', onPointerMove)
        pointerAttached = false
      }
      if (motionAllowed && !document.hidden) {
        if (frame === null) frame = window.requestAnimationFrame(render)
      } else {
        stop()
        interaction.style.opacity = '0'
      }
    }
    const onVisibility = () => syncMode()
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => {
      const active = entries.find(entry => entry.isIntersecting)
      if (active) scene.state.current.currentSection = (active.target as HTMLElement).dataset.crunchSection || 'hero'
    }, { rootMargin: '-25% 0px -55% 0px', threshold: 0 })

    root.querySelectorAll('[data-crunch-section]').forEach(section => observer?.observe(section))
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', syncMode, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    reduceMotion.addEventListener?.('change', syncMode)
    finePointer.addEventListener?.('change', syncMode)
    onScroll()
    syncMode()

    return () => {
      stop()
      if (pointerAttached) root.removeEventListener('pointermove', onPointerMove)
      observer?.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', syncMode)
      document.removeEventListener('visibilitychange', onVisibility)
      reduceMotion.removeEventListener?.('change', syncMode)
      finePointer.removeEventListener?.('change', syncMode)
    }
  }, [scene])

  return (
    <div className="crunch-ambient" aria-hidden="true">
      <div className="crunch-ambient__wash" ref={washRef} />
      <div className="crunch-ambient__ember" ref={emberRef} />
      <div className="crunch-ambient__interaction" ref={interactionRef} />
    </div>
  )
}

function Photo({ src, alt, priority = false, style, className, draggable }: { src?: string; alt: string; priority?: boolean; style?: React.CSSProperties; className?: string; draggable?: boolean }) {
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
            animation: 'none',
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
        draggable={draggable}
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

// Stage 1: the hero keeps the existing menu destination and content.
function HeroSection() {
  const reduceMotion = useReducedMotion()
  return (
    <section className="crunch-hero" data-crunch-section="hero" aria-labelledby="crunch-hero-title">
      <div className="crunch-hero__grid">
        <div className="crunch-hero__copy">
          <motion.div
            className="crunch-hero__eyebrow"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: easeOut }}
          >
            THE CRUNCH
          </motion.div>
          <motion.h1
            id="crunch-hero-title"
            className="crunch-hero__title"
            initial={reduceMotion ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: reduceMotion ? 0 : 0.08, ease: easeOut }}
          >
            <span>SIGNATURE</span>
            <span>CHICKEN</span>
          </motion.h1>
          <motion.p
            className="crunch-hero__description"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: reduceMotion ? 0 : 0.16, ease: easeOut }}
          >
            Hand-crafted daily with our secret spice rubs. Choose from 7 signature glazes — each bite delivers the perfect crunch.
          </motion.p>
          <motion.div
            className="crunch-hero__actions"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: reduceMotion ? 0 : 0.24, ease: easeOut }}
          >
            <CrunchButton
              buttonId="explore-menu"
              size="lg"
              onClick={() => { window.location.href = '/usersmenu?showOrderModal=true' }}
            >
              Explore Menu <span className="crunch-button__icon"><ArrowRight aria-hidden="true" /></span>
            </CrunchButton>
            <span className="crunch-hero__action-note">Fresh daily · Fairview</span>
          </motion.div>
        </div>
        <motion.figure
          className="crunch-hero__visual"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: reduceMotion ? 0 : 0.12, ease: easeOut }}
        >
          <div className="crunch-hero__frame">
            <div className="crunch-hero__photo">
              <Photo src={HERO_IMAGE} alt="Glazed chicken served in a box" priority style={{ objectPosition: 'center 22%' }} />
            </div>
            <figcaption className="crunch-hero__caption">
              <span className="crunch-hero__caption-label">Signature chicken <small>Hand-glazed</small></span>
              <span className="crunch-hero__caption-count">07 <small>signature glazes</small></span>
            </figcaption>
          </div>
        </motion.figure>
      </div>
      <div className="crunch-hero__promises" aria-label="The Crunch highlights">
        {['7 Signature Glazes', '250+ Branches Nationwide', 'Fresh Daily, Never Frozen'].map(promise => (
          <div className="crunch-hero__promise" key={promise}>
            <span className="crunch-hero__promise-mark" aria-hidden="true" />
            <span>{promise}</span>
          </div>
        ))}
      </div>
    </section>
  )
}


// Stage 2: only published flavor records become real carousel slides.
type GlazeSlide = { kind: 'product'; product: Product } | { kind: 'placeholder'; number: number }
type ProductLoadStatus = 'loading' | 'ready' | 'error'

function useGlazeCarouselMode() {
  const [mode, setMode] = useState({ flat: true, compact: true, reducedMotion: true })

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const compact = window.matchMedia('(max-width: 700px)')
    const update = () => {
      const lowEndPhone = window.innerWidth < 768 && (navigator.hardwareConcurrency || 2) <= 4
      const supports3D = typeof window.CSS !== 'undefined' && window.CSS.supports('transform-style', 'preserve-3d') && window.CSS.supports('perspective', '1px')
      setMode({ flat: reduce.matches || lowEndPhone || !supports3D, compact: compact.matches, reducedMotion: reduce.matches })
    }
    update()
    window.addEventListener('resize', update, { passive: true })
    reduce.addEventListener?.('change', update)
    compact.addEventListener?.('change', update)
    return () => {
      window.removeEventListener('resize', update)
      reduce.removeEventListener?.('change', update)
      compact.removeEventListener?.('change', update)
    }
  }, [])

  return mode
}

function GlazeCardContent({ slide, active }: { slide: GlazeSlide; active: boolean }) {
  const product = slide.kind === 'product' ? slide.product : null
  return (
    <>
      <div className="crunch-glazes__media">
        {product?.img ? (
          <Photo src={product.img} alt={product.name} draggable={false} />
        ) : (
          <div className="crunch-glazes__empty-media">
            <Flame aria-hidden="true" />
            <span>{product ? 'Image unavailable' : 'Placeholder'}</span>
          </div>
        )}
      </div>
      <div className="crunch-glazes__copy">
        <span className="crunch-glazes__card-label">
          {product ? 'Signature glaze' : 'Placeholder ' + String(slide.kind === 'placeholder' ? slide.number : '').padStart(2, '0')}
        </span>
        <h3 className="crunch-glazes__name">{product ? product.name : 'Details pending'}</h3>
        <p className="crunch-glazes__description">
          {product ? (product.description || 'Description unavailable.') : 'This is a placeholder. Glaze details are not available yet.'}
        </p>
        <div className="crunch-glazes__detail">
          {product?.spiceFlag === true && <Flame aria-hidden="true" />}
          <span>{product?.spiceFlag === true ? 'Marked spicy' : product?.spiceFlag === false ? 'Not marked spicy' : 'Heat details unavailable'}</span>
        </div>
        {product && ['unavailable', 'out of stock', 'not configured'].includes(product.availabilityStatus) && (
          <p className="crunch-glazes__availability">{product.availabilityStatus === 'not configured' ? 'Availability not configured' : 'Currently unavailable'}</p>
        )}
        <div className="crunch-glazes__action">
          {active && (
            <CrunchButton buttonId="glaze-menu" variant="glass" size="sm" onClick={() => { window.location.href = '/usersmenu?showOrderModal=true' }}>
              View the menu <span className="crunch-button__icon"><ArrowRight aria-hidden="true" /></span>
            </CrunchButton>
          )}
        </div>
      </div>
    </>
  )
}

function Carousel3D({ products, status }: { products: Product[]; status: ProductLoadStatus }) {
  const scene = useCrunchScene()
  const mode = useGlazeCarouselMode()
  const [selected, setSelected] = useState(0)
  const [rotationPaused, setRotationPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focusWithin, setFocusWithin] = useState(false)
  const [resumeWhileFocused, setResumeWhileFocused] = useState(false)
  const [inView, setInView] = useState(false)
  const [documentVisible, setDocumentVisible] = useState(true)
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef(0)
  const programmaticTarget = useRef<number | null>(null)
  const scrollTimer = useRef<number | null>(null)
  const mouseDrag = useRef<{ id: number; x: number; left: number; time: number } | null>(null)
  const lastWheel = useRef(-1000)
  const wheelDelta = useRef({ amount: 0, time: 0 })

  const slides = useMemo<GlazeSlide[]>(() => {
    if (status === 'loading') return []
    if (products.length) return products.map(product => ({ kind: 'product', product }))
    return Array.from({ length: 7 }, (_, index) => ({ kind: 'placeholder', number: index + 1 }))
  }, [products, status])
  const count = slides.length
  const activeIndex = count ? ((selected % count) + count) % count : 0
  const activeSlide = slides[activeIndex]
  const shouldRotate = !mode.flat && count > 1 && !rotationPaused && !hovered &&
    (!focusWithin || resumeWhileFocused) && inView && documentVisible

  useEffect(() => {
    const section = sectionRef.current
    const syncVisibility = () => setDocumentVisible(!document.hidden)
    syncVisibility()
    document.addEventListener('visibilitychange', syncVisibility)
    let observer: IntersectionObserver | null = null
    if (section && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(entries => setInView(entries.some(entry => entry.isIntersecting)), { threshold: 0 })
      observer.observe(section)
    } else {
      setInView(true)
    }
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', syncVisibility)
    }
  }, [])

  const findNearest = useCallback(() => {
    const track = trackRef.current
    if (!track) return 0
    const center = track.getBoundingClientRect().left + track.clientWidth / 2
    let closest = 0
    let distance = Infinity
    track.querySelectorAll<HTMLElement>('[data-glaze-index]').forEach((element) => {
      const rect = element.getBoundingClientRect()
      const nextDistance = Math.abs(rect.left + rect.width / 2 - center)
      if (nextDistance < distance) {
        distance = nextDistance
        closest = Number(element.dataset.glazeIndex)
      }
    })
    return closest
  }, [])

  const goTo = useCallback((index: number, smooth = true) => {
    if (!count) return
    const next = ((index % count) + count) % count
    activeRef.current = next
    setSelected(next)
    const track = trackRef.current
    if (!mode.flat || !track) return
    const target = track.querySelector<HTMLElement>('[data-glaze-index="' + next + '"]')
    if (!target) return
    programmaticTarget.current = next
    if (scrollTimer.current !== null) window.clearTimeout(scrollTimer.current)
    track.scrollTo({ left: target.offsetLeft + target.offsetWidth / 2 - track.clientWidth / 2, behavior: smooth && !mode.reducedMotion ? 'smooth' : 'auto' })
    scrollTimer.current = window.setTimeout(() => {
      programmaticTarget.current = null
      scrollTimer.current = null
      const nearest = findNearest()
      activeRef.current = nearest
      setSelected(nearest)
    }, smooth && !mode.reducedMotion ? 700 : 80)
  }, [count, findNearest, mode.flat, mode.reducedMotion])

  // Stop timers when the carousel is off-screen, the tab is hidden, or the user pauses.
  useEffect(() => {
    if (!shouldRotate) return
    const timer = window.setTimeout(() => goTo(activeRef.current + 1), 5200)
    return () => window.clearTimeout(timer)
  }, [activeIndex, goTo, shouldRotate])

  useEffect(() => {
    activeRef.current = activeIndex
    scene.state.current.activeSlide = activeIndex
    scene.state.current.activeGlazeColor = activeSlide?.kind === 'product' ? activeSlide.product.glazeColor : null
    return () => {
      scene.state.current.activeSlide = 0
      scene.state.current.activeGlazeColor = null
      if (scene.state.current.hoveredControl === 'glaze-card') scene.state.current.hoveredControl = null
    }
  }, [activeIndex, activeSlide, scene])

  useEffect(() => {
    if (mode.flat && count) goTo(activeRef.current, false)
    return () => {
      if (scrollTimer.current !== null) window.clearTimeout(scrollTimer.current)
      scrollTimer.current = null
      programmaticTarget.current = null
    }
  }, [count, goTo, mode.flat])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !count) return
    const onWheel = (event: WheelEvent) => {
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      if (mode.flat && horizontal && !event.shiftKey) return
      if (!horizontal && !event.shiftKey && document.activeElement !== stage) return
      const delta = (horizontal ? event.deltaX : event.deltaY) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerWidth : 1)
      if (!delta) return
      event.preventDefault()
      const now = performance.now()
      if (now - wheelDelta.current.time > 250) wheelDelta.current.amount = 0
      wheelDelta.current.time = now
      wheelDelta.current.amount += delta
      if (Math.abs(wheelDelta.current.amount) < 35 || now - lastWheel.current < 450) return
      const direction = wheelDelta.current.amount > 0 ? 1 : -1
      wheelDelta.current.amount = 0
      lastWheel.current = now
      setRotationPaused(true)
      setResumeWhileFocused(false)
      goTo(activeRef.current + direction)
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [count, goTo, mode.flat])

  const onTrackScroll = () => {
    if (programmaticTarget.current !== null) return
    const nearest = findNearest()
    if (nearest !== activeRef.current) {
      activeRef.current = nearest
      setSelected(nearest)
    }
  }

  // Keep only the active slide and visible neighbors in the 3D scene.
  const visible = count <= 1
    ? [{ index: activeIndex, offset: 0 }]
    : count === 2
      ? [{ index: activeIndex, offset: 0 }, { index: (activeIndex + 1) % count, offset: 1 }]
      : [
          { index: (activeIndex - 1 + count) % count, offset: -1 },
          { index: activeIndex, offset: 0 },
          { index: (activeIndex + 1) % count, offset: 1 },
        ]

  const markCardHovered = (event: React.PointerEvent<HTMLElement>, index: number) => {
    if (event.pointerType === 'touch' || index !== activeRef.current) return
    const bounds = event.currentTarget.getBoundingClientRect()
    scene.state.current.hoveredControl = 'glaze-card'
    scene.state.current.hoverX = bounds.left + bounds.width / 2
    scene.state.current.hoverY = bounds.top + bounds.height / 2
  }
  const clearCardHovered = () => {
    if (scene.state.current.hoveredControl === 'glaze-card') scene.state.current.hoveredControl = null
  }
  const slideKey = (slide: GlazeSlide) => slide.kind === 'product' ? 'product-' + slide.product.id : 'placeholder-' + slide.number
  const slideName = (slide: GlazeSlide) => slide.kind === 'product' ? slide.product.name : 'Placeholder ' + slide.number + ', details pending'
  const cardStyle = (slide: GlazeSlide): CSSProperties => ({
    '--crunch-card-accent': slide.kind === 'product' ? (slide.product.glazeColor || 'var(--crunch-accent)') : 'var(--crunch-accent)',
  } as CSSProperties)
  const browseTo = (index: number) => {
    setRotationPaused(true)
    setResumeWhileFocused(false)
    goTo(index)
  }
  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    let next: number | null = null
    if (event.key === 'ArrowRight') next = activeIndex + 1
    if (event.key === 'ArrowLeft') next = activeIndex - 1
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = count - 1
    if (next === null || !count) return
    event.preventDefault()
    if (event.target instanceof HTMLElement && event.target.closest('[data-glaze-index] button')) stageRef.current?.focus()
    browseTo(next)
  }

  return (
    <section
      ref={sectionRef}
      className="crunch-glazes"
      data-crunch-section="glazes"
      role="region"
      aria-roledescription="carousel"
      aria-labelledby="crunch-glazes-title"
      onKeyDown={onKeyDown}
      onPointerEnter={event => { if (event.pointerType !== 'touch') setHovered(true) }}
      onPointerLeave={event => { if (event.pointerType !== 'touch') setHovered(false) }}
      onFocusCapture={event => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return
        setFocusWithin(true)
        setResumeWhileFocused(false)
        if (event.target instanceof HTMLElement && event.target.matches(':focus-visible')) setRotationPaused(true)
      }}
      onBlurCapture={event => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return
        setFocusWithin(false)
        setResumeWhileFocused(false)
      }}
    >
      <div className="crunch-glazes__header">
        <div>
          <p className="crunch-glazes__eyebrow">The glaze collection</p>
          <h2 id="crunch-glazes-title" className="crunch-glazes__heading">A little more flavor.</h2>
        </div>
        <p className="crunch-glazes__intro">Explore the signature glazes available from our menu.</p>
      </div>
      {status === 'loading' ? (
        <div role="status" aria-label="Loading glaze details">
          <div className="crunch-glazes__loading" aria-hidden="true">
            <div className="crunch-glazes__loading-media" />
            <div className="crunch-glazes__loading-copy"><span className="crunch-glazes__loading-line" /><span className="crunch-glazes__loading-line" /><span className="crunch-glazes__loading-line" /></div>
          </div>
          <span className="crunch-glazes__sr-only">Loading glaze details.</span>
        </div>
      ) : (
        <>
          {!products.length && (
            <p className="crunch-glazes__notice" role="status">
              {status === 'error' ? 'Glaze details could not be loaded right now. ' : 'No glaze details were returned. '}
              The slides below are placeholders, not actual glaze names.
            </p>
          )}
          <span className="crunch-glazes__sr-only" aria-live={shouldRotate ? 'off' : 'polite'} aria-atomic="true">
            {activeSlide ? 'Slide ' + (activeIndex + 1) + ' of ' + count + ': ' + slideName(activeSlide) : ''}
          </span>
          {mode.flat ? (
            <div
              className="crunch-glazes__track"
              ref={(node) => { trackRef.current = node; stageRef.current = node }}
              tabIndex={0}
              aria-label="Glaze slides. Use left and right arrow keys to browse."
              onScroll={onTrackScroll}
              onPointerDown={(event) => {
                if (event.pointerType !== 'mouse' || (event.target instanceof Element && event.target.closest('button'))) return
                programmaticTarget.current = null
                if (scrollTimer.current !== null) window.clearTimeout(scrollTimer.current)
                scrollTimer.current = null
                mouseDrag.current = { id: event.pointerId, x: event.clientX, left: event.currentTarget.scrollLeft, time: performance.now() }
                event.currentTarget.dataset.dragging = 'true'
                event.currentTarget.setPointerCapture(event.pointerId)
                event.preventDefault()
              }}
              onPointerMove={(event) => {
                const drag = mouseDrag.current
                if (!drag || drag.id !== event.pointerId) return
                event.currentTarget.scrollLeft = drag.left - (event.clientX - drag.x)
              }}
              onPointerUp={(event) => {
                const drag = mouseDrag.current
                if (!drag || drag.id !== event.pointerId) return
                mouseDrag.current = null
                delete event.currentTarget.dataset.dragging
                const movement = event.clientX - drag.x
                const velocity = Math.abs(movement) / Math.max(performance.now() - drag.time, 1)
                const nearest = findNearest()
                goTo(velocity > 0.6 && Math.abs(movement) > 20 ? nearest + (movement < 0 ? 1 : -1) : nearest)
              }}
              onPointerCancel={(event) => { mouseDrag.current = null; delete event.currentTarget.dataset.dragging }}
              onLostPointerCapture={(event) => { mouseDrag.current = null; delete event.currentTarget.dataset.dragging }}
            >
              {slides.map((slide, index) => (
                <article className="crunch-glazes__card" key={slideKey(slide)} data-glaze-index={index} role="group" aria-roledescription="slide" aria-label={(index + 1) + ' of ' + count + ': ' + slideName(slide)} aria-hidden={index !== activeIndex} inert={index !== activeIndex} style={cardStyle(slide)} onPointerEnter={event => markCardHovered(event, index)} onPointerLeave={clearCardHovered}>
                  <GlazeCardContent slide={slide} active={index === activeIndex} />
                </article>
              ))}
            </div>
          ) : (
            <motion.div
              className="crunch-glazes__stage"
              ref={stageRef}
              tabIndex={0}
              aria-label="Glaze slides. Use left and right arrow keys to browse."
              drag={count > 1 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.12}
              dragMomentum={false}
              onDragStart={() => { setRotationPaused(true); setResumeWhileFocused(false) }}
              onDragEnd={(_, info) => {
                if (Math.abs(info.offset.x) < 40 && Math.abs(info.velocity.x) < 450) return
                const direction = (Math.abs(info.offset.x) >= 40 ? info.offset.x : info.velocity.x) < 0 ? 1 : -1
                const steps = Math.abs(info.velocity.x) > 1600 ? 2 : 1
                goTo(activeRef.current + direction * steps)
              }}
            >
              {visible.map(({ index, offset }) => {
                const slide = slides[index]
                if (!slide) return null
                return (
                  <motion.article
                    className="crunch-glazes__card"
                    key={slideKey(slide)}
                    data-glaze-index={index}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={(index + 1) + ' of ' + count + ': ' + slideName(slide)}
                    aria-hidden={offset !== 0}
                    inert={offset !== 0}
                    style={{ ...cardStyle(slide), zIndex: offset === 0 ? 3 : Math.abs(offset) === 1 ? 2 : 1 }}
                    onPointerEnter={event => markCardHovered(event, index)}
                    onPointerLeave={clearCardHovered}
                    initial={{
                      x: (offset * 108) + '%',
                      rotateY: offset * (mode.compact ? -14 : -25),
                      z: -Math.abs(offset) * (mode.compact ? 110 : 180),
                      scale: offset === 0 ? 1 : 0.84,
                      opacity: 0,
                    }}
                    animate={{
                      x: (offset * (mode.compact ? 87 : 88)) + '%',
                      rotateY: offset * (mode.compact ? -14 : -25),
                      z: -Math.abs(offset) * (mode.compact ? 110 : 180),
                      scale: offset === 0 ? 1 : Math.abs(offset) === 1 ? 0.92 : 0.84,
                      opacity: offset === 0 ? 1 : Math.abs(offset) === 1 ? 0.72 : 0,
                    }}
                    transition={{ duration: 0.78, ease: easeOut }}
                  >
                    <GlazeCardContent slide={slide} active={offset === 0} />
                  </motion.article>
                )
              })}
            </motion.div>
          )}
          <div className="crunch-glazes__controls" aria-label="Glaze carousel controls">
            {!mode.flat && count > 1 && (
              <CrunchButton
                buttonId="glaze-rotation"
                variant="ghost"
                size="sm"
                aria-label={rotationPaused ? 'Resume automatic rotation' : 'Pause automatic rotation'}
                onClick={() => {
                  setRotationPaused(!rotationPaused)
                  setResumeWhileFocused(rotationPaused)
                }}
              >
                <span className="crunch-button__icon">{rotationPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}</span>
                {rotationPaused ? 'Play' : 'Pause'}
              </CrunchButton>
            )}
            <CrunchButton buttonId="glaze-previous" variant="icon" size="sm" aria-label="Previous glaze" onClick={() => browseTo(activeIndex - 1)} disabled={count < 2}>
              <span className="crunch-button__icon"><ChevronLeft aria-hidden="true" /></span>
            </CrunchButton>
            <div className="crunch-glazes__dots" role="group" aria-label="Choose a glaze slide">
              {slides.map((slide, index) => (
                <CrunchButton key={slideKey(slide)} buttonId={'glaze-slide-' + index} variant="icon" size="sm" className="crunch-glazes__dot" aria-label={'Go to slide ' + (index + 1) + ': ' + slideName(slide)} aria-current={index === activeIndex ? 'true' : undefined} onClick={() => browseTo(index)}>
                  <span className="crunch-glazes__dot-mark" aria-hidden="true" />
                </CrunchButton>
              ))}
            </div>
            <CrunchButton buttonId="glaze-next" variant="icon" size="sm" aria-label="Next glaze" onClick={() => browseTo(activeIndex + 1)} disabled={count < 2}>
              <span className="crunch-button__icon"><ChevronRight aria-hidden="true" /></span>
            </CrunchButton>
            <span className="crunch-glazes__counter" aria-hidden="true">{String(activeIndex + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}</span>
          </div>
          <p className="crunch-glazes__help">{mode.flat ? 'Swipe or drag to browse.' : 'The carousel loops automatically. Swipe or drag to explore.'} Use the arrow keys when the carousel is focused.</p>
        </>
      )}
    </section>
  )
}

function OurStory() {
  return (
    <motion.section
      data-crunch-section="story"
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
    <footer data-crunch-section="footer" style={{ background: 'transparent', borderTop: '1px solid rgba(245,185,68,0.15)', padding: '48px 0 32px', marginTop: 60, position: 'relative', zIndex: 1 }}>
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
    } catch (error: unknown) {
      const message = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : ''
      setErr(message || 'Could not send your feedback. Try again.')
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
  const [productLoads, setProductLoads] = useState<{ first: ProductLoadStatus; second: ProductLoadStatus }>({ first: 'loading', second: 'loading' })
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const pageRef = useRef<HTMLDivElement>(null)
  const sceneState = useRef<CrunchSceneState>({
    pointerX: 0.5,
    pointerY: 0.5,
    hoveredControl: null,
    hoverX: 0,
    hoverY: 0,
    activeGlazeColor: null,
    activeSlide: 0,
    currentSection: 'hero',
    scrollProgress: 0,
  })
  const scene = useMemo<CrunchScene>(() => ({ root: pageRef, state: sceneState }), [])
  const userId = isAuthenticated && user && Number(user.userId) > 0 ? Number(user.userId) : null

  useInsertionEffect(() => {
    const style = document.createElement('style')
    style.dataset.crunchPage = 'true'
    style.textContent = CSS
    document.head.appendChild(style)
    return () => style.remove()
  }, [])

  useEffect(() => { void fetchGeneralSettings() }, [])

  useEffect(() => {
    let cancelled = false
    const load = <T,>(url: string, set: (d: T[]) => void, map?: (d: unknown[]) => T[]) =>
      api.get<unknown[]>(url)
        .then((d: unknown) => { if (!cancelled) { const r = Array.isArray(d) ? d : []; set(map ? map(r) : (r as T[])); setProductLoads(previous => ({ ...previous, first: Array.isArray(d) ? 'ready' : 'error' })) } })
        .catch(() => { if (!cancelled) setProductLoads(previous => ({ ...previous, first: 'error' })) })
        .finally(() => { })
    load<Product>('/api/products?item_type=menu_item', setProducts, mapProducts)
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    api.get<unknown[]>('/api/products?item_type=menu_item')
      .then((d: unknown) => { if (!cancelled) { const r = Array.isArray(d) ? d : []; setProducts(mapProducts(r)); setProductLoads(previous => ({ ...previous, second: Array.isArray(d) ? 'ready' : 'error' })) } })
      .catch(() => { if (!cancelled) setProductLoads(previous => ({ ...previous, second: 'error' })) })
      .finally(() => { })
    return () => { cancelled = true }
  }, [])

  const feedbackOptions = useMemo(() => products.filter(p => !p.archived).map(p => ({ id: p.id, name: p.name })), [products])
  const glazes = useMemo(() => products.filter(product => !product.archived && product.categorySystemKey === 'chicken_flavors'), [products])
  const productStatus: ProductLoadStatus = productLoads.first === 'ready' || productLoads.second === 'ready'
    ? 'ready'
    : productLoads.first === 'loading' || productLoads.second === 'loading' ? 'loading' : 'error'

  return (
    <CrunchSceneContext.Provider value={scene}>
      <div ref={pageRef} className="crunch-page">
        <CrunchAmbientBackground />
        <Navbar />
        <main className="crunch-main">
          <HeroSection />
          <Carousel3D products={glazes} status={productStatus} />
          <OurStory />
        </main>
        <Footer />
        <AnimatePresence>{feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} options={feedbackOptions} userId={userId} />}</AnimatePresence>
        <CrunchButton buttonId="feedback" variant="glass" size="sm" className="crunch-feedback" onClick={() => setFeedbackOpen(v => !v)}>
          <span className="crunch-button__icon"><MessageSquare aria-hidden="true" /></span>{feedbackOpen ? 'Close' : 'Feedback'}
        </CrunchButton>
      </div>
    </CrunchSceneContext.Provider>
  )
}