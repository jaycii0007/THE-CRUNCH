/**
 * InteractionGuidance — Minimal desktop-only interaction hint
 */
import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WHEEL_COLORS, SPACING, FONTS } from '@/lib/design-tokens';

export interface InteractionGuidanceProps {
  className?: string;
}

export function InteractionGuidance({ className = '' }: InteractionGuidanceProps) {
  const [visible, setVisible] = React.useState(true);
  const [reduced, setReduced] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(false);

  React.useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const read = () => setReduced(query.matches);
    read();
    query.addEventListener('change', read);
    return () => query.removeEventListener('change', read);
  }, []);

  // Auto-hide after 5 seconds or on first interaction
  React.useEffect(() => {
    if (!visible || !isDesktop) return;
    const timer = setTimeout(() => setVisible(false), 5000);
    const onInteraction = () => setVisible(false);
    window.addEventListener('wheel', onInteraction, { once: true, passive: true });
    window.addEventListener('keydown', onInteraction, { once: true });
    window.addEventListener('pointerdown', onInteraction, { once: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('wheel', onInteraction);
      window.removeEventListener('keydown', onInteraction);
      window.removeEventListener('pointerdown', onInteraction);
    };
  }, [visible, isDesktop]);

  if (!isDesktop || !visible) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="guidance"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 0.7, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: reduced ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: SPACING.md,
          padding: `${SPACING.sm} ${SPACING.md}`,
          color: WHEEL_COLORS.muted,
          fontSize: '0.8125rem',
          fontWeight: 400,
          fontFamily: FONTS.body,
          letterSpacing: '0.01em',
          textAlign: 'center',
          width: 'fit-content',
          margin: '0 auto',
        }}
        role="status"
        aria-live="polite"
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: WHEEL_COLORS.gold,
            boxShadow: `0 0 12px ${WHEEL_COLORS.gold}`,
            flexShrink: 0,
            animation: reduced ? 'none' : 'pulse 2s ease-in-out infinite',
          }}
          aria-hidden="true"
        />
        Scroll, drag, or use <kbd style={{
          fontFamily: FONTS.mono,
          fontSize: '0.7rem',
          padding: '1px 5px',
          background: 'rgba(201,168,76,0.1)',
          border: `1px solid ${WHEEL_COLORS.cardBorder}`,
          borderRadius: '4px',
          color: WHEEL_COLORS.goldLight,
          margin: '0 2px',
        }}>↑↓</kbd> keys to explore
      </motion.div>
    </AnimatePresence>
  );
}

export default InteractionGuidance;