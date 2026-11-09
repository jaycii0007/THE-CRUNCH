/**
 * Products V2 — Premium Featured Selection Showcase
 * Section order: Navigation → Hero → WorksWheel → Featured Menu → Order Menu → Footer
 * Uses original WorksWheel (ring-to-drum) for Food Preview Gallery
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { api, resolveAssetUrl } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { WorksWheel, type WorksWheelItem } from "@/components/ui/works-wheel";
import { Crunch3DFooter } from "@/components/products-v2/Crunch3DFooter";
import { ProductsV2Layout } from "./ProductsV2Layout";
import { formatCurrencyAmount } from "@/lib/restaurantSettings";
import type { Product } from "./productv2.types";
import { motion } from "framer-motion";

// ── Design Tokens ────────────────────────────────────────────────────────────
const BLACK = '#1A1A1A';
const GOLD = '#C9A84C';
const GOLD_DARK = '#B8953A';
const GOLD_LIGHT = '#E8D4A0';
const CREAM = '#F5F0E8';
const CHARCOAL = '#282823';

const HERO_IMAGE_1 = '/img/signatureglazed1.webp';
const HERO_IMAGE_2 = '/img/signatureglazed2.webp';

// ── Helpers ──────────────────────────────────────────────────────────────────
const normCat = (v: unknown): string => String(v ?? "").trim();

const mapProducts = (data: unknown[]): Product[] =>
  (data as Record<string, unknown>[])
    .map((r) => {
      const rawImage = String(r?.image ?? r?.img ?? "").trim();
      const resolvedImg = rawImage ? resolveAssetUrl(rawImage) : "";
      return {
        id: Number(r?.id ?? r?.product_id ?? 0),
        name: String(r?.name ?? r?.product_name ?? "").trim(),
        category: normCat(r?.category),
        rating: Number(r?.rating ?? 0),
        badge: String(r?.badge ?? "").trim(),
        description: String(r?.description ?? "").trim(),
        price: Number(r?.price ?? 0),
        spicy: Boolean(r?.spicy),
        img: resolvedImg,
        archived: String(r?.availability_status ?? r?.availabilityStatus ?? "")
          .trim()
          .toLowerCase() === "hidden",
      };
    })
    .filter((p) => p.id > 0 && p.name);

// ── Photo Component ──────────────────────────────────────────────────────────
function Photo({ src, alt, priority = false, style }: { src?: string; alt: string; priority?: boolean; style?: React.CSSProperties }) {
  const [bad, setBad] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBad(() => false);
    setLoading(() => true);
  }, [src]);

  if (!src || bad) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          color: '#7A756B',
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
    );
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
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        onError={() => { setBad(true); setLoading(false); }}
        onLoad={() => { setLoading(false); }}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: loading ? 0 : 1,
          transition: 'opacity 0.4s ease-out',
          ...style
        }}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer { to { background-position: -200% 0; } }
      `}} />
    </>
  );
}

// ── Signature Glazed Chicken Hero (from products.tsx) ───────────────────────
function HeroSection() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    const checkReduceMotion = () => setReduceMotion(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
    checkMobile();
    checkReduceMotion();
    window.addEventListener('resize', checkMobile);
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener?.('change', checkReduceMotion);
    return () => {
      window.removeEventListener('resize', checkMobile);
      mq.removeEventListener?.('change', checkReduceMotion);
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isMobile || reduceMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setMousePos({ x, y });
  }, [isMobile, reduceMotion]);

  const handleMouseLeave = useCallback(() => {
    if (isMobile || reduceMotion) return;
    setMousePos({ x: 0, y: 0 });
  }, [isMobile, reduceMotion]);

  const easeOut = [0.16, 1, 0.3, 1] as const;

  // Mobile View (< 768px): Clean layout — zero overlapping, professional hierarchy
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
            {/* Primary Hero Image */}
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

            {/* Subtle gradient overlay for depth */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(180deg, rgba(10,10,10,0.2) 0%, transparent 45%, rgba(10,10,10,0.7) 100%)',
                pointerEvents: 'none',
              }}
            />

            {/* Gold corner brackets */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: 24, height: 24, borderTop: `2px solid ${GOLD}80`, borderLeft: `2px solid ${GOLD}80`, borderRadius: '16px 0 0 0', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 0, right: 0, width: 24, height: 24, borderTop: `2px solid ${GOLD}80`, borderRight: `2px solid ${GOLD}80`, borderRadius: '0 16px 0 0', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: 24, height: 24, borderBottom: `2px solid ${GOLD}50`, borderLeft: `2px solid ${GOLD}50`, borderRadius: '0 0 0 16px', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderBottom: `2px solid ${GOLD}50`, borderRight: `2px solid ${GOLD}50`, borderRadius: '0 0 16px 0', pointerEvents: 'none' }} />

            {/* "Hand-Glazed" Badge */}
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

            {/* Supporting View Inset Thumbnail */}
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <span>Explore Menu</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
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
              { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>, text: '7 Signature Glazes' },
              { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10"/></svg>, text: '250+ Branches Nationwide' },
              { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, text: 'Fresh Daily, Never Frozen' },
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
                <span style={{ color: GOLD, flexShrink: 0 }}>{badge.icon}</span>
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
    );
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

      {/* Layer 5: Content - Text, CTA, Trust badges */}
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
              marginBottom: 'clamp(16px, 2.5vw, 24px)',
              fontFamily: 'Poppins, Inter, system-ui, sans-serif',
              textShadow: `0 4px 40px rgba(0,0,0,0.5)`,
            }}
          >
            <span style={{ display: 'block', color: CREAM, fontWeight: 800, letterSpacing: '-0.03em' }}>SIGNATURE</span>
            <span style={{ display: 'block', color: GOLD, marginTop: '-0.04em', fontWeight: 800, letterSpacing: '-0.03em' }}>GLAZED</span>
            <span style={{ display: 'block', color: CREAM, opacity: 0.92, fontWeight: 800, fontSize: 'clamp(30px, 6vw, 62px)', marginTop: '-0.015em', letterSpacing: '-0.03em' }}>CHICKEN</span>
          </motion.h2>

          {/* Supporting description */}
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

          {/* Explore Menu CTA - Gold button */}
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
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <span>Explore Menu</span>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
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
            gap: 'clamp(8px, 1.2vw, 12px)',
            marginTop: 'clamp(24px, 4vw, 32px)',
            paddingTop: 'clamp(16px, 3vw, 24px)',
            borderTop: `1px solid ${GOLD}18`,
          }}
        >
          {[
            { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>, text: '7 Signature Glazes' },
            { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10"/></svg>, text: '250+ Branches Nationwide' },
            { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, text: 'Fresh Daily, Never Frozen' },
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
                e.currentTarget.style.borderColor = `${GOLD}60`;
                e.currentTarget.style.color = GOLD_LIGHT;
                e.currentTarget.style.background = `rgba(201,168,76,0.12)`;
                e.currentTarget.style.boxShadow = `0 0 24px -4px ${GOLD}25`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `${GOLD}25`;
                e.currentTarget.style.color = `rgba(245,240,232,0.8)`;
                e.currentTarget.style.background = `rgba(26,26,26,0.8)`;
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span style={{ color: GOLD }}>{badge.icon}</span>
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
  );
}

// ── Featured Menu — Vertical Poster Grid (from products.tsx) ───────────────
function FeaturedMenuSection({ products }: { products: Product[] }) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const featuredProducts = products.filter(p => !p.archived && p.img).slice(0, 3);

  if (featuredProducts.length === 0) return null;

  return (
    <section className="featured-menu-section" style={{ marginTop: '60px' }}>
      <div className="featured-menu-header">
        <div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="h2"
            style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1, margin: 0, color: '#F5E8B6' }}
          >
            Featured Menu
          </motion.h2>
          <p className="sub" style={{ marginTop: '8px', fontSize: 'clamp(13px, 1.5vw, 14.5px)', color: 'rgba(245,240,232,0.58)' }}>
            Our most popular signature glazes, hand-selected for you
          </p>
        </div>
      </div>

      <motion.div
        className="featured-menu-grid"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={{ marginTop: '8px' }}
      >
        {featuredProducts.map((p, index) => (
          <motion.article
            key={p.id}
            className="featured-menu-card"
            variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] } }}}
            initial="hidden"
            animate="show"
            whileHover={!isMobile ? {
              y: -8,
              scale: 1.02,
              boxShadow: '0 24px 64px -16px rgba(0,0,0,0.65), 0 0 0 1px rgba(201,168,76,0.35), 0 0 32px -8px rgba(201,168,76,0.15)',
              borderColor: 'rgba(201, 168, 76, 0.5)',
              transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
            } : {}}
          >
            <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '380px' }}>
              <Photo
                src={p.img}
                alt={p.name}
                priority
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center top',
                }}
              />
              {/* Vignette for depth */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(ellipse at center, transparent 40%, rgba(11,10,8,0.35) 100%)',
                  pointerEvents: 'none',
                }}
              />
              {/* Bottom gradient fade for text legibility */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '60%',
                  background: 'linear-gradient(180deg, transparent 0%, rgba(11,10,8,0.4) 30%, rgba(11,10,8,0.85) 60%, rgba(11,10,8,0.98) 100%)',
                  pointerEvents: 'none',
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
                }}
              />

              {/* Badge - floating top left */}
              {p.badge && (
                <motion.span
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
                    background: `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
                    color: '#15120a',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}
                  initial={{ opacity: 0, y: -20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                  {p.badge}
                </motion.span>
              )}

              {/* Spicy indicator */}
              {p.spicy && (
                <span
                  style={{
                    position: 'absolute',
                    top: 18,
                    right: 18,
                    zIndex: 10,
                    background: 'rgba(0,0,0,0.7)',
                    borderRadius: '50%',
                    width: 28,
                    height: 28,
                    display: 'grid',
                    placeItems: 'center',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  aria-label="Spicy level"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 1 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 1 2.5 2.5z"/></svg>
                </span>
              )}

              {/* Accent corner brackets */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: 60, height: 60, borderTop: '2px solid rgba(245,200,66,0.25)', borderLeft: '2px solid rgba(245,200,66,0.25)', borderRadius: '16px 0 0 0', pointerEvents: 'none', zIndex: 5 }} />
              <div style={{ position: 'absolute', top: 0, right: 0, width: 60, height: 60, borderTop: '2px solid rgba(245,200,66,0.25)', borderRight: '2px solid rgba(245,200,66,0.25)', borderRadius: '0 16px 0 0', pointerEvents: 'none', zIndex: 5 }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: 60, height: 60, borderBottom: '2px solid rgba(245,200,66,0.15)', borderLeft: '2px solid rgba(245,200,66,0.15)', borderRadius: '0 0 0 16px', pointerEvents: 'none', zIndex: 5 }} />
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 60, height: 60, borderBottom: '2px solid rgba(245,200,66,0.15)', borderRight: '2px solid rgba(245,200,66,0.15)', borderRadius: '0 0 16px 0', pointerEvents: 'none', zIndex: 5 }} />

              {/* Content overlay at bottom */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: 'clamp(16px, 3vw, 24px)',
                  zIndex: 6,
                }}
              >
                <h3 style={{ fontSize: 'clamp(18px, 2.2vw, 21px)', fontWeight: 700, lineHeight: 1.2, margin: 0, color: CREAM }}>{p.name}</h3>
                <p style={{ fontSize: 'clamp(13px, 1.6vw, 14.5px)', fontWeight: 500, color: GOLD, margin: '8px 0 0' }}>{p.category}</p>
                <p style={{ fontSize: 'clamp(13px, 1.6vw, 14.5px)', lineHeight: 1.55, margin: '12px 0 0', color: 'rgba(245,240,232,0.85)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</p>
                <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 'clamp(16px, 1.8vw, 19px)', fontWeight: 800, color: CREAM, letterSpacing: '-0.02em' }}>{formatCurrencyAmount(p.price)}</span>
                  <button
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '12px 20px',
                      fontSize: 'clamp(13px, 1.6vw, 14.5px)',
                      fontWeight: 600,
                      borderRadius: 12,
                      background: `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
                      color: '#15120a',
                      border: 'none',
                      boxShadow: '0 4px 16px rgba(245,200,66,0.3)',
                      cursor: 'pointer',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                    Order Now
                  </button>
                </div>
              </div>
            </div>
          </motion.article>
        ))}
      </motion.div>

      <style dangerouslySetInnerHTML={{ __html: `
        .featured-menu-section { width: 100%; max-width: 1050px; margin: 60px auto 0; box-sizing: border-box; }
        .featured-menu-header { display: flex; align-items: center; justify-content: flex-start; margin-bottom: 24px; }
        .featured-menu-grid { display: grid; grid-template-columns: 1fr; gap: 20px; width: 100%; justify-content: center; justify-items: center; align-items: start; box-sizing: border-box; }
        .featured-menu-card { width: min(100%, 320px); max-width: 320px; border-radius: 14px; overflow: hidden; background: #1A1A1A; border: 1px solid rgba(201, 168, 76, 0.28); box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.65), 0 2px 6px -1px rgba(0, 0, 0, 0.4); display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; position: relative; transition: transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 300ms cubic-bezier(0.2, 0.8, 0.2, 1), border-color 300ms cubic-bezier(0.2, 0.8, 0.2, 1); }
        .featured-menu-card img { display: block; width: 100%; height: auto; max-width: 100%; max-height: 460px; object-fit: contain; object-position: center; }
        @media (min-width: 700px) and (max-width: 1099px) { .featured-menu-grid { grid-template-columns: repeat(2, minmax(0, 300px)); gap: 24px; justify-content: center; justify-items: center; } .featured-menu-card { width: 100%; max-width: 300px; } .featured-menu-card:nth-child(3) { grid-column: 1 / -1; justify-self: center; } }
        @media (min-width: 1100px) { .featured-menu-grid { grid-template-columns: repeat(3, minmax(260px, 300px)); gap: 24px; justify-content: center; justify-items: center; } .featured-menu-card { width: 100%; max-width: 300px; } .featured-menu-card:nth-child(3) { grid-column: auto; justify-self: stretch; } }
        @media (hover: hover) and (pointer: fine) { .featured-menu-card:hover { transform: translateY(-4px) scale(1.012); box-shadow: 0 16px 36px -6px rgba(0, 0, 0, 0.75), 0 0 18px 0 rgba(201, 168, 76, 0.22); border-color: rgba(201, 168, 76, 0.55); } }
        @media (prefers-reduced-motion: reduce) { .featured-menu-card, .featured-menu-card:hover { transform: none !important; transition: none !important; } }
      `}} />
    </section>
  );
}

