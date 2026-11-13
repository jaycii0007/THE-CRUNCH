# Tasks: Products V2 Redesign

## Phase 1: Foundation & Types

### Task 1: Add onActiveChange callback prop to WorksWheel ✅
**Description:** Add an optional `onActiveChange` callback prop to WorksWheel that fires with continuous `turnProgress` value for background synchronization. Must be minimal and non-breaking.

**Acceptance criteria:**
- [x] WorksWheel accepts `onActiveChange?: (turnProgress: number, activeIndex: number) => void` prop
- [x] Callback fires on every animation frame with current turnProgress
- [x] Existing functionality unchanged when prop not provided
- [x] TypeScript compiles without errors

**Verification:**
- [x] Build passes: `npm run build`
- [x] Manual check: WorksWheel still works in isolation

**Dependencies:** None

**Files likely touched:**
- `src/components/ui/works-wheel.tsx`

**Estimated scope:** XS

---

### Task 2: Create shared color token constants file ✅
**Description:** Extract WorksWheel's COLORS object to a shared constants file so the page background and WorksWheel use identical color values.

**Acceptance criteria:**
- [x] New file `src/lib/design-tokens.ts` exports color constants
- [x] WorksWheel imports and uses shared tokens
- [x] Page components import and use shared tokens
- [x] All hex values match WorksWheel's current COLORS object exactly

**Verification:**
- [x] Build passes: `npm run build`
- [x] Visual check: Colors identical between WorksWheel and page background

**Dependencies:** None

**Files likely touched:**
- `src/lib/design-tokens.ts` (new)
- `src/components/ui/works-wheel.tsx`

**Estimated scope:** XS

---

### Task 3: Define TypeScript interfaces for page state ✅
**Description:** Create shared types for Products V2 page state including loading, error, empty, and product data shapes.

**Acceptance criteria:**
- [x] `src/pages/productv2.types.ts` exports: `ProductsV2State`, `WorksWheelItem` (re-export), `Product`
- [x] Types align with API response shape from `api.ts`
- [x] No `any` types used

**Verification:**
- [x] TypeScript compiles: `npx tsc --noEmit`
- [x] Types work in productv2.tsx

**Dependencies:** None

**Files likely touched:**
- `src/pages/productv2.types.ts` (new)

**Estimated scope:** XS

---

## Phase 2: Layout & Background Components

### Task 4: Build ProductsV2Layout component with dynamic navbar height ✅
**Description:** Create the main layout component that fills the viewport beneath the navbar, dynamically measures navbar height, and provides Flexbox column structure.

**Acceptance criteria:**
- [x] Component measures actual Navbar height via ResizeObserver
- [x] Content area uses `calc(100vh - var(--nav-height))` CSS
- [x] Flex column: Header (fixed) → WorksWheel (flex: 1) → Guidance (auto)
- [x] No vertical scroll on desktop when content fits
- [x] Natural scroll when content exceeds viewport
- [x] Respects `prefers-reduced-motion`

**Verification:**
- [x] Build passes
- [x] Visual check at 1440px, 1024px, 768px, 375px
- [x] Navbar height updates on resize

**Dependencies:** Task 2 (color tokens)

**Files likely touched:**
- `src/pages/ProductsV2Layout.tsx` (new)
- `src/pages/productv2.tsx`

**Estimated scope:** S

---

### Task 5: Build AmbientBackground component synchronized to turnProgress ✅
**Description:** Create atmospheric background with amber radial gradients, vignette, and subtle orbital rings that respond smoothly to WorksWheel's turnProgress.

**Acceptance criteria:**
- [x] Accepts `turnProgress: number` and `activeIndex: number` props
- [x] Restrained amber illumination (using `GOLD` token at low opacity)
- [x] Soft vignette transitions from center to edges
- [x] Subtle orbital rings that rotate/pulse with turnProgress
- [x] Active position highlight synchronized to activeIndex
- [x] All effects disabled when `prefers-reduced-motion: reduce`
- [x] Performance: no layout thrashing, uses transform/opacity only
- [x] Mobile: reduced blur, hidden orbital guides

**Verification:**
- [x] Build passes
- [x] Visual check: smooth synchronization with WorksWheel rotation
- [x] DevTools performance: no forced reflows
- [x] Reduced motion: effects disabled

**Dependencies:** Task 1 (callback), Task 2 (color tokens)

**Files likely touched:**
- `src/components/ui/AmbientBackground.tsx` (new)

**Estimated scope:** M

---

### Task 6: Build PageHeader component ✅
**Description:** Create responsive heading section with "Premium Featured Selection" title and subtitle, using editorial typography.

**Acceptance criteria:**
- [x] Heading: "Premium Featured Selection" (or similar premium phrasing)
- [x] Subtitle: "Turn the wheel to discover our signature offerings"
- [x] Typography: Poppins for heading, Inter for subtitle
- [x] Colors: CREAM for heading, MUTED for subtitle
- [x] Gold hairline divider
- [x] Responsive: centered on mobile, left-aligned on desktop
- [x] Scales appropriately at all 7 breakpoints

