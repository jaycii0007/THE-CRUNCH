/**
 * ErrorState — Failed to load featured products with retry
 */
import * as React from 'react';
import { motion } from 'framer-motion';
import { WHEEL_COLORS, SPACING, FONTS } from '@/lib/design-tokens';

export interface ErrorStateProps {
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ onRetry, className = '' }: ErrorStateProps) {
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
      role="alert"
      aria-live="assertive"
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
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
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
          Unable to load featured products
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
          Please check your connection and try again
        </p>
      </motion.div>

      {onRetry && (
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.5, delay: reduced ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
          onClick={onRetry}
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
          Try Again
        </motion.button>
      )}
    </div>
  );
}

export default ErrorState;