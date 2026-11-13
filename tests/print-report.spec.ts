import { test, expect } from '@playwright/test';

test.describe('Sales Reports Print Verification', () => {
  test.use({ colorScheme: 'light' });

  async function authenticate(page) {
    await page.addInitScript(() => {
      localStorage.setItem('authToken', 'test-token');
      localStorage.setItem('userName', 'testuser');
      localStorage.setItem('userEmail', 'test@crunch.com');
      localStorage.setItem('userRole', 'administrator');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userEmailVerified', 'true');
      localStorage.setItem('isAuthenticated', 'true');
    });
  }

  async function mockOrdersAPI(page) {
    await page.route('**/api/orders', async route => {
      const mockOrders = [
        {
          id: 1,
          transactionId: 'TXN-001',
          date: '2025-01-15',
          time: '12:30 PM',
          type: 'Sale',
          product: 'Signature Chicken',
          category: 'Main',
          quantity: 2,
          unitPrice: 150,
          total: 300,
          status: 'Completed',
          paymentMethod: 'cash',
          paymentStatus: 'paid',
          paymentReference: 'CASH-001',
          createdAt: '2025-01-15T12:30:00Z',
          paymentDate: '2025-01-15T12:30:00Z',
          riderName: null,
          handoverTimestamp: null,
          cashierName: 'John Doe',
          items: [
            { name: 'Signature Chicken', quantity: 2, unitPrice: 150 }
          ],
          orderType: 'dine-in',
          handoverStaffName: null
        },
        {
          id: 2,
          transactionId: 'TXN-002',
          date: '2025-01-15',
          time: '01:15 PM',
          type: 'Sale',
          product: 'Crunch Burger',
          category: 'Main',
          quantity: 1,
          unitPrice: 180,
          total: 180,
          status: 'Completed',
          paymentMethod: 'online',
          paymentStatus: 'paid',
          paymentReference: 'ONL-002',
          createdAt: '2025-01-15T13:15:00Z',
          paymentDate: '2025-01-15T13:15:00Z',
          riderName: 'Rider One',
          handoverTimestamp: '2025-01-15T13:20:00Z',
          cashierName: 'Jane Smith',
          items: [
            { name: 'Crunch Burger', quantity: 1, unitPrice: 180 }
          ],
          orderType: 'delivery',
          handoverStaffName: 'Staff A'
        }
      ];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockOrders)
      });
    });

    await page.route('**/api/settings/general', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          restaurantName: 'THE CRUNCH',
          tagline: 'Where Flavor Meets Craft',
          address: '123 Flavor Street, Food City',
          phone: '+1-555-0123',
          email: 'hello@thecrunch.com',
          currency: 'PHP',
          timezone: 'Asia/Manila',
          taxRate: 0.12,
          serviceChargeRate: 0.10
        })
      });
    });
  }

  test('Print Report - Sales Logs tab generates clean PDF', async ({ page }) => {
    test.setTimeout(60000);
    await authenticate(page);
    await mockOrdersAPI(page);

    await page.goto('/sales-reports');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Click Sales Logs tab if not active
    await page.click('button:has-text("Sales Logs")');
    await page.waitForTimeout(500);

    // Take print-media screenshot first to verify layout
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(500);

    const printScreenshot = await page.screenshot({
      fullPage: true,
      path: 'test-results/print-sales-logs.png'
    });

    // Verify key elements are visible in print media
    await expect(page.locator('.print-report-brand')).toBeVisible();
    await expect(page.locator('.print-report-title')).toBeVisible();
    await expect(page.locator('.print-summary-grid')).toBeVisible();
    await expect(page.locator('.print-table')).toBeVisible();
    await expect(page.locator('.print-footer')).toBeVisible();

    // Verify dashboard chrome is hidden
    await expect(page.locator('.sidebar')).toBeHidden();
    await expect(page.locator('header')).toBeHidden();
    await expect(page.locator('nav')).toBeHidden();
    await expect(page.locator('button:has-text("Print Report")')).toBeHidden();
    await expect(page.locator('.filter-chips')).toBeHidden();
    await expect(page.locator('.pagination')).toBeHidden();

    // Generate PDF
    const pdf = await page.pdf({
      path: 'test-results/print-sales-logs.pdf',
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '12mm', bottom: '15mm', left: '12mm' }
    });

    console.log(`PDF generated: ${pdf.length} bytes`);

    // Verify PDF is not empty
    expect(pdf.length).toBeGreaterThan(1000);
  });

  test('Print Report - Order History tab generates clean PDF', async ({ page }) => {
    test.setTimeout(60000);
    await authenticate(page);
    await mockOrdersAPI(page);

    await page.goto('/sales-reports');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Click Order History tab
    await page.click('button:has-text("Order History")');
    await page.waitForTimeout(500);

    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(500);

    // Verify key elements
    await expect(page.locator('.print-report-brand')).toBeVisible();
    await expect(page.locator('.print-report-title')).toBeVisible();
    await expect(page.locator('.print-summary-grid')).toBeVisible();
    await expect(page.locator('.print-table')).toBeVisible();
    await expect(page.locator('.print-footer')).toBeVisible();

    // Verify chrome hidden
    await expect(page.locator('.sidebar')).toBeHidden();
    await expect(page.locator('header')).toBeHidden();
    await expect(page.locator('nav')).toBeHidden();
    await expect(page.locator('button:has-text("Print Report")')).toBeHidden();

    // Generate PDF
    const pdf = await page.pdf({
      path: 'test-results/print-order-history.pdf',
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '12mm', bottom: '15mm', left: '12mm' }
    });

    console.log(`PDF generated: ${pdf.length} bytes`);
    expect(pdf.length).toBeGreaterThan(1000);
  });

  test('Print Report - Screen layout unchanged in screen media', async ({ page }) => {
    test.setTimeout(60000);
    await authenticate(page);
    await mockOrdersAPI(page);

    await page.goto('/sales-reports');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Default is screen media
    // Verify Print Report button is visible
    await expect(page.locator('button:has-text("Print Report")')).toBeVisible();

    // Verify print-only container is hidden
    await expect(page.locator('.print-only')).toBeHidden();
  });

  test('Print Report - Empty state handling', async ({ page }) => {
    test.setTimeout(60000);
    await authenticate(page);

    // Mock empty orders
    await page.route('**/api/orders', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.route('**/api/settings/general', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          restaurantName: 'THE CRUNCH',
          tagline: 'Where Flavor Meets Craft',
          address: '123 Flavor Street, Food City',
          phone: '+1-555-0123',
          email: 'hello@thecrunch.com',
          currency: 'PHP',
          timezone: 'Asia/Manila'
        })
      });
    });

    await page.goto('/sales-reports');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(500);

    // Print report should still render (with empty table)
    await expect(page.locator('.print-report-brand')).toBeVisible();
    await expect(page.locator('.print-table')).toBeVisible();

    const pdf = await page.pdf({
      path: 'test-results/print-empty.pdf',
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '12mm', bottom: '15mm', left: '12mm' }
    });

    expect(pdf.length).toBeGreaterThan(1000);
  });
});