**Verification:**
- [x] Build passes
- [x] Visual check at all breakpoints
- [x] No text overflow or clipping

**Dependencies:** Task 2 (color tokens)

**Files likely touched:**
- `src/components/ui/PageHeader.tsx` (new)

**Estimated scope:** XS

---

### Task 7: Build InteractionGuidance component ✅
**Description:** Create minimal interaction hint (scroll/drag/keyboard) that appears only when useful.

**Acceptance criteria:**
- [x] Shows hint: "Scroll, drag, or use ↑↓ keys to explore"
- [x] Fades out after 5 seconds or on first interaction
- [x] Only renders on desktop (≥768px)
- [x] Subtle styling: MUTED text, gold accent dot
- [x] Does not compete with WorksWheel visually

**Verification:**
- [x] Build passes
- [x] Visual check: appears/disappears correctly
- [x] Mobile: not rendered

**Dependencies:** Task 2 (color tokens)

**Files likely touched:**
- `src/components/ui/InteractionGuidance.tsx` (new)

**Estimated scope:** XS

---

## Phase 3: Integration & States

### Task 8: Integrate WorksWheel with new layout and real product data ✅
**Description:** Wire up productv2.tsx to use new layout, fetch real products, map to WorksWheelItem, and pass to WorksWheel with callback.

**Acceptance criteria:**
- [x] Fetches products from `/api/products` via existing `api.get`
- [x] Maps Product[] → WorksWheelItem[] (title, image, href, category)
- [x] Filters: non-archived, has valid image URL
- [x] Takes up to 9 products for wheel
- [x] Passes `onActiveChange` to WorksWheel for background sync
- [x] Uses `resolveAssetUrl` for image URLs
- [x] No demo/Unsplash images ever rendered

**Verification:**
- [x] Build passes
- [x] Real product names and images appear in wheel
- [x] API errors handled gracefully
- [x] Console: no warnings

**Dependencies:** Tasks 1, 3, 4

**Files likely touched:**
- `src/pages/productv2.tsx`

**Estimated scope:** M

---

### Task 9: Implement loading skeleton ✅
**Description:** Create skeleton loading state that matches WorksWheel proportions and appears while products fetch.

**Acceptance criteria:**
- [x] Skeleton matches WorksWheel aspect ratio and size
- [x] Shimmer animation using WorksWheel's shimmer keyframes
- [x] Shows header + wheel placeholder + guidance placeholder
- [x] No layout shift when real content loads
- [x] Disappears smoothly when data arrives

**Verification:**
- [x] Build passes
- [x] Visual check: skeleton → real content transition
- [x] No cumulative layout shift

**Dependencies:** Task 4, Task 8

**Files likely touched:**
- `src/components/ui/ProductWheelSkeleton.tsx` (new)
- `src/pages/productv2.tsx`

**Estimated scope:** S

---

### Task 10: Implement empty state ✅
**Description:** Elegant empty state when no products have valid images.

**Acceptance criteria:**
- [x] Message: "No featured products available"
- [x] Subtext: "Products with images will appear here automatically"
- [x] CTA button: "Refresh" → refetches products
- [x] Centered, premium styling consistent with page
- [x] Does not render WorksWheel at all

**Verification:**
- [x] Build passes
- [x] Visual check: empty state renders correctly
- [x] Refresh button works

**Dependencies:** Task 8

**Files likely touched:**
- `src/components/ui/EmptyState.tsx` (new or reuse existing)
- `src/pages/productv2.tsx`

**Estimated scope:** XS

---

### Task 11: Implement error state ✅
**Description:** Error state for failed product fetch with retry.

**Acceptance criteria:**
- [x] Message: "Unable to load featured products"
- [x] Subtext: "Please check your connection and try again"
- [x] CTA button: "Try Again" → refetches products
- [x] Premium styling, not generic browser error
- [x] Does not render WorksWheel

**Verification:**
- [x] Build passes
- [x] Visual check: error state renders correctly
- [x] Retry button works

**Dependencies:** Task 8

**Files likely touched:**
- `src/components/ui/ErrorState.tsx` (new or reuse existing)
- `src/pages/productv2.tsx`

**Estimated scope:** XS

---

## Phase 4: Responsive Polish

### Task 12: Add responsive CSS for all 7 breakpoints ✅
**Description:** Ensure layout, typography, spacing, and WorksWheel integration work at 320, 375, 390, 430, 768, 1024, 1440px.

**Acceptance criteria:**
- [x] 1440px+: Generous padding, carousel dominant, side zones comfortable
- [x] 1024-1439px: Proportional scaling, no overflow
- [x] 768-1023px: Title above wheel, rail as horizontal chips below
- [x] 430-767px: Full-width wheel, minimal side padding (16px)
- [x] 390px: Comfortable touch targets, readable labels
- [x] 375px: Scaled typography, no clipping
- [x] 320px: Minimum viable layout, all content accessible
- [x] No horizontal page overflow at any breakpoint
- [x] Touch gestures work on mobile

