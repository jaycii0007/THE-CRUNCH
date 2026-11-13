/**
 * ProductWheelSkeleton — Loading skeleton matching WorksWheel proportions
 */
import * as React from 'react';
import { WHEEL_COLORS, SPACING } from '@/lib/design-tokens';

export interface ProductWheelSkeletonProps {
  className?: string;
}

export function ProductWheelSkeleton({ className = '' }: ProductWheelSkeletonProps) {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const read = () => setReduced(query.matches);
    read();
    query.addEventListener('change', read);
    return () => query.removeEventListener('change', read);
  }, []);

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '420px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.lg,
      }}
      role="status"
      aria-busy="true"
      aria-label="Loading featured products"
    >
      {/* Header skeleton */}
      <div
        style={{
          width: '100%',
          maxWidth: '800px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: SPACING.md,
        }}
      >
        <div
          style={{
            width: '120px',
            height: '28px',
            borderRadius: '999px',
            background: `linear-gradient(90deg, ${WHEEL_COLORS.cardSurface} 25%, ${WHEEL_COLORS.stageBase} 50%, ${WHEEL_COLORS.cardSurface} 75%)`,
            backgroundSize: '200% 100%',
            animation: reduced ? 'none' : 'shimmer 1.6s ease-in-out infinite',
          }}
        />
        <div
          style={{
            width: '60px',
            height: '2px',
            background: `linear-gradient(90deg, ${WHEEL_COLORS.gold}, ${WHEEL_COLORS.goldLight})`,
            opacity: 0.5,
          }}
        />
        <div
          style={{
            width: '60%',
            minWidth: '200px',
            maxWidth: '400px',
            height: 'clamp(2rem, 4vw, 3.5rem)',
            borderRadius: '4px',
            background: `linear-gradient(90deg, ${WHEEL_COLORS.cardSurface} 25%, ${WHEEL_COLORS.stageBase} 50%, ${WHEEL_COLORS.cardSurface} 75%)`,
            backgroundSize: '200% 100%',
            animation: reduced ? 'none' : 'shimmer 1.6s ease-in-out infinite',
          }}
        />
        <div
          style={{
            width: '40%',
            minWidth: '150px',
            maxWidth: '300px',
            height: '1.5rem',
            borderRadius: '4px',
            background: `linear-gradient(90deg, ${WHEEL_COLORS.cardSurface} 25%, ${WHEEL_COLORS.stageBase} 50%, ${WHEEL_COLORS.cardSurface} 75%)`,
            backgroundSize: '200% 100%',
            animation: reduced ? 'none' : 'shimmer 1.6s ease-in-out infinite',
          }}
        />
      </div>

      {/* Wheel skeleton */}
      <div
        style={{
          width: '100%',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '420px',
        }}
      >
        <div
          style={{
            width: 'clamp(300px, 60vw, 700px)',
            height: 'clamp(300px, 50vw, 550px)',
            borderRadius: '24px',
            background: `linear-gradient(90deg, ${WHEEL_COLORS.cardSurface} 25%, ${WHEEL_COLORS.stageBase} 50%, ${WHEEL_COLORS.cardSurface} 75%)`,
            backgroundSize: '200% 100%',
            animation: reduced ? 'none' : 'shimmer 1.6s ease-in-out infinite',
            boxShadow: `
              0 24px 48px -20px rgba(0,0,0,0.8),
              0 0 0 1px ${WHEEL_COLORS.cardBorder},
              inset 0 1px 0 rgba(255,255,255,0.02)
            `,
          }}
        />
      </div>

      {/* Guidance skeleton */}
      <div
        style={{
          width: '200px',
          height: '24px',
          borderRadius: '999px',
          background: `linear-gradient(90deg, ${WHEEL_COLORS.cardSurface} 25%, ${WHEEL_COLORS.stageBase} 50%, ${WHEEL_COLORS.cardSurface} 75%)`,
          backgroundSize: '200% 100%',
          animation: reduced ? 'none' : 'shimmer 1.6s ease-in-out infinite',
          opacity: 0.5,
        }}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer {
          to { background-position: -200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .product-wheel-skeleton * { animation: none !important; transition: none !important; }
        }
      `}} />
    </div>
  );
}

export default ProductWheelSkeleton;