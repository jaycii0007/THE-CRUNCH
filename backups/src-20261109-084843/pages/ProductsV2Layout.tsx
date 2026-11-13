/**
 * ProductsV2Layout — Full-viewport layout for Products V2 page
 * Dynamically measures navbar height and provides flex column structure
 */
import * as React from 'react';
import { PAGE_COLORS, SPACING } from '@/lib/design-tokens';

export interface ProductsV2LayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  guidance?: React.ReactNode;
  className?: string;
}

export function ProductsV2Layout({
  children,
  header,
  guidance,
  className = '',
}: ProductsV2LayoutProps) {
  const [navHeight, setNavHeight] = React.useState(72); // Default fallback
  const [mounted, setMounted] = React.useState(false);

  // Measure actual navbar height on mount
  React.useEffect(() => {
    setMounted(true);
    const navbar = document.querySelector('.navbar-root') as HTMLElement;
    if (navbar) {
      const updateHeight = () => setNavHeight(navbar.offsetHeight);
      updateHeight();
      const ro = new ResizeObserver(updateHeight);
      ro.observe(navbar);
      return () => ro.disconnect();
    }
  }, []);

  // CSS variable for navbar height (used by children for calc)
  React.useEffect(() => {
    if (mounted) {
      document.documentElement.style.setProperty('--nav-height', `${navHeight}px`);
    }
  }, [navHeight, mounted]);

  if (!mounted) {
    // Render minimal structure during SSR/hydration to avoid layout shift
    return (
      <div
        className={className}
        style={{
          minHeight: '100vh',
          background: PAGE_COLORS.background,
          color: PAGE_COLORS.text,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
        data-products-v2-layout="true"
      >
        <main
          style={{
            paddingTop: 'var(--nav-height, 72px)',
            minHeight: 'calc(100vh - var(--nav-height, 72px))',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {header}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {children}
          </div>
          {guidance}
        </main>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        minHeight: '100vh',
        background: PAGE_COLORS.background,
        color: PAGE_COLORS.text,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      data-products-v2-layout="true"
    >
      <main
        style={{
          paddingTop: `var(--nav-height, ${navHeight}px)`,
          minHeight: `calc(100vh - var(--nav-height, ${navHeight}px))`,
          display: 'flex',
          flexDirection: 'column',
          overflowX: 'hidden',
        }}
      >
        {/* Header zone — fixed height, centered content */}
        {header && (
          <header
            style={{
              flexShrink: 0,
              padding: `${SPACING.xl} ${SPACING['2xl']} ${SPACING.lg}`,
              maxWidth: '1440px',
              margin: '0 auto',
              width: '100%',
              boxSizing: 'border-box',
              textAlign: 'center',
            }}
          >
            {header}
          </header>
        )}

        {/* Main content zone — flex: 1, fills available space */}
        <div
          style={{
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            maxWidth: '1440px',
            margin: '0 auto',
            padding: `0 ${SPACING['2xl']} ${SPACING['3xl']}`,
            boxSizing: 'border-box',
            position: 'relative',
            minHeight: 0, // Allow flex child to shrink
          }}
        >
          {children}
        </div>

        {/* Guidance zone — auto height, bottom */}
        {guidance && (
          <footer
            style={{
              flexShrink: 0,
              padding: `${SPACING.md} ${SPACING['2xl']} ${SPACING.xl}`,
              maxWidth: '1440px',
              margin: '0 auto',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {guidance}
          </footer>
        )}
      </main>

      {/* Global responsive styles for the layout */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 1024px) {
          main > header {
            padding-left: ${SPACING.lg} !important;
            padding-right: ${SPACING.lg} !important;
          }
          main > div[style*="flex: 1"] {
            padding-left: ${SPACING.lg} !important;
            padding-right: ${SPACING.lg} !important;
          }
          main > footer {
            padding-left: ${SPACING.lg} !important;
            padding-right: ${SPACING.lg} !important;
          }
        }
        @media (max-width: 768px) {
          main > header {
            padding-left: ${SPACING.md} !important;
            padding-right: ${SPACING.md} !important;
            padding-top: ${SPACING.lg} !important;
            padding-bottom: ${SPACING.md} !important;
          }
          main > div[style*="flex: 1"] {
            padding-left: ${SPACING.md} !important;
            padding-right: ${SPACING.md} !important;
            padding-bottom: ${SPACING.xl} !important;
          }
          main > footer {
            padding-left: ${SPACING.md} !important;
            padding-right: ${SPACING.md} !important;
            padding-bottom: ${SPACING.lg} !important;
          }
        }
        @media (max-width: 430px) {
          main > header {
            padding-left: ${SPACING.md} !important;
            padding-right: ${SPACING.md} !important;
            padding-top: ${SPACING.md} !important;
            padding-bottom: ${SPACING.sm} !important;
          }
          main > div[style*="flex: 1"] {
            padding-left: ${SPACING.md} !important;
            padding-right: ${SPACING.md} !important;
            padding-bottom: ${SPACING.lg} !important;
          }
          main > footer {
            padding-left: ${SPACING.md} !important;
            padding-right: ${SPACING.md} !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-products-v2-layout="true"] *,
          [data-products-v2-layout="true"] *::before,
          [data-products-v2-layout="true"] *::after {
            animation: none !important;
            transition: none !important;
          }
        }
      `}} />
    </div>
  );
}

export default ProductsV2Layout;