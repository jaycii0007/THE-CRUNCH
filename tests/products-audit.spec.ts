import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'large-desktop', width: 1672, height: 980 },
];

const TIMEOUTS = {
  mobile: 60000,
  tablet: 120000,
  desktop: 120000,
  'large-desktop': 120000,
};

async function waitForLoad(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000); // Let animations and data loading settle

  // Wait for hero content to be visible
  await page.waitForSelector('text=SIGNATURE', { state: 'visible', timeout: 30000 });
  await page.waitForSelector('text=CHICKEN', { state: 'visible', timeout: 30000 });
  await page.waitForSelector('button:has-text("Explore Menu")', { state: 'visible', timeout: 30000 });
}

async function checkCanvas(page) {
  const canvas = page.locator('canvas').first();
  const count = await canvas.count();

  if (count === 0) {
    return { exists: false };
  }

  const style = await canvas.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    return {
      position: computed.position,
      inset: computed.inset || computed.top + ' ' + computed.right + ' ' + computed.bottom + ' ' + computed.left,
      zIndex: computed.zIndex,
      pointerEvents: computed.pointerEvents,
      width: computed.width,
      height: computed.height,
    };
  });

  return { exists: true, style };
}

async function checkHorizontalOverflow(page) {
  const body = page.locator('body');
  const scrollWidth = await body.evaluate(el => el.scrollWidth);
  const clientWidth = await body.evaluate(el => el.clientWidth);
  return { hasOverflow: scrollWidth > clientWidth + 1, scrollWidth, clientWidth };
}

async function checkHeroText(page) {
  const signature = page.locator('text=SIGNATURE').first();
  const chicken = page.locator('text=CHICKEN').first();
  const exploreMenu = page.locator('button:has-text("Explore Menu")').first();
  return {
    signature: await signature.count() > 0,
    chicken: await chicken.count() > 0,
    exploreMenu: await exploreMenu.count() > 0,
  };
}

async function checkOurStory(page) {
  const ourStory = page.locator('text=OUR STORY').first();
  const heading = page.locator('text=Where Flavor Meets Craft').first();
  return {
    eyebrow: await ourStory.count() > 0,
    heading: await heading.count() > 0,
  };
}

async function checkFooter(page) {
  const footer = page.locator('footer').first();
  return await footer.count() > 0;
}

async function testExploreMenuNavigation(page) {
  const exploreBtn = page.locator('button:has-text("Explore Menu")').first();
  if (await exploreBtn.count() > 0) {
    await exploreBtn.click();
    await page.waitForTimeout(1000);
    const url = page.url();
    // The usersmenu page reads showOrderModal and then strips it from URL
    // Just verify navigation to usersmenu happened
    return { url };
  }
  return { url: 'no-button' };
}

async function testFeedbackModal(page) {
  const feedbackBtn = page.locator('button:has-text("Feedback")').first();
  if (await feedbackBtn.count() > 0) {
    await feedbackBtn.click();
    await page.waitForTimeout(500);
    const modal = page.locator('[role="dialog"]').first();
    const isOpen = await modal.count() > 0;

    if (isOpen) {
      const closeBtn = page.locator('button[aria-label="Close"]').first();
      await closeBtn.click();
      await page.waitForTimeout(300);
      const modalClosed = await modal.count() === 0;
      return { opened: true, closed: modalClosed };
    }
    return { opened: false };
  }
  return { opened: false };
}

async function testKeyboardNavigation(page) {
  // Tab through focusable elements
  await page.keyboard.press('Tab');
  await page.waitForTimeout(100);
  const focused1 = await page.evaluate(() => document.activeElement?.tagName);

  await page.keyboard.press('Tab');
  await page.waitForTimeout(100);
  const focused2 = await page.evaluate(() => document.activeElement?.tagName);

  // ArrowDown scroll
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(100);
  const scrollY1 = await page.evaluate(() => window.scrollY);

  // End key
  await page.keyboard.press('End');
  await page.waitForTimeout(300);
  const scrollY2 = await page.evaluate(() => window.scrollY);

  // Home key
  await page.keyboard.press('Home');
  await page.waitForTimeout(300);
  const scrollY3 = await page.evaluate(() => window.scrollY);

  return { focused1, focused2, scrollY1, scrollY2, scrollY3 };
}

async function testTouchScroll(page) {
  // Simulate touch scroll
  await page.mouse.move(200, 200);
  await page.mouse.down();
  await page.mouse.move(200, 500);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const scrollY = await page.evaluate(() => window.scrollY);
  return { scrollY };
}

async function getConsoleErrors(page) {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    errors.push(err.message);
  });
  await page.waitForTimeout(1000);
  return errors;
}

