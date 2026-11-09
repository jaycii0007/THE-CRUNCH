"use client";

/**
 * WorksWheel — "The Flavor Dial"
 * A premium vertical 3D product wheel with synchronized ambient lighting,
 * orbital guides, editorial title block, and precision selection rail.
 *
 * All visual systems driven by a single continuous `turnProgress` value.
 */
import * as React from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { WHEEL_COLORS } from "@/lib/design-tokens";

export interface WorksWheelItem {
  title: string;
  image: string;
  href?: string;
  category?: string;
}

export interface WorksWheelProps extends Omit<
  React.ComponentPropsWithoutRef<"section">,
  "children"
> {
  items: WorksWheelItem[];
  label?: string;
  action?: string;
  onActiveChange?: (turnProgress: number, activeIndex: number) => void;
}

/* ──────────────────────────────────────────────────────────────────────────
   GEOMETRY CONSTANTS — tuned for premium composition
   ────────────────────────────────────────────────────────────────────────── */
const CARD_H = 0.44;      // front card height as fraction of stage height
const CARD_MAX_W = 0.38;  // max card width as fraction of stage width
const CARD_RATIO = 1.52;  // card width / height (slightly more cinematic)
const STEP = 36;          // degrees between cards on drum
const DRUM = 1.95;        // drum radius in card heights (closer = more visible neighbours)
const LENS = 2.4;         // perspective distance
const RING_R = 1.08;      // ring radius
const BOW = 1.55;         // arc bow radius
const TITLE = 0.105;      // ring label size factor
const INDEX = 0.07;       // index font size factor
const CULL = 2.0;         // visibility threshold (show more neighbours)

const WHEEL_UNITS = 900;
const DRAG_UNITS = 420;
const SETTLE = 140;
const EASE = 0.12;        // frame interpolation factor

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Stage = { w: number; h: number };
const rad = (deg: number) => (deg * Math.PI) / 180;

const bowAt = (drumDeg: number, bow: number) =>
  -bow * (1 - Math.cos(rad(drumDeg)));

function place(
  ringDeg: number,
  drumDeg: number,
  ringR: number,
  drumR: number,
  bow: number,
  m: number,
) {
  return (
    `translateX(${m * bowAt(drumDeg, bow)}px)` +
    ` rotateZ(${(1 - m) * ringDeg}deg) translateY(${-(1 - m) * ringR}px)` +
    ` rotateX(${m * drumDeg}deg) translateZ(${m * drumR}px)`
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   METRICS TYPE — explicit typing for useMemo return
   ────────────────────────────────────────────────────────────────────────── */
interface WheelMetrics {
  cardW: number;
  cardH: number;
  ringR: number;
  ringScale: number;
  drumR: number;
  bow: number;
  depth: number;
  title: number;
  index: number;
}

/* ──────────────────────────────────────────────────────────────────────────
   IMAGE COMPONENT — loading shimmer, polished fallback, no broken icon
   ────────────────────────────────────────────────────────────────────────── */
function WheelImage({ src, alt }: { src: string; alt: string }) {
  const [state, setState] = React.useState<{ loading: boolean; error: boolean }>({
    loading: true,
    error: false,
  });

  React.useEffect(() => {
    setState({ loading: true, error: false });
  }, [src]);

  if (state.error) {
    return (
      <div
        role="img"
        aria-label={`${alt} — image not available`}
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          background: WHEEL_COLORS.cardSurface,
          color: WHEEL_COLORS.mutedDim,
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 17" />
        </svg>
      </div>
    );
  }

  return (
    <>
      {state.loading && (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, #0D0D0D 25%, #131313 50%, #0D0D0D 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.6s ease-in-out infinite',
            position: 'absolute',
            inset: 0,
            zIndex: 1,
          }}
        />
      )}
      <img
        src={src}
        alt={alt}
        draggable={false}
        onError={() => setState({ loading: false, error: true })}
        onLoad={() => setState({ loading: false, error: false })}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: state.loading ? 0 : 1,
          transition: 'opacity 0.5s ease-out',
        }}
      />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   ORBITAL GUIDES — two elliptical rings behind the wheel
   ────────────────────────────────────────────────────────────────────────── */
interface OrbitalGuidesProps {
  metrics: WheelMetrics;
  stage: Stage;
  turnProgress: number;
  activeIndex: number;
  reduced: boolean;
}