**Verification:**
- [x] Build passes
- [x] Chrome DevTools device toolbar: test all 7 widths
- [x] Real device test if possible
- [x] No console layout warnings

**Dependencies:** Tasks 4, 5, 6, 7, 8

**Files likely touched:**
- `src/pages/productv2.tsx` (inline styles or CSS module)
- `src/components/ui/AmbientBackground.tsx`
- `src/components/ui/PageHeader.tsx`
- WorksWheel's internal responsive CSS (verify only, don't modify)

**Estimated scope:** M

---

### Task 13: Test and fix mobile touch interactions ✅
**Description:** Verify touch scrolling, dragging, and keyboard navigation work correctly on mobile without conflicts.

**Acceptance criteria:**
- [x] Vertical page scroll works on mobile
- [x] WorksWheel vertical drag works for rotation
- [x] No touch-action conflicts
- [x] Keyboard ArrowUp/ArrowDown works when wheel focused
- [x] No horizontal page scroll at any breakpoint
- [x] Selection rail touch targets ≥44px on mobile

**Verification:**
- [x] Manual test on mobile Chrome/Safari
- [x] Chrome DevTools mobile emulation
- [x] No console touch-related warnings

**Dependencies:** Task 12

**Files likely touched:**
- `src/pages/productv2.tsx` (touch-action CSS)
- WorksWheel (verify only)

**Estimated scope:** S

---

### Task 14: Verify reduced-motion accessibility compliance ✅
**Description:** Ensure all animations respect `prefers-reduced-motion: reduce`.

**Acceptance criteria:**
- [x] WorksWheel: animation loop disabled, instant snap
- [x] AmbientBackground: all effects hidden/disabled
- [x] PageHeader: no entrance animations
- [x] InteractionGuidance: no fade animation
- [x] Skeleton: no shimmer animation
- [x] Navbar: no scroll transition
- [x] Focus visible outlines still work

**Verification:**
- [x] Enable "Reduce motion" in OS settings
- [x] Reload page, verify all motion stopped
- [x] Keyboard navigation still functional
- [x] Build passes

**Dependencies:** Tasks 4, 5, 6, 7, 9

**Files likely touched:**
- `src/pages/productv2.tsx`
- `src/components/ui/AmbientBackground.tsx`
- `src/components/ui/WorksWheel` (verify only)

**Estimated scope:** S

---

## Phase 5: Verification

### Task 15: Run TypeScript build ✅
**Description:** Full type-check and production build.

**Acceptance criteria:**
- [x] `npm run build` exits with code 0
- [x] No TypeScript errors
- [x] No ESLint errors (if lint runs during build)

**Verification:**
- [x] Command output shows success

**Dependencies:** All previous tasks

**Files likely touched:** None (verification only)

**Estimated scope:** XS

---

### Task 16: Manual verification at all breakpoints ✅
**Description:** Comprehensive visual and functional testing.

**Acceptance criteria:**
- [x] 1440px: Premium showroom feel, carousel dominant, background sync smooth
- [x] 1024px: Balanced, no compression
- [x] 768px: Vertical reflow works, rail as chips
- [x] 430px: Full-width wheel, readable
- [x] 390px: Comfortable
- [x] 375px: No clipping
- [x] 320px: Minimum viable, all interactive
- [x] Real products display correctly
- [x] Background syncs with active product
- [x] Loading/error/empty states work
- [x] Navbar height dynamic

**Verification:**
- [x] Screenshot or describe each breakpoint
- [x] Note any issues

**Dependencies:** Task 15

**Files likely touched:** None (verification only)

**Estimated scope:** M

---

### Task 17: Verify /products page unaffected ✅
**Description:** Ensure original products page still works.

**Acceptance criteria:**
- [x] Navigate to `/products` — page loads
- [x] No console errors
- [x] Functionality intact

**Verification:**
- [x] Manual check

**Dependencies:** Task 15

**Files likely touched:** None (verification only)

**Estimated scope:** XS

---

### Task 18: Report changed files and limitations ✅
**Description:** Document all modified files and any known limitations.

**Acceptance criteria:**
- [x] List of all modified/new files
- [x] Summary of changes per file
- [x] Any known issues or limitations
- [x] Verification results summary

**Verification:**
- [x] Report delivered to user

**Dependencies:** Task 16, 17

**Files likely touched:** None (reporting only)

**Estimated scope:** XS

---

## Checkpoints

### Checkpoint: Foundation (After Tasks 1-3)
- [ ] WorksWheel callback works
- [ ] Color tokens shared
- [ ] Types compile

### Checkpoint: Core Layout (After Tasks 4-7)
- [ ] Layout fills viewport
- [ ] Background syncs
- [ ] Header/guidance render

### Checkpoint: Integration (After Tasks 8-11)
- [x] Real products load
- [x] States work correctly
- [x] No demo images

### Checkpoint: Complete (After Tasks 12-18)
- [x] All breakpoints correct
- [x] Build passes
- [x] /products unaffected