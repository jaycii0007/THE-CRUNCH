# Implementation Plan: Products V2 Redesign

## Overview
Redesign `src/pages/productv2.tsx` around the existing `WorksWheel` component to create a full-viewport, premium black-and-gold product showcase that feels cohesive, immersive, and professionally art-directed. The WorksWheel component (the "Flavor Dial") must remain visually and functionally unchanged while its surrounding page environment is elevated to a premium cinematic showroom experience.

## Architecture Decisions

### 1. WorksWheel Integration Strategy
- **Preserve WorksWheel exactly as-is** — no modifications to its internal geometry, animations, or interaction logic
- **Use WorksWheel's existing callbacks**: The component exposes `turnProgress` (continuous 0–count value) and `active` index via its internal state. We'll need to add a minimal `onActiveChange` callback prop to enable background synchronization
- **Color token alignment**: WorksWheel uses its own inline `COLORS` object. The page background will use the same hex values for consistency (`#0D0D0D`, `#C9A84C`, `#F5F2EA`, `#A69C8E`)

### 2. Full-Viewport Layout
- Use CSS `calc(100vh - var(--nav-height))` for content area height
- Dynamically measure Navbar height via `ResizeObserver` on mount
- Use Flexbox column layout: Header → WorksWheel (flex: 1) → Optional guidance
- Eliminate fixed pixel heights; use proportional spacing

### 3. Background Synchronization
- Create `AmbientBackground` component that reads `turnProgress` from WorksWheel
- Subtle amber radial gradients, vignette, and orbital rings that respond to active product
- Respect `prefers-reduced-motion` — disable all ambient animations when reduced

### 4. Responsive Breakpoints
| Breakpoint | Strategy |
|------------|----------|
| 1440px+ | Generous horizontal padding, carousel dominates, editorial title + rail side-by-side |
| 1024–1439px | Proportional scaling, maintain side zones |
| 768–1023px | Stack title above wheel, rail becomes horizontal chip bar below |
| 320–767px | Full-width wheel, minimal padding, vertical flow |

### 5. Loading/Error/Empty States
- Render **outside** WorksWheel (not inside the component)
- Skeleton loading matching WorksWheel proportions
- Elegant empty state with CTA to retry
- Error state with clear messaging and retry button

### 6. Real Product Data
- Map API `Product[]` → `WorksWheelItem[]` (title, image, href, category)
- Filter archived products, require valid images
- Take up to 9 featured products for the wheel

## Task List

### Phase 1: Foundation & Types
- [ ] **Task 1**: Add `onActiveChange` callback prop to WorksWheel (minimal change)
- [ ] **Task 2**: Create shared color token constants file for page/WorksWheel consistency
- [ ] **Task 3**: Define TypeScript interfaces for page state (loading, error, empty)

### Phase 2: Layout & Background Components
- [ ] **Task 4**: Build `ProductsV2Layout` component with dynamic navbar height detection
- [ ] **Task 5**: Build `AmbientBackground` component synchronized to `turnProgress`
- [ ] **Task 6**: Build `PageHeader` component (heading + subtitle, responsive)
- [ ] **Task 7**: Build `InteractionGuidance` component (minimal, optional)

### Phase 3: Integration & States
- [ ] **Task 8**: Integrate WorksWheel with new layout, pass real product data
- [ ] **Task 9**: Implement loading skeleton matching WorksWheel proportions
- [ ] **Task 10**: Implement empty state (no products with images)
- [ ] **Task 11**: Implement error state with retry

### Phase 4: Responsive Polish
- [ ] **Task 12**: Add responsive CSS for all 7 breakpoints (320, 375, 390, 430, 768, 1024, 1440)
- [ ] **Task 13**: Test and fix mobile touch interactions, prevent horizontal overflow
- [ ] **Task 14**: Verify reduced-motion accessibility compliance

### Phase 5: Verification
- [ ] **Task 15**: Run TypeScript build (`npm run build`)
- [ ] **Task 16**: Manual verification at all breakpoints
- [ ] **Task 17**: Verify `/products` page unaffected
- [ ] **Task 18**: Report changed files and any limitations

## Checkpoints

### Checkpoint: Foundation (After Tasks 1-3)
- [ ] WorksWheel accepts `onActiveChange` callback without breaking existing functionality
- [ ] Color tokens shared and consistent
- [ ] Types compile without errors

### Checkpoint: Core Layout (After Tasks 4-7)
- [ ] Page fills viewport beneath navbar
- [ ] Ambient background renders and responds to turnProgress
- [ ] Header and guidance render correctly
- [ ] No console errors

### Checkpoint: Integration (After Tasks 8-11)
- [ ] Real products load and display in WorksWheel
- [ ] Loading, empty, error states work correctly
- [ ] No demo/Unsplash images appear

### Checkpoint: Complete (After Tasks 12-18)
- [ ] All breakpoints visually correct
- [ ] Build passes
- [ ] Original `/products` page works unchanged

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| WorksWheel internal changes needed for callback | High | Add optional callback prop only; default to no-op |
| Navbar height measurement race condition | Medium | Use ResizeObserver + fallback to CSS variable |
| Background sync performance on mobile | Medium | Reduce blur/opacity on mobile via media queries |
| Product image loading delays | Low | WorksWheel has built-in shimmer; page shows skeleton first |
| Horizontal overflow on small screens | High | Test at 320px; use `overflow-x: hidden` on page wrapper |

## Open Questions
1. Should the `onActiveChange` callback fire on `turnProgress` change (continuous) or only on `active` index change (discrete)? → **Continuous `turnProgress` for smooth background sync**
2. Does the existing `/products` page need to be preserved exactly, or can it share components? → **Must remain unaffected per requirements**
3. Should we add a "View All Products" CTA below the wheel? → **Only if useful per requirement #4 — minimal guidance only**