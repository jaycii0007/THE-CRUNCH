/**
 * Products V2 Page Types
 * Shared type definitions for the Products V2 page
 */

import type { WorksWheelItem } from '@/components/ui/works-wheel';

// Re-export for convenience
export type { WorksWheelItem };

/** Raw product shape from API */
export interface ApiProduct {
  id: number | string;
  name: string;
  product_name?: string;
  category: string;
  rating: number;
  badge: string;
  description: string;
  price: number;
  spicy: boolean;
  image: string;
  img?: string;
  availability_status?: string;
  availabilityStatus?: string;
}

/** Normalized product for internal use */
export interface Product {
  id: number;
  name: string;
  category: string;
  rating: number;
  badge: string;
  description: string;
  price: number;
  spicy: boolean;
  img: string;
  archived: boolean;
}

/** Page loading states */
export type ProductsV2Status = 'loading' | 'error' | 'empty' | 'ready';

/** Page state shape */
export interface ProductsV2State {
  status: ProductsV2Status;
  products: Product[];
  wheelItems: WorksWheelItem[];
  error: string | null;
}

/** Props for the main page component */
export interface ProductsV2PageProps {
  /** Optional initial products for SSR/hydration */
  initialProducts?: Product[];
  /** Optional initial error */
  initialError?: string | null;
}