function OrbitalGuides({ metrics, stage, turnProgress, activeIndex, reduced }: OrbitalGuidesProps) {
  const { drumR } = metrics;
  const ring1Radius = drumR * 1.15;
  const ring2Radius = drumR * 1.35;
  const centerX = stage.w / 2;
  const centerY = stage.h / 2;

  // Subtle rotation tied to wheel progress
  const ring1Rotation = (turnProgress * 15) % 360;
  const ring2Rotation = -(turnProgress * 10) % 360;

  // Pulse intensity based on active card proximity
  const pulsePhase = (turnProgress - Math.floor(turnProgress)) * Math.PI * 2;
  const pulse1 = 0.5 + 0.5 * Math.sin(pulsePhase);
  const pulse2 = 0.5 + 0.5 * Math.cos(pulsePhase);

  if (reduced) return null;

  return (
    <React.Fragment>
      {/* Inner orbital guide */}
      <div
        style={{
          position: 'absolute',
          left: centerX - ring1Radius,
          top: centerY - ring1Radius * 0.35,
          width: ring1Radius * 2,
          height: ring1Radius * 0.7,
          border: `1px solid ${WHEEL_COLORS.orbital}`,
          borderRadius: '50%',
          opacity: 0.3 + 0.2 * pulse1,
          transform: `rotate(${ring1Rotation}deg)`,
          transformOrigin: 'center',
          pointerEvents: 'none',
          zIndex: 0,
          transition: 'opacity 0.3s ease',
        }}
        aria-hidden="true"
      />
      {/* Outer orbital guide */}
      <div
        style={{
          position: 'absolute',
          left: centerX - ring2Radius,
          top: centerY - ring2Radius * 0.3,
          width: ring2Radius * 2,
          height: ring2Radius * 0.6,
          border: `1px solid ${WHEEL_COLORS.orbital}`,
          borderRadius: '50%',
          opacity: 0.2 + 0.15 * pulse2,
          transform: `rotate(${ring2Rotation}deg)`,
          transformOrigin: 'center',
          pointerEvents: 'none',
          zIndex: 0,
          transition: 'opacity 0.3s ease',
        }}
        aria-hidden="true"
      />
      {/* Active position highlight on inner ring */}
      <div
        style={{
          position: 'absolute',
          left: centerX - ring1Radius,
          top: centerY - ring1Radius * 0.35,
          width: ring1Radius * 2,
          height: ring1Radius * 0.7,
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 1,
          background: `conic-gradient(from ${-90 + (activeIndex * STEP)}deg, transparent 0%, ${WHEEL_COLORS.orbitalActive} 25%, ${WHEEL_COLORS.orbitalActive} 35%, transparent 40%)`,
          opacity: 0.4,
          filter: 'blur(1px)',
          transition: 'opacity 0.4s ease',
        }}
        aria-hidden="true"
      />
    </React.Fragment>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   AMBIENT SPOTLIGHT — follows active card, creates depth
   ────────────────────────────────────────────────────────────────────────── */
interface AmbientSpotlightProps {
  stage: Stage;
  metrics: WheelMetrics;
  turnProgress: number;
  activeIndex: number;
  reduced: boolean;
}

function AmbientSpotlight({ stage, metrics, turnProgress, activeIndex, reduced }: AmbientSpotlightProps) {
  const { cardH } = metrics;
  const centerX = stage.w / 2;
  const centerY = stage.h / 2;

  // Calculate active card position in 3D space
  const pos = Math.max(0, turnProgress - 1);
  const activeDrumDeg = (activeIndex - pos) * STEP;
  const bowOffset = bowAt(activeDrumDeg, cardH * BOW);

  // Spotlight follows the active card horizontally
  const spotlightX = centerX + bowOffset * 0.6;
  const spotlightY = centerY - cardH * DRUM * 0.15;
  const spotlightRadius = Math.max(stage.w, stage.h) * 0.7;

  if (reduced) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: spotlightX - spotlightRadius,
        top: spotlightY - spotlightRadius * 0.5,
        width: spotlightRadius * 2,
        height: spotlightRadius,
        pointerEvents: 'none',
        zIndex: 0,
        background: `radial-gradient(ellipse 60% 40% at center, ${WHEEL_COLORS.spotlightStrong} 0%, ${WHEEL_COLORS.spotlight} 40%, transparent 70%)`,
        opacity: 0.6,
        filter: 'blur(60px)',
        transform: `translateX(${Math.sin(turnProgress * 0.5) * 20}px)`,
        transition: 'transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease',
      }}
      aria-hidden="true"
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   PEDESTAL — subtle platform beneath active card
   ────────────────────────────────────────────────────────────────────────── */
interface PedestalProps {
  metrics: WheelMetrics;
  stage: Stage;
  turnProgress: number;
  activeIndex: number;
  reduced: boolean;
}

function Pedestal({ metrics, stage, turnProgress, activeIndex, reduced }: PedestalProps) {
  const { cardW, cardH } = metrics;
  const centerX = stage.w / 2;
  const centerY = stage.h / 2;

  const pos = Math.max(0, turnProgress - 1);
  const activeDrumDeg = (activeIndex - pos) * STEP;
  const bowOffset = bowAt(activeDrumDeg, cardH * BOW);

  const pedestalX = centerX + bowOffset * 0.6;
  const pedestalY = centerY + cardH * 0.35;
  const pedestalWidth = cardW * 0.9;
  const pedestalHeight = 8;

  if (reduced) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: pedestalX - pedestalWidth / 2,
        top: pedestalY,
        width: pedestalWidth,
        height: pedestalHeight,
        pointerEvents: 'none',
        zIndex: 5,
        borderRadius: '999px',
        background: `linear-gradient(90deg, transparent, ${WHEEL_COLORS.pedestalActive} 20%, ${WHEEL_COLORS.pedestalActive} 80%, transparent)`,
        boxShadow: `0 0 30px 5px ${WHEEL_COLORS.glow}`,
        opacity: 0.7,
        filter: 'blur(2px)',
        transform: `scaleX(${0.8 + 0.2 * Math.sin(turnProgress * Math.PI)})`,
        transition: 'opacity 0.4s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      aria-hidden="true"
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   CARD COMPONENT — premium styling with active-state glow
   ────────────────────────────────────────────────────────────────────────── */
interface WheelCardProps {
  item: WorksWheelItem;
  index: number;
  metrics: WheelMetrics;
  turnProgress: number;
  isActive: boolean;
  to: (n: number) => void;
  reduced: boolean;
}

function WheelCard({ item, index, metrics, turnProgress, isActive, to, reduced }: WheelCardProps) {
  const { cardW, cardH } = metrics;
  const pos = Math.max(0, turnProgress - 1);
  const d = index - pos;

  // Active card gets enhanced styling
  const borderColor = isActive ? WHEEL_COLORS.cardBorderStrong : WHEEL_COLORS.cardBorder;
  const shadowIntensity = isActive ? 1 : 0.4;

  // Scale factor for active card (subtle emphasis)
  const activeScale = isActive ? 1.02 : 1;

  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      id={`works-wheel-${index}`}
      onClick={() => to(index + 1)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); to(index + 1); } }}
      style={{
        width: cardW,
        height: cardH,
        marginLeft: -cardW / 2,
        marginTop: -cardH / 2,
        position: 'absolute',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        transformOrigin: 'center center',
        zIndex: Math.round(100 - Math.abs(d) * 2),
        opacity: Math.abs(d) > CULL ? 0 : 1,
        transition: 'opacity 0.3s ease, z-index 0s',
      }}
      className="group"
    >
      <span
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          background: WHEEL_COLORS.cardSurface,
          border: `1px solid ${borderColor}`,
          borderRadius: '16px',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: `
            0 ${24 * shadowIntensity}px ${48 * shadowIntensity}px -${20 * shadowIntensity}px rgba(0,0,0,0.8),
            0 0 0 1px ${borderColor},
            ${isActive ? `0 0 ${60 * shadowIntensity}px -${10 * shadowIntensity}px ${WHEEL_COLORS.glow}` : 'none'},
            inset 0 1px 0 rgba(255,255,255,0.02)
          `,
          transform: `scale(${activeScale})`,
          transition: reduced ? 'none' : 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.4s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.3s ease',
        }}
      >
        <WheelImage src={item.image} alt={item.title} />

        {/* Active card glow overlay */}
        {isActive && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse 80% 60% at 50% 20%, ${WHEEL_COLORS.glowStrong} 0%, transparent 60%)`,
              pointerEvents: 'none',
              opacity: 0.15,
              zIndex: 1,
            }}
            aria-hidden="true"
          />
        )}

        {/* Top gold accent line on active card */}
        {isActive && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '10%',
              right: '10%',
              height: '1.5px',
              background: `linear-gradient(90deg, transparent, ${WHEEL_COLORS.gold} 30%, ${WHEEL_COLORS.goldLight} 50%, ${WHEEL_COLORS.gold} 70%, transparent)`,
              pointerEvents: 'none',
              zIndex: 2,
              opacity: 0.8,
            }}
            aria-hidden="true"
          />
        )}

        {/* Action button on hover */}
        {item.href && (
          <a
            href={item.href}
            style={{
              position: 'absolute',
              right: 16,
              bottom: 16,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              background: 'rgba(13,13,13,0.9)',
              color: WHEEL_COLORS.cream,
              border: `1px solid ${WHEEL_COLORS.cardBorder}`,
              borderRadius: '999px',
              fontSize: '0.7rem',
              fontWeight: 500,
              fontFamily: 'Inter, system-ui, sans-serif',
              opacity: 0,
              transform: 'translateY(8px)',
              transition: 'opacity 0.25s ease, transform 0.25s ease, border-color 0.2s ease, background 0.2s ease',
              backdropFilter: 'blur(12px)',
              zIndex: 3,
              textDecoration: 'none',
              letterSpacing: '0.02em',
            }}
            className="group-hover:opacity-100 group-hover:translate-y-0"
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = WHEEL_COLORS.gold; e.currentTarget.style.background = 'rgba(201,168,76,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = WHEEL_COLORS.cardBorder; e.currentTarget.style.background = 'rgba(13,13,13,0.9)'; }}
          >
            <svg viewBox="0 0 12 12" style={{ width: 14, height: 14 }} aria-hidden="true">
              <path d="M3 9 9 3M4 3h5v5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Order
          </a>
        )}

        {/* Category badge */}
        {item.category && (
          <span
            style={{
              position: 'absolute',
              left: 16,
              top: 16,
              padding: '4px 10px',
              background: 'rgba(13,13,13,0.85)',
              color: WHEEL_COLORS.goldLight,
              border: `1px solid ${WHEEL_COLORS.cardBorder}`,
              borderRadius: '999px',
              fontSize: '0.65rem',
              fontWeight: 600,
              fontFamily: 'Inter, system-ui, sans-serif',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              backdropFilter: 'blur(8px)',
              zIndex: 2,
              opacity: isActive ? 1 : 0.6,
              transition: 'opacity 0.3s ease',
            }}
            aria-hidden="true"
          >
            {item.category}
          </span>
        )}
      </span>
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   EDITORIAL TITLE BLOCK — left zone
   ────────────────────────────────────────────────────────────────────────── */
interface EditorialTitleProps {
  items: WorksWheelItem[];
  activeIndex: number;
  turnProgress: number;
  reduced: boolean;
  className?: string;
}

function EditorialTitle({ items, activeIndex, turnProgress, reduced, className }: EditorialTitleProps) {
  const activeItem = items[activeIndex];
  const total = items.length;
  const current = activeIndex + 1;

  // Smooth text transition using turnProgress
  const textProgress = turnProgress - Math.floor(turnProgress);
  const isTransitioning = textProgress > 0.05 && textProgress < 0.95;

  if (!activeItem) return null;

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        left: '4%',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '22%',
        maxWidth: 320,
        minWidth: 200,
        pointerEvents: 'none',
        zIndex: 10,
        opacity: reduced ? 1 : (isTransitioning ? 0.7 : 1),
        transition: 'opacity 0.3s ease',
      }}
      aria-hidden="false"
    >
      {/* Label */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 12px',
          background: 'rgba(201, 168, 76, 0.08)',
          border: `1px solid ${WHEEL_COLORS.cardBorder}`,
          borderRadius: '999px',
          fontSize: '0.65rem',
          fontWeight: 600,
          fontFamily: 'Inter, system-ui, sans-serif',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: WHEEL_COLORS.goldLight,
          marginBottom: 20,
          width: 'fit-content',
          backdropFilter: 'blur(8px)',
        }}
      >
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: WHEEL_COLORS.gold,
          boxShadow: `0 0 12px ${WHEEL_COLORS.gold}`,
          animation: reduced ? 'none' : 'pulse 2.5s ease-in-out infinite',
        }} />
        CURRENT SELECTION
      </div>

      {/* Counter */}
      <div style={{ marginBottom: 16, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <span style={{
          fontSize: 'clamp(2.5rem, 4vw, 3.5rem)',
          fontWeight: 300,
          color: WHEEL_COLORS.mutedDim,
          fontFeatureSettings: '"tnum"',
          lineHeight: 1,
        }}>
          {String(current).padStart(2, '0')}
        </span>
        <span style={{
          fontSize: 'clamp(1.5rem, 2.5vw, 2rem)',
          fontWeight: 300,
          color: WHEEL_COLORS.mutedDim,
          marginLeft: 4,
        }}>
          /{String(total).padStart(2, '0')}
        </span>
      </div>

      {/* Gold hairline */}
      <div
        style={{
          width: 48,
          height: 1.5,
          background: `linear-gradient(90deg, ${WHEEL_COLORS.gold}, ${WHEEL_COLORS.goldLight})`,
          marginBottom: 20,
          opacity: 0.8,
        }}
        aria-hidden="true"
      />

      {/* Product name — editorial display */}
      <motion.h2
        style={{
          fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
          fontWeight: 700,
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          color: WHEEL_COLORS.cream,
          margin: 0,
          fontFamily: 'Poppins, Inter, system-ui, sans-serif',
          textShadow: '0 2px 20px rgba(0,0,0,0.5)',
        }}
        animate={{ opacity: [1, 0.6, 1], y: [0, -4, 0] }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {activeItem.title}
      </motion.h2>

      {/* Category */}
      {activeItem.category && (
        <p
          style={{
            marginTop: 12,
            fontSize: '0.875rem',
            fontWeight: 400,
            lineHeight: 1.5,
            color: WHEEL_COLORS.muted,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {activeItem.category}
        </p>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   SELECTION RAIL — right zone
   ────────────────────────────────────────────────────────────────────────── */
interface SelectionRailProps {
  items: WorksWheelItem[];
  activeIndex: number;
  to: (n: number) => void;
  reduced: boolean;
  className?: string;
}

function SelectionRail({ items, activeIndex, to, reduced, className }: SelectionRailProps) {
  return (
    <nav
      className={className}
      style={{
        position: 'absolute',
        right: '4%',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '22%',
        maxWidth: 280,
        minWidth: 180,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 10,
        zIndex: 10,
        pointerEvents: 'auto',
      }}
      aria-label="Product selection"
    >
      {items.map((item, i) => {
        const isActive = i === activeIndex;
        return (
          <button
            key={item.title}
            type="button"
            onClick={() => to(i + 1)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); to(i + 1); } }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 12,
              padding: '10px 14px',
              background: isActive ? 'rgba(201, 168, 76, 0.06)' : 'transparent',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'right',
              position: 'relative',
              overflow: 'hidden',
              transition: reduced ? 'none' : 'background 0.3s cubic-bezier(0.22, 1, 0.36, 1), padding-right 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'rgba(201, 168, 76, 0.04)';
                e.currentTarget.style.paddingRight = '18px';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.paddingRight = '14px';
              }
            }}
          >
            {/* Active indicator bar */}
            <span
              style={{
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 3,
                height: isActive ? '60%' : '0%',
                background: WHEEL_COLORS.gold,
                borderRadius: '2px 0 0 2px',
                transition: reduced ? 'none' : 'height 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease',
                opacity: isActive ? 1 : 0,
              }}
              aria-hidden="true"
            />
            {/* Gold dot for active */}
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isActive ? WHEEL_COLORS.gold : 'transparent',
                border: isActive ? 'none' : `1px solid ${WHEEL_COLORS.mutedDim}`,
                flexShrink: 0,
                transition: reduced ? 'none' : 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
                boxShadow: isActive ? `0 0 12px ${WHEEL_COLORS.gold}` : 'none',
              }}
              aria-hidden="true"
            />
            <span
              style={{
                fontSize: 'clamp(0.8rem, 1.1vw, 0.95rem)',
                fontWeight: isActive ? 600 : 400,
                lineHeight: 1.3,
                color: isActive ? WHEEL_COLORS.cream : WHEEL_COLORS.muted,
                fontFamily: 'Inter, system-ui, sans-serif',
                letterSpacing: '-0.01em',
                maxWidth: '85%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                transition: reduced ? 'none' : 'color 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {item.title}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   MAIN WORKS WHEEL COMPONENT
   ────────────────────────────────────────────────────────────────────────── */
export function WorksWheel({
  items,
  label = "The Crunch Menu",
  action = "Order",
  className,
  onActiveChange,
  ...props
}: WorksWheelProps) {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const wheelRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<(HTMLElement | null)[]>([]);

  const turn = React.useRef(0);
  const target = React.useRef(0);
  const [active, setActive] = React.useState(0);
  const [stage, setStage] = React.useState<Stage>({ w: 0, h: 0 });

  const count = items.length;
  const last = Math.max(count - 1, 0);

  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduced(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);

  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const read = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const metrics = React.useMemo<WheelMetrics>(() => {
    const { w, h } = stage;
    const cardW = Math.min(h * CARD_H * CARD_RATIO, w * CARD_MAX_W);
    const cardH = cardW / CARD_RATIO;
    const drumR = cardH * DRUM;
    const ringR = cardH * RING_R;
    const ringScale = count
      ? clamp((((2 * Math.PI * ringR) / count) * 0.82) / (cardW || 1), 0.16, 1)
      : 1;
    return {
      cardW,
      cardH,
      ringR,
      ringScale,
      drumR,
      bow: cardH * BOW,
      depth: cardH * LENS,
      title: cardH * TITLE,
      index: cardH * INDEX,
    };
  }, [stage, count]);

  // Continuous turn progress for synchronization (0 to count)
  const [turnProgress, setTurnProgress] = React.useState(0);

  // Main animation loop
  React.useEffect(() => {
    if (!stage.h) return;
    let frame = 0;
    const { ringR, ringScale, drumR, bow } = metrics;

    const draw = () => {
      frame = requestAnimationFrame(draw);
      const gap = target.current - turn.current;
      if (Math.abs(gap) < 0.0005) turn.current = target.current;
      else turn.current += gap * (reduced ? 1 : EASE);

      // Update continuous progress for synchronized systems
      const currentProgress = turn.current;
      setTurnProgress(currentProgress);
      onActiveChange?.(currentProgress, active);

      const t = turn.current;
      const m = clamp(t, 0, 1);
      const pos = Math.max(0, t - 1);

      if (wheelRef.current) {
        wheelRef.current.style.transform = `translateZ(${-m * drumR}px)`;
      }

      for (let i = 0; i < count; i++) {
        const d = i - pos;
        const drumDeg = d * STEP;
        const card = cardRefs.current[i];
        if (card) {
          card.style.transform = place(
            d * (360 / count),
            drumDeg,
            ringR,
            drumR,
            bow,
            m,
          );
          card.style.opacity = m > 0.5 && Math.abs(d) > CULL ? "0" : "1";
          card.style.zIndex = String(Math.round(100 - Math.abs(d) * 2));
        }
        const face = card?.firstElementChild as HTMLElement | null;
        if (face) face.style.transform = `scale(${lerp(ringScale, 1, m)})`;
      }

      const near = clamp(Math.round(pos), 0, last);
      setActive((prev) => (prev === near ? prev : near));
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [metrics, stage.h, count, last, reduced]);

  const to = React.useCallback(
    (next: number) => {
      target.current = clamp(next, 0, last + 1);
    },
    [last],
  );

  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      const next = target.current + event.deltaY / WHEEL_UNITS;
      if (next > 0 && next < last + 1) event.preventDefault();
      to(next);
      window.clearTimeout(settling.current);
      settling.current = window.setTimeout(
        () => to(Math.round(target.current)),
        SETTLE,
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      window.clearTimeout(settling.current);
    };
  }, [to, last]);

  const drag = React.useRef<number | null>(null);
  const settling = React.useRef(0);

  /* ────────────────────────────────────────────────────────────────────────
     RENDER
     ──────────────────────────────────────────────────────────────────────── */

  return (
    <section
      aria-label={label}
      className={cn("relative h-full min-h-[24rem] w-full overflow-hidden select-none", className)}
      style={{
        background: WHEEL_COLORS.stageBase,
        color: WHEEL_COLORS.cream,
        isolation: 'isolate',
        position: 'relative',
      }}
      {...props}
    >
      {/* ── Vignette overlay ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
          background: `radial-gradient(ellipse 80% 60% at 50% 50%, transparent 0%, ${WHEEL_COLORS.deepBase} 100%)`,
          opacity: 0.6,
        }}
        aria-hidden="true"
      />

      {/* ── Ambient spotlight (synced) ── */}
      <AmbientSpotlight
        stage={stage}
        metrics={metrics}
        turnProgress={turnProgress}
        activeIndex={active}
        reduced={reduced}
      />

      {/* ── Orbital guides (synced) ── */}
      <OrbitalGuides
        metrics={metrics}
        stage={stage}
        turnProgress={turnProgress}
        activeIndex={active}
        reduced={reduced}
      />

      {/* ── Pedestal (synced) ── */}
      <Pedestal
        metrics={metrics}
        stage={stage}
        turnProgress={turnProgress}
        activeIndex={active}
        reduced={reduced}
      />

      {/* ── Stage interaction area ── */}
      <div
        ref={stageRef}
        tabIndex={0}
        role="listbox"
        aria-label={label}
        aria-activedescendant={`works-wheel-${active}`}
        className="focus-visible:outline-none absolute inset-0 cursor-grab touch-pan-x active:cursor-grabbing"
        style={{
          perspective: `${metrics.depth}px`,
          outline: 'none',
        }}
        onPointerDown={(event) => {
          drag.current = event.clientY;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (drag.current === null) return;
          to(target.current + (drag.current - event.clientY) / DRAG_UNITS);
          drag.current = event.clientY;
        }}
        onPointerUp={() => {
          drag.current = null;
          if (target.current > 1) to(Math.round(target.current));
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") to(Math.round(target.current) + 1);
          else if (event.key === "ArrowUp") to(Math.round(target.current) - 1);
          else return;
          event.preventDefault();
        }}
      >
        <div
          ref={wheelRef}
          className="absolute top-1/2 left-1/2 [transform-style:preserve-3d]"
        >
          {items.map((item, i) => (
            <WheelCard
              key={item.title}
              item={item}
              index={i}
              metrics={metrics}
              turnProgress={turnProgress}
              isActive={i === active}
              to={to}
              reduced={reduced}
            />
          ))}
        </div>
      </div>

      {/* ── Editorial title block (left zone) ── */}
      <EditorialTitle
        items={items}
        activeIndex={active}
        turnProgress={turnProgress}
        reduced={reduced}
        className="works-wheel-title"
      />

      {/* ── Selection rail (right zone) ── */}
      <SelectionRail
        items={items}
        activeIndex={active}
        to={to}
        reduced={reduced}
        className="works-wheel-rail"
      />

      {/* ── Section label (accessibility) ── */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '0.7rem',
          fontWeight: 500,
          fontFamily: 'Inter, system-ui, sans-serif',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: WHEEL_COLORS.mutedDim,
          pointerEvents: 'none',
          zIndex: 5,
        }}
        aria-hidden="true"
      >
        {label}
      </div>

      {/* ── Global styles ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer {
          to { background-position: -200% 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.9); }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation: none !important;
            transition: none !important;
          }
        }
        /* Focus visible for accessibility */
        button:focus-visible, a:focus-visible {
          outline: 2px solid ${WHEEL_COLORS.gold} !important;
          outline-offset: 3px !important;
        }

        /* ─── Responsive Layout ─── */
        /* Tablet: 768px - 1024px */
        @media (max-width: 1024px) and (min-width: 769px) {
          .works-wheel-title {
            left: 2% !important;
            width: 26% !important;
            min-width: 180px !important;
          }
          .works-wheel-rail {
            right: 2% !important;
            width: 26% !important;
            min-width: 160px !important;
          }
          .works-wheel-title div[style*="fontSize: clamp(2.5rem"] {
            font-size: clamp(2rem, 3.5vw, 2.8rem) !important;
          }
          .works-wheel-rail button span:last-child {
            font-size: clamp(0.75rem, 1vw, 0.85rem) !important;
          }
        }

        /* Mobile: ≤768px — Vertical reflow: Title → Wheel → Selector */
        @media (max-width: 768px) {
          /* Title block: static, centered, above wheel */
          .works-wheel-title {
            position: static !important;
            transform: none !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            margin: 0 auto 16px !important;
            padding: 0 16px !important;
            text-align: center !important;
            opacity: 1 !important;
            pointer-events: auto !important;
            z-index: 10 !important;
            order: -1 !important;
          }
          .works-wheel-title > div:first-child {
            justify-content: center !important;
            margin-bottom: 12px !important;
          }
          .works-wheel-title div[style*="fontSize: clamp(2.5rem"] {
            font-size: clamp(2rem, 6vw, 2.8rem) !important;
          }
          .works-wheel-title div[style*="fontSize: clamp(1.5rem"] {
            font-size: clamp(1.25rem, 4vw, 1.75rem) !important;
          }
          .works-wheel-title h2[style*="fontSize: clamp(1.75rem"] {
            font-size: clamp(1.5rem, 5vw, 2rem) !important;
            line-height: 1.2 !important;
          }
          .works-wheel-title p {
            font-size: 0.8125rem !important;
          }

          /* Rail: static, horizontal chip bar below wheel */
          .works-wheel-rail {
            position: static !important;
            transform: none !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            flex-direction: row !important;
            flex-wrap: wrap !important;
            justify-content: center !important;
            align-items: center !important;
            gap: 6px !important;
            margin: 16px auto 0 !important;
            padding: 0 12px !important;
            order: 1 !important;
            pointer-events: auto !important;
            z-index: 10 !important;
          }
          .works-wheel-rail button {
            width: auto !important;
            min-width: 0 !important;
            padding: 8px 14px !important;
            justify-content: center !important;
            border-radius: 999px !important;
            background: rgba(19,19,19,0.6) !important;
            border: 1px solid ${WHEEL_COLORS.cardBorder} !important;
          }
          .works-wheel-rail button[style*="background: rgba(201, 168, 76, 0.06)"] {
            background: rgba(201, 168, 76, 0.12) !important;
            border-color: ${WHEEL_COLORS.gold} !important;
          }
          .works-wheel-rail button span:first-child {
            display: none !important; /* hide indicator bar */
          }
          .works-wheel-rail button span:nth-child(2) {
            width: 6px !important;
            height: 6px !important;
            margin-right: 6px !important;
          }
          .works-wheel-rail button span:last-child {
            display: inline !important;
            font-size: clamp(0.7rem, 2.2vw, 0.8rem) !important;
            font-weight: 500 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            max-width: 120px !important;
          }

          /* Wheel stage: ensure it fills available space */
          .works-wheel-stage,
          section[aria-label="The Crunch Menu"] {
            min-height: 420px !important;
            max-height: 60vh !important;
          }

          /* Reduce ambient effects for mobile GPU */
          .works-wheel-stage div[style*="radial-gradient(ellipse 80%"],
          .works-wheel-stage div[style*="radial-gradient(ellipse 60%"],
          .works-wheel-stage div[style*="conic-gradient"] {
            filter: blur(30px) !important;
            opacity: 0.4 !important;
          }
          .works-wheel-stage div[style*="border: 1px solid ${WHEEL_COLORS.orbital}"] {
            display: none !important; /* hide orbital guides on mobile */
          }

          /* Ensure touch scrolling works on wheel container */
          section[aria-label="The Crunch Menu"] > div[style*="touch-pan-x"] {
            touch-action: pan-y pinch-zoom !important;
          }
        }

        /* Small mobile: ≤430px */
        @media (max-width: 430px) {
          .works-wheel-title {
            padding: 0 12px !important;
            margin-bottom: 12px !important;
          }
          .works-wheel-title > div:first-child {
            padding: 4px 10px !important;
            font-size: 0.55rem !important;
            gap: 6px !important;
          }
          .works-wheel-title > div:first-child span[style*="width: 6px"] {
            width: 5px !important;
            height: 5px !important;
          }
          .works-wheel-title div[style*="fontSize: clamp(2.5rem"] {
            font-size: clamp(1.75rem, 6.5vw, 2.25rem) !important;
          }
          .works-wheel-title div[style*="fontSize: clamp(1.5rem"] {
            font-size: clamp(1.1rem, 4vw, 1.4rem) !important;
          }
          .works-wheel-title h2[style*="fontSize: clamp(1.75rem"] {
            font-size: clamp(1.35rem, 5.5vw, 1.75rem) !important;
          }
          .works-wheel-rail {
            gap: 5px !important;
            padding: 0 10px !important;
          }
          .works-wheel-rail button {
            padding: 7px 12px !important;
          }
          .works-wheel-rail button span:last-child {
            font-size: clamp(0.65rem, 2.5vw, 0.75rem) !important;
            max-width: 100px !important;
          }
        }

        /* Very small: ≤375px */
        @media (max-width: 375px) {
          .works-wheel-title h2[style*="fontSize: clamp(1.75rem"] {
            font-size: 1.25rem !important;
          }
          .works-wheel-rail button span:last-child {
            max-width: 85px !important;
            font-size: 0.65rem !important;
          }
        }
      `}} />
    </section>
  );
}

export default WorksWheel;