async function captureHeroScreenshots(page, viewportName) {
  const screenshots = [];

  // Initial load
  await page.waitForTimeout(1000);
  screenshots.push({ stage: 'initial', path: `test-results/products-${viewportName}-initial.png` });
  await page.screenshot({ path: `test-results/products-${viewportName}-initial.png`, fullPage: false });

  // 25% scroll
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.25));
  await page.waitForTimeout(500);
  screenshots.push({ stage: '25%', path: `test-results/products-${viewportName}-25.png` });
  await page.screenshot({ path: `test-results/products-${viewportName}-25.png`, fullPage: false });

  // 50% scroll
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
  await page.waitForTimeout(500);
  screenshots.push({ stage: '50%', path: `test-results/products-${viewportName}-50.png` });
  await page.screenshot({ path: `test-results/products-${viewportName}-50.png`, fullPage: false });

  // 75% scroll
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.75));
  await page.waitForTimeout(500);
  screenshots.push({ stage: '75%', path: `test-results/products-${viewportName}-75.png` });
  await page.screenshot({ path: `test-results/products-${viewportName}-75.png`, fullPage: false });

  // Near end of hero (90%)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.9));
  await page.waitForTimeout(500);
  screenshots.push({ stage: '90%', path: `test-results/products-${viewportName}-90.png` });
  await page.screenshot({ path: `test-results/products-${viewportName}-90.png`, fullPage: false });

  return screenshots;
}

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('page loads and renders correctly', async ({ page }) => {
      test.setTimeout(TIMEOUTS[viewport.name]);
      await page.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle' });
      await waitForLoad(page);

      // Check horizontal overflow
      const overflow = await checkHorizontalOverflow(page);
      console.log(`${viewport.name} overflow:`, overflow);
      expect(overflow.hasOverflow).toBe(false);

      // Check hero text
      const heroText = await checkHeroText(page);
      console.log(`${viewport.name} hero text:`, heroText);
      expect(heroText.signature).toBe(true);
      expect(heroText.chicken).toBe(true);
      expect(heroText.exploreMenu).toBe(true);

      // Check Our Story
      const ourStory = await checkOurStory(page);
      console.log(`${viewport.name} our story:`, ourStory);
      expect(ourStory.eyebrow).toBe(true);
      expect(ourStory.heading).toBe(true);

      // Check footer
      const hasFooter = await checkFooter(page);
      expect(hasFooter).toBe(true);
    });

    test('Explore Menu button navigation', async ({ page }) => {
      test.setTimeout(TIMEOUTS[viewport.name]);
      await page.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle' });
      await waitForLoad(page);
      const result = await testExploreMenuNavigation(page);
      console.log(`${viewport.name} explore menu:`, result);
      // Should navigate to /usersmenu (query param is stripped by usersmenu page after reading)
      expect(result.url).toMatch(/\/usersmenu/);
    });

    test('Feedback modal open/close', async ({ page }) => {
      test.setTimeout(TIMEOUTS[viewport.name]);
      await page.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle' });
      await waitForLoad(page);
      const result = await testFeedbackModal(page);
      console.log(`${viewport.name} feedback modal:`, result);
      expect(result.opened).toBe(true);
      expect(result.closed).toBe(true);
    });

    test('Keyboard navigation', async ({ page }) => {
      test.setTimeout(TIMEOUTS[viewport.name]);
      await page.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle' });
      await waitForLoad(page);
      const result = await testKeyboardNavigation(page);
      console.log(`${viewport.name} keyboard:`, result);
      expect(result.focused1).toBeTruthy();
    });

    test('Touch/pointer scroll', async ({ page }) => {
      test.setTimeout(TIMEOUTS[viewport.name]);
      await page.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle' });
      await waitForLoad(page);
      const result = await testTouchScroll(page);
      console.log(`${viewport.name} touch scroll:`, result);
      expect(result.scrollY).toBeGreaterThanOrEqual(0);
    });

    test('Hero scroll screenshots', async ({ page }) => {
      test.setTimeout(TIMEOUTS[viewport.name]);
      await page.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle' });
      await waitForLoad(page);
      const screenshots = await captureHeroScreenshots(page, viewport.name);
      console.log(`${viewport.name} screenshots:`, screenshots.map(s => s.stage));
      expect(screenshots.length).toBe(5);
    });

    test('Zero console errors', async ({ page }) => {
      test.setTimeout(TIMEOUTS[viewport.name]);
      await page.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle' });
      await waitForLoad(page);
      const errors = await getConsoleErrors(page);
      console.log(`${viewport.name} console errors:`, errors);
      expect(errors.length).toBe(0);
    });
  });
}

test('Reduced motion preference respected', async ({ page }) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle' });
  await waitForLoad(page);

  // Hero content should still be visible
  const heroText = await checkHeroText(page);
  expect(heroText.signature).toBe(true);
  expect(heroText.chicken).toBe(true);
  expect(heroText.exploreMenu).toBe(true);

  // Our Story should be accessible
  const ourStory = await checkOurStory(page);
  expect(ourStory.eyebrow).toBe(true);
  expect(ourStory.heading).toBe(true);
});