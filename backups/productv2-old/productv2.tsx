/**
 * Products V2 — Premium Featured Selection Showcase
 * Full-viewport immersive product wheel with synchronized ambient atmosphere
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { api, resolveAssetUrl } from '@/lib/api';
import { Navbar } from '@/components/Navbar';
import { WorksWheel, type WorksWheelItem } from '@/components/ui/works-wheel';
import { ProductsV2Layout } from './ProductsV2Layout';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { PageHeader } from '@/components/ui/PageHeader';
import { InteractionGuidance } from '@/components/ui/InteractionGuidance';
import { ProductWheelSkeleton } from '@/components/ui/ProductWheelSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PAGE_COLORS } from '@/lib/design-tokens';
import type { Product } from './productv2.types';

// ── Types & helpers ────────────────────────────────────────────────────────
const normCat = (v: unknown): string => String(v ?? '').trim();

const mapProducts = (data: unknown[]): Product[] =>
  (data as Record<string, unknown>[])
    .map((r) => {
      const rawImage = String(r?.image ?? r?.img ?? '').trim();
      const resolvedImg = rawImage ? resolveAssetUrl(rawImage) : '';
      return {
        id: Number(r?.id ?? r?.product_id ?? 0),
        name: String(r?.name ?? r?.product_name ?? '').trim(),
        category: normCat(r?.category),
        rating: Number(r?.rating ?? 0),
        badge: String(r?.badge ?? '').trim(),
        description: String(r?.description ?? '').trim(),
        price: Number(r?.price ?? 0),
        spicy: Boolean(r?.spicy),
        img: resolvedImg,
        archived: String(r?.availability_status ?? r?.availabilityStatus ?? '').trim().toLowerCase() === 'hidden',
      };
    })
    .filter((p) => p.id > 0 && p.name);

// ── Main Products Page ─────────────────────────────────────────────────────
export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'empty' | 'ready'>('loading');
  const [turnProgress, setTurnProgress] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const fetchProducts = useCallback(async () => {
    try {
      setStatus('loading');
      const productsData = await api.get<unknown[]>('/products');
      const mapped = mapProducts(productsData);
      setProducts(mapped);
      setStatus(mapped.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      console.error('Failed to load products:', err);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Callback from WorksWheel for background synchronization
  const handleActiveChange = useCallback((progress: number, index: number) => {
    setTurnProgress(progress);
    setActiveIndex(index);
  }, []);

  // Map products to WorksWheel items
  const wheelItems = useMemo((): WorksWheelItem[] => {
    return products
      .filter((p) => !p.archived && p.img)
      .slice(0, 9)
      .map((p) => ({
        title: p.name,
        image: p.img,
        href: '/usersmenu?showOrderModal=true',
        category: p.category || undefined,
      }));
  }, [products]);

  // Render states
  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: PAGE_COLORS.background }}>
        <Navbar />
        <ProductsV2Layout
          header={<PageHeader />}
          guidance={<InteractionGuidance />}
        >
          <ProductWheelSkeleton />
        </ProductsV2Layout>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ minHeight: '100vh', background: PAGE_COLORS.background }}>
        <Navbar />
        <ProductsV2Layout
          header={<PageHeader />}
        >
          <ErrorState onRetry={fetchProducts} />
        </ProductsV2Layout>
      </div>
    );
  }

  if (status === 'empty' || wheelItems.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: PAGE_COLORS.background }}>
        <Navbar />
        <ProductsV2Layout
          header={<PageHeader />}
        >
          <EmptyState onRefresh={fetchProducts} />
        </ProductsV2Layout>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: PAGE_COLORS.background }}>
      <Navbar />
      <ProductsV2Layout
        header={<PageHeader />}
        guidance={<InteractionGuidance />}
      >
        {/* Ambient background synchronized to wheel */}
        <AmbientBackground
          turnProgress={turnProgress}
          activeIndex={activeIndex}
        />

        {/* WorksWheel Product Showcase */}
        <div
          style={{
            width: '100%',
            height: '100%',
            minHeight: '420px',
            position: 'relative',
            isolation: 'isolate',
          }}
        >
          <WorksWheel
            items={wheelItems}
            label="The Crunch Menu"
            action="Order"
            className="h-full w-full"
            onActiveChange={handleActiveChange}
          />
        </div>
      </ProductsV2Layout>
    </div>
  );
}