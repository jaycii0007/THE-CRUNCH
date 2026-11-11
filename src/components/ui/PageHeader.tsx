/**
 * PageHeader — Premium editorial heading for Products V2
 */
import * as React from 'react';
import { motion } from 'framer-motion';
import { PAGE_COLORS, WHEEL_COLORS, SPACING, FONTS } from '@/lib/design-tokens';

export interface PageHeaderProps {
  title?: string;
  subtitle?: string;
  className?: string;
}

export function PageHeader({
  title = 'Premium Featured Selection',
  subtitle = 'Turn the wheel to discover our signature offerings',
  className = '',
}: PageHeaderProps) {
  const [reduced, setReduced] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const read = () => setReduced(query.matches);
    read();
    query.addEventListener('change', read);
    return () => query.removeEventListener('change', read);
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: SPACING.md,
        width: '100%',
        maxWidth: '800px',
        margin: '0 auto',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: reduced ? 'none' : `opacity 0.8s ${FONTS.display}, transform 0.8s ${FONTS.display}`,
      }}
    >
      {/* Label badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: SPACING.sm,
          padding: `${SPACING.xs} ${SPACING.md}`,
          background: `rgba(201, 168, 76, 0.08)`,
          border: `1px solid ${WHEEL_COLORS.cardBorder}`,
          borderRadius: '999px',
          fontSize: '0.65rem',
          fontWeight: 600,
          fontFamily: FONTS.body,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: WHEEL_COLORS.goldLight,
          width: 'fit-content',
          backdropFilter: 'blur(8px)',
        }}
        role="img"
        aria-label="Featured selection"
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: WHEEL_COLORS.gold,
            boxShadow: `0 0 12px ${WHEEL_COLORS.gold}`,
            animation: reduced ? 'none' : 'pulse 2.5s ease-in-out infinite',
          }}
        />
        CURRENT SELECTION
      </motion.div>

      {/* Gold hairline divider */}
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 48, opacity: 0.8 }}
        transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: 48,
          height: 1.5,
          background: `linear-gradient(90deg, ${WHEEL_COLORS.gold}, ${WHEEL_COLORS.goldLight})`,
          opacity: 0.8,
        }}
        aria-hidden="true"
      />

      {/* Main title */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{
          margin: 0,
          fontSize: 'clamp(2rem, 4vw, 3.5rem)',
          fontWeight: 700,
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          color: PAGE_COLORS.text,
          fontFamily: FONTS.display,
          textAlign: 'center',
          textShadow: '0 2px 20px rgba(0,0,0,0.5)',
        }}
      >
        {title}
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{
          margin: 0,
          fontSize: 'clamp(0.875rem, 1.5vw, 1.125rem)',
          fontWeight: 400,
          lineHeight: 1.6,
          color: WHEEL_COLORS.muted,
          fontFamily: FONTS.body,
          textAlign: 'center',
          maxWidth: '600px',
        }}
      >
        {subtitle}
      </motion.p>

      {/* Global styles for header */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.9); }
        }
        @media (max-width: 1024px) {
          .page-header h1 { font-size: clamp(1.75rem, 3.5vw, 2.75rem) !important; }
          .page-header p { font-size: clamp(0.8125rem, 1.4vw, 1rem) !important; }
        }
        @media (max-width: 768px) {
          .page-header { gap: ${SPACING.sm} !important; }
          .page-header > div:first-child { margin-bottom: ${SPACING.xs} !important; }
          .page-header h1 { font-size: clamp(1.5rem, 5vw, 2.25rem) !important; line-height: 1.2 !important; }
          .page-header p { font-size: 0.875rem !important; }
        }
        @media (max-width: 430px) {
          .page-header h1 { font-size: clamp(1.35rem, 5.5vw, 1.85rem) !important; }
          .page-header > div:first-child { padding: 4px 10px !important; font-size: 0.55rem !important; gap: 6px !important; }
          .page-header > div:first-child span[style*="width: 6px"] { width: 5px !important; height: 5px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .page-header * { animation: none !important; transition: none !important; }
          .page-header [style*="animation: pulse"] { animation: none !important; opacity: 1 !important; transform: scale(1) !important; }
        }
      `}} />
    </div>
  );
}

export default PageHeader;