// ── Order Menu — Product Grid (from products.tsx) ──────────────────────────
function OrderMenuSection({ products, onOrder }: { products: Product[]; onOrder: (product: Product) => void }) {
  const availableProducts = products.filter(p => !p.archived);

  if (availableProducts.length === 0) return null;

  return (
    <section style={{ marginTop: '80px', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1, margin: 0, color: '#F5E8B6' }}
        >
          Order Menu
        </motion.h2>
      </div>

      <motion.div
        className="grid"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{ marginTop: '8px' }}
      >
        {availableProducts.map((p, index) => (
          <motion.article
            key={p.id}
            className="card"
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] } }}}
            initial="hidden"
            animate="show"
            whileHover={{
              y: -4,
              boxShadow: '0 12px 32px -8px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.25)',
              borderColor: 'rgba(233,190,95,0.45)',
              transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
            }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="thumb">
              <Photo src={p.img} alt={p.name} />
              {p.badge && (
                <span className="chip chip-gold" style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 9999, boxShadow: '0 2px 8px rgba(245,200,66,0.3)' }}>
                  {p.badge}
                </span>
              )}
              {p.spicy && (
                <span style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, background: 'rgba(0,0,0,0.7)', borderRadius: '50%', width: 26, height: 26, display: 'grid', placeItems: 'center', border: '1px solid rgba(255,255,255,0.1)' }} aria-label="Spicy level">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 1 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 1 2.5 2.5z"/></svg>
                </span>
              )}
              {p.rating > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.2 }} style={{ position: 'absolute', bottom: 8, left: 8, zIndex: 2, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 7px', background: 'rgba(11,10,8,0.85)', borderRadius: 9999, border: '1px solid rgba(245,200,66,0.25)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill={GOLD} color={GOLD}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 7 8.26 12 2"/></svg>
                  <span style={{ fontSize: 11, fontWeight: 600, color: GOLD }}>{p.rating.toFixed(1)}</span>
                </motion.div>
              )}
            </div>
            <div style={{ padding: 'clamp(10px, 1.8vw, 14px)', display: 'flex', flexDirection: 'column', gap: 6, flex: 1, justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: 'clamp(14px, 1.5vw, 16px)', fontWeight: 700, lineHeight: 1.3, color: CREAM, letterSpacing: '-0.01em', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {p.name}
                </h3>
                {p.description && (
                  <p style={{ fontSize: 'clamp(11.5px, 1.3vw, 13px)', lineHeight: 1.4, color: 'rgba(245,240,232,0.58)', marginTop: 4, marginBottom: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {p.description}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginTop: 6, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 'clamp(16px, 1.8vw, 19px)', fontWeight: 800, color: CREAM, letterSpacing: '-0.02em' }}>
                  {formatCurrencyAmount(p.price)}
                </span>
                <button
                  className="btn btn-gold"
                  onClick={() => onOrder(p)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '7px 12px',
                    fontSize: 'clamp(11.5px, 1.3vw, 13px)',
                    fontWeight: 600,
                    borderRadius: 8,
                    background: `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
                    color: '#15120a',
                    border: 'none',
                    boxShadow: '0 2px 10px rgba(245,200,66,0.25)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  aria-label={`Order ${p.name}`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                  <span>Order Now</span>
                </button>
              </div>
            </div>
          </motion.article>
        ))}
      </motion.div>

      <style dangerouslySetInnerHTML={{ __html: `
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 18px; width: 100%; }
        @media (min-width: 1280px) { .grid { grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; } }
        @media (min-width: 768px) and (max-width: 1023px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; } }
        @media (min-width: 360px) and (max-width: 767px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; } }
        @media (max-width: 359px) { .grid { grid-template-columns: 1fr; gap: 12px; max-width: 320px; margin: 0 auto; } }
        .card { background: ${BLACK}; border: 1px solid rgba(89,92,86,0.25); border-radius: 14px; overflow: hidden; transition: border-color .2s, transform .2s; display: flex; flex-direction: column; }
        .card:hover { border-color: rgba(233,190,95,.45); transform: translateY(-4px); }
        .thumb { position: relative; aspect-ratio: 16/10; max-height: 200px; background: #1f1d1a; overflow: hidden; }
        .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .chip { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: rgba(89,92,86,0.3); color: rgba(245,240,232,0.58); }
        .chip-gold { background: ${GOLD}; color: ${CHARCOAL}; }
        .btn { border: 0; border-radius: 10px; padding: 9px 18px; font-size: 13px; font-weight: 600; cursor: pointer; transition: transform .15s, opacity .15s; }
        .btn:active { transform: scale(.97); }
        .btn-gold { background: ${GOLD}; color: ${CHARCOAL}; }
        .btn-gold:hover { background: ${GOLD_DARK}; }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
      `}} />
    </section>
  );
}

// ── Food Preview Gallery — Original WorksWheel ──────────────────────────────
function FoodPreviewGallery({ products }: { products: Product[] }) {
  const wheelItems = useMemo((): WorksWheelItem[] => {
    return products
      .filter((p) => !p.archived && p.img)
      .slice(0, 12)
      .map((p) => ({
        title: p.name,
        image: p.img,
        category: p.category || undefined,
        href: `/usersmenu?showOrderModal=true&product=${p.id}`,
      }));
  }, [products]);

  if (wheelItems.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          width: '100%',
          minHeight: '420px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          padding: '2rem',
          textAlign: 'center',
          color: '#F5F2EA',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', fontWeight: 600 }}>
          No featured products available
        </h2>
        <p style={{ margin: 0, color: '#A69C8E', maxWidth: '400px' }}>
          Products with images will appear here automatically
        </p>
      </motion.div>
    );
  }

  return (
    <motion.section
      style={{
        width: '100%',
        marginTop: '60px',
        marginBottom: '20px',
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <motion.span
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: `linear-gradient(135deg, ${GOLD}1A 0%, ${GOLD}08 100%)`,
            border: `1px solid ${GOLD}40`,
            padding: '7px 14px',
            borderRadius: 999,
            fontSize: 'clamp(11px, 1.5vw, 13px)',
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
              boxShadow: `0 0 8px ${GOLD}`,
            }}
          />
          Food Preview Gallery
        </motion.span>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontSize: 'clamp(28px, 4vw, 36px)',
            fontWeight: 800,
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
            margin: 0,
            color: '#F5E8B6',
          }}
        >
          Explore Our Selection
        </motion.h2>
      </div>

      {/* Original WorksWheel — Ring-to-Drum Carousel */}
      <div style={{ width: '100%', minHeight: '520px', position: 'relative' }}>
        <WorksWheel
          items={wheelItems}
          label="Food Preview Gallery"
          action="Order"
          onActiveChange={() => {
            // Optional: sync with other components
          }}
        />
      </div>
    </motion.section>
  );
}

// ── Main Products V2 Page ────────────────────────────────────────────────────
export default function ProductsV2Page() {
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "empty" | "ready">("loading");

  const fetchProducts = useCallback(async () => {
    try {
      setStatus("loading");
      const productsData = await api.get<unknown[]>("/products");
      const mapped = mapProducts(productsData);
      setProducts(mapped);
      setStatus(mapped.length === 0 ? "empty" : "ready");
    } catch (err) {
      console.error("Failed to load products:", err);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProducts();
  }, [fetchProducts]);

  const handleOrder = useCallback((product: Product) => {
    window.location.href = `/usersmenu?showOrderModal=true&product=${product.id}`;
  }, []);

  // Loading state
  if (status === "loading") {
    return (
      <ProductsV2Layout>
        <Navbar />
        <HeroSection />
        <FoodPreviewGallery products={[]} />
        <FeaturedMenuSection products={[]} />
        <OrderMenuSection products={[]} onOrder={handleOrder} />
        <Crunch3DFooter />
      </ProductsV2Layout>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <ProductsV2Layout>
        <Navbar />
        <HeroSection />
        <motion.div
          style={{
            width: '100%',
            minHeight: '420px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.5rem',
            padding: '2rem',
            textAlign: 'center',
            color: '#F5F2EA',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <h2 style={{ margin: 0, fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', fontWeight: 600 }}>
            Unable to load featured products
          </h2>
          <p style={{ margin: 0, color: '#A69C8E', maxWidth: '400px' }}>
            Please check your connection and try again
          </p>
          <button
            onClick={fetchProducts}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 2rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#000000',
              background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_LIGHT} 100%)`,
              border: 'none',
              borderRadius: '999px',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </motion.div>
        <FeaturedMenuSection products={[]} />
        <OrderMenuSection products={[]} onOrder={handleOrder} />
        <Crunch3DFooter />
      </ProductsV2Layout>
    );
  }

  // Empty state
  if (status === "empty") {
    return (
      <ProductsV2Layout>
        <Navbar />
        <HeroSection />
        <FoodPreviewGallery products={[]} />
        <FeaturedMenuSection products={[]} />
        <OrderMenuSection products={[]} onOrder={handleOrder} />
        <Crunch3DFooter />
      </ProductsV2Layout>
    );
  }

  // Ready state - Full page with all sections
  return (
    <ProductsV2Layout
      header={<HeroSection />}
      footer={<Crunch3DFooter />}
    >
      <Navbar />
      <FoodPreviewGallery products={products} />
      <FeaturedMenuSection products={products} />
      <OrderMenuSection products={products} onOrder={handleOrder} />
    </ProductsV2Layout>
  );
}