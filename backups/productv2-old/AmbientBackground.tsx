/**
 * AmbientBackground — Synchronized atmospheric background for Products V2
 * Responds to WorksWheel's turnProgress with subtle amber illumination
 */
import * as React from 'react';
import { WHEEL_COLORS, EASING } from '@/lib/design-tokens';

export interface AmbientBackgroundProps {
  turnProgress: number;
  activeIndex: number;
  className?: string;
}

export function AmbientBackground({
  turnProgress,
  activeIndex,
  className = '',
}: AmbientBackgroundProps) {
  const [reduced, setReduced] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const read = () => setReduced(query.matches);
    read();
    query.addEventListener('change', read);
    return () => query.removeEventListener('change', read);
  }, []);

  if (reduced) return null;

  // Calculate active card angular position for highlight synchronization
  const STEP = 36; // degrees between cards (from WorksWheel)
  const progressFraction = turnProgress - Math.floor(turnProgress);
  const activeAngle = (activeIndex * STEP) - (progressFraction * STEP);
  const activeAngleRad = (activeAngle * Math.PI) / 180;

  // Spotlight position follows active card horizontally
  const spotlightX = 50 + Math.sin(activeAngleRad) * 15; // percentage
  const spotlightY = 40 + Math.cos(activeAngleRad) * 10; // percentage

  // Orbital ring rotation speeds (subtle, opposite directions)
  const ring1Rotation = (turnProgress * 8) % 360;
  const ring2Rotation = -(turnProgress * 5) % 360;

  // Pulse phase based on fractional progress
  const pulsePhase = progressFraction * Math.PI * 2;
  const pulse1 = 0.3 + 0.2 * Math.sin(pulsePhase);
  const pulse2 = 0.2 + 0.15 * Math.cos(pulsePhase);

  // Active position highlight on orbital ring
  const highlightRotation = (activeIndex * STEP) - 90; // offset for top center

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      {/* ── Deep base layer ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: WHEEL_COLORS.deepBase,
          zIndex: 0,
        }}
      />

      {/* ── Vignette overlay ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 80% 70% at 50% 50%, transparent 0%, ${WHEEL_COLORS.deepBase} 100%)`,
          opacity: 0.7,
          zIndex: 1,
        }}
      />

      {/* ── Ambient spotlight — follows active product ── */}
      <div
        style={{
          position: 'absolute',
          left: `${spotlightX}%`,
          top: `${spotlightY}%`,
          transform: 'translate(-50%, -50%)',
          width: '120%',
          height: '100%',
          maxWidth: '100vw',
          maxHeight: '100vh',
          background: `radial-gradient(ellipse 55% 45% at center, ${WHEEL_COLORS.spotlightStrong} 0%, ${WHEEL_COLORS.spotlight} 35%, transparent 75%)`,
          opacity: 0.5,
          filter: 'blur(80px)',
          zIndex: 2,
          transition: `left 0.8s ${EASING.easeOut}, top 0.8s ${EASING.easeOut}, opacity 0.4s ease`,
          willChange: 'left, top, opacity',
        }}
      />

      {/* ── Orbital guide rings (subtle, decorative) ── */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) rotate(${ring1Rotation}deg)`,
          width: '70vmin',
          height: '25vmin',
          border: `1px solid ${WHEEL_COLORS.orbital}`,
          borderRadius: '50%',
          opacity: pulse1,
          zIndex: 3,
          transition: `opacity 0.6s ${EASING.easeOut}`,
          willChange: 'transform, opacity',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) rotate(${ring2Rotation}deg)`,
          width: '85vmin',
          height: '20vmin',
          border: `1px solid ${WHEEL_COLORS.orbital}`,
          borderRadius: '50%',
          opacity: pulse2,
          zIndex: 3,
          transition: `opacity 0.6s ${EASING.easeOut}`,
          willChange: 'transform, opacity',
        }}
      />

      {/* ── Active position highlight on inner ring ── */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) rotate(${highlightRotation}deg)`,
          width: '70vmin',
          height: '25vmin',
          borderRadius: '50%',
          background: `conic-gradient(from 0deg, transparent 0%, ${WHEEL_COLORS.orbitalActive} 15%, ${WHEEL_COLORS.orbitalActive} 25%, transparent 30%)`,
          opacity: 0.35,
          filter: 'blur(2px)',
          zIndex: 4,
          transition: `transform 0.6s ${EASING.easeOut}, opacity 0.4s ease`,
          willChange: 'transform, opacity',
        }}
      />

      {/* ── Pedestal glow at bottom center (subtle platform) ── */}
      <div
        style={{
          position: 'absolute',
          bottom: '8%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '35vmin',
          height: '6px',
          borderRadius: '999px',
          background: `linear-gradient(90deg, transparent, ${WHEEL_COLORS.pedestalActive} 20%, ${WHEEL_COLORS.pedestalActive} 80%, transparent)`,
          boxShadow: `0 0 40px 8px ${WHEEL_COLORS.glow}`,
          opacity: 0.5,
          filter: 'blur(4px)',
          zIndex: 5,
          transition: `opacity 0.6s ${EASING.easeOut}`,
        }}
      />

      {/* ── Responsive adjustments ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 1024px) {
          .ambient-bg div[style*="width: 70vmin"] { width: 65vmin !important; height: 22vmin !important; }
          .ambient-bg div[style*="width: 85vmin"] { width: 80vmin !important; height: 18vmin !important; }
        }
        @media (max-width: 768px) {
          .ambient-bg div[style*="radial-gradient(ellipse 55%"] {
            filter: blur(50px) !important;
            opacity: 0.35 !important;
          }
          .ambient-bg div[style*="border: 1px solid ${WHEEL_COLORS.orbital}"] {
            opacity: 0.15 !important;
          }
          .ambient-bg div[style*="conic-gradient"] {
            opacity: 0.2 !important;
          }
          .ambient-bg div[style*="linear-gradient(90deg, transparent, ${WHEEL_COLORS.pedestalActive}"] {
            opacity: 0.3 !important;
            filter: blur(2px) !important;
          }
        }
        @media (max-width: 430px) {
          .ambient-bg div[style*="radial-gradient(ellipse 55%"] {
            filter: blur(40px) !important;
            opacity: 0.3 !important;
          }
          .ambient-bg div[style*="border: 1px solid ${WHEEL_COLORS.orbital}"] {
            display: none !important;
          }
          .ambient-bg div[style*="conic-gradient"] {
            display: none !important;
          }
          .ambient-bg div[style*="linear-gradient(90deg, transparent, ${WHEEL_COLORS.pedestalActive}"] {
            opacity: 0.25 !important;
            width: 50vmin !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ambient-bg * {
            animation: none !important;
            transition: none !important;
          }
        }
      `}} />
    </div>
  );
}

// Add className for CSS targeting
export function AmbientBackgroundWrapper(props: AmbientBackgroundProps) {
  return <div className="ambient-bg"><AmbientBackground {...props} /></div>;
}

export default AmbientBackground;