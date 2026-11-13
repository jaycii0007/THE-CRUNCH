/**
 * EmptyState — No featured products available
 */
import * as React from 'react';
import { motion } from 'framer-motion';
import { WHEEL_COLORS, SPACING, FONTS } from '@/lib/design-tokens';

export interface EmptyStateProps {
  onRefresh?: () => void;
  className?: string;
}

export function EmptyState({ onRefresh, className = '' }: EmptyStateProps) {
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
        gap: SPACING.xl,
        textAlign: 'center',
        padding: SPACING['2xl'],
      }}
      role="status"
      aria-live="polite"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduced ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${WHEEL_COLORS.cardSurface} 0%, ${WHEEL_COLORS.stageBase} 100%)`,
          border: `1px solid ${WHEEL_COLORS.cardBorder}`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)`,
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke={WHEEL_COLORS.gold}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.5, delay: reduced ? 0 : 0.1, ease: [0.22, 1, 0.36, 1] }}
        style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm, maxWidth: '400px' }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 'clamp(1.25rem, 3vw, 1.75rem)',
            fontWeight: 600,
            fontFamily: FONTS.display,
            color: WHEEL_COLORS.cream,
            letterSpacing: '-0.02em',
          }}
        >
          No featured products available
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 'clamp(0.9375rem, 2vw, 1rem)',
            fontWeight: 400,
            fontFamily: FONTS.body,
            color: WHEEL_COLORS.muted,
            lineHeight: 1.6,
          }}
        >
          Products with images will appear here automatically
        </p>
      </motion.div>

      {onRefresh && (
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.5, delay: reduced ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
          onClick={onRefresh}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: SPACING.sm,
            padding: `${SPACING.md} ${SPACING.xl}`,
            fontSize: '0.875rem',
            fontWeight: 500,
            fontFamily: FONTS.body,
            color: WHEEL_COLORS.deepBase,
            background: `linear-gradient(135deg, ${WHEEL_COLORS.gold} 0%, ${WHEEL_COLORS.goldLight} 100%)`,
            border: 'none',
            borderRadius: '999px',
            cursor: 'pointer',
            boxShadow: `0 4px 20px rgba(201, 168, 76, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)`,
            transition: reduced ? 'none' : 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!reduced) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = `0 8px 30px rgba(201, 168, 76, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)`;
            }
          }}
          onMouseLeave={(e) => {
            if (!reduced) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = `0 4px 20px rgba(201, 168, 76, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)`;
            }
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Refresh
        </motion.button>
      )}
    </div>
  );
}

export default EmptyState;