/**
 * ProductsV2Layout — Full-viewport layout for Products V2 page
 * Properly handles fixed navbar with body padding to prevent overlap
 * Provides semantic section structure: header → main content → footer
 */
import * as React from 'react';
import { PAGE_COLORS, SPACING } from '@/lib/design-tokens';

export interface ProductsV2LayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function ProductsV2Layout({
  children,
  header,
  footer,
  className = '',
}: ProductsV2LayoutProps) {
  const [navHeight, setNavHeight] = React.useState(72);
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

  // CSS variable for navbar height
  React.useEffect(() => {
    if (mounted) {
      document.documentElement.style.setProperty('--nav-height', `${navHeight}px`);
    }
  }, [navHeight, mounted]);

  // Apply body padding to prevent content overlap with fixed navbar
  React.useEffect(() => {
    if (mounted) {
      document.body.style.paddingTop = `${navHeight}px`;
      return () => {
        document.body.style.paddingTop = '0';
      };
    }
  }, [navHeight, mounted]);

  if (!mounted) {
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
        <main style={{ paddingTop: 'var(--nav-height, 72px)' }}>
          {header && (
            <header style={{ padding: `${SPACING.xl} ${SPACING['2xl']} ${SPACING.lg}` }}>
              {header}
            </header>
          )}
          <div style={{ padding: `0 ${SPACING['2xl']} ${SPACING['3xl']}` }}>{children}</div>
          {footer && (
            <footer style={{ padding: `${SPACING.md} ${SPACING['2xl']} ${SPACING.xl}` }}>
              {footer}
            </footer>
          )}
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
      <main style={{ paddingTop: `var(--nav-height, ${navHeight}px)` }}>
        {/* Header zone — Signature Hero */}
        {header && (
          <header
            style={{
              padding: `${SPACING.xl} ${SPACING['2xl']} ${SPACING.lg}`,
              maxWidth: '1440px',
              margin: '0 auto',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {header}
          </header>
        )}

        {/* Main content zone — Food Preview Gallery, Featured Menu, Order Menu */}
        <div
          style={{
            width: '100%',
            maxWidth: '1440px',
            margin: '0 auto',
            padding: `0 ${SPACING['2xl']} ${SPACING['3xl']}`,
            boxSizing: 'border-box',
          }}
        >
          {children}
        </div>

        {/* Footer zone — Premium footer with 3D CRUNCH */}
        {footer && (
          <footer
            style={{
              padding: `${SPACING['2xl']} ${SPACING['2xl']} ${SPACING['3xl']}`,
              maxWidth: '1440px',
              margin: '0 auto',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {footer}
          </footer>
        )}
      </main>

      {/* Global responsive styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 1024px) {
          main > header,
          main > div,
          main > footer {
            padding-left: ${SPACING.lg} !important;
            padding-right: ${SPACING.lg} !important;
          }
        }
        @media (max-width: 768px) {
          main > header {
            padding-top: ${SPACING.lg} !important;
            padding-bottom: ${SPACING.md} !important;
            padding-left: ${SPACING.md} !important;
            padding-right: ${SPACING.md} !important;
          }
          main > div {
            padding-left: ${SPACING.md} !important;
            padding-right: ${SPACING.md} !important;
            padding-bottom: ${SPACING.xl} !important;
          }
          main > footer {
            padding-left: ${SPACING.md} !important;
            padding-right: ${SPACING.md} !important;
            padding-top: ${SPACING.xl} !important;
            padding-bottom: ${SPACING.lg} !important;
          }
        }
        @media (max-width: 430px) {
          main > header {
            padding-top: ${SPACING.md} !important;
            padding-bottom: ${SPACING.sm} !important;
            padding-left: ${SPACING.md} !important;
            padding-right: ${SPACING.md} !important;
          }
          main > div {
            padding-left: ${SPACING.md} !important;
            padding-right: ${SPACING.md} !important;
            padding-bottom: ${SPACING.lg} !important;
          }
          main > footer {
            padding-left: ${SPACING.md} !important;
            padding-right: ${SPACING.md} !important;
            padding-top: ${SPACING.lg} !important;
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