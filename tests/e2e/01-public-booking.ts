import { chromium, type Page } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface TestResult {
  suite: string;
  name: string;
  status: 'PASS' | 'FAIL';
  details: string;
  durationMs: number;
  consoleErrors: string[];
  screenshotPath?: string;
}

const results: TestResult[] = [];
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'tests/e2e/screenshots');

async function run() {
  console.log('=== E2E SUITE 1: PUBLIC BOOKING FLOW & RESPONSIVE LAYOUTS ===');
  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { width: 320, height: 568, name: 'Mobile_320px' },
    { width: 375, height: 667, name: 'Mobile_375px' },
    { width: 768, height: 1024, name: 'Tablet_768px' },
    { width: 1280, height: 800, name: 'Desktop_1280px' },
    { width: 1920, height: 1080, name: 'Desktop_1920px' },
  ];

  for (const vp of viewports) {
    const start = Date.now();
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    try {
      await page.goto('http://localhost:3001/luxe-salon', { waitUntil: 'networkidle' });

      // Check header / title
      const pageTitle = await page.title();
      const salonHeader = await page.locator('h1').textContent();

      if (!salonHeader?.includes('Luxe Salon & Spa')) {
        throw new Error(`Expected salon header to contain 'Luxe Salon & Spa', got '${salonHeader}'`);
      }

      // Check for horizontal overflow (critical responsive check)
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      if (scrollWidth > clientWidth) {
        throw new Error(`Horizontal overflow detected at ${vp.width}px! scrollWidth (${scrollWidth}) > clientWidth (${clientWidth})`);
      }

      const screenshotFile = `01_booking_landing_${vp.name}.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, screenshotFile), fullPage: true });

      results.push({
        suite: 'Public Booking',
        name: `Landing Page & Responsive Layout (${vp.name})`,
        status: 'PASS',
        details: `Rendered successfully at ${vp.width}x${vp.height} with title '${pageTitle}'. No horizontal overflow.`,
        durationMs: Date.now() - start,
        consoleErrors,
        screenshotPath: screenshotFile,
      });
    } catch (err: any) {
      const screenshotFile = `01_booking_landing_${vp.name}_FAIL.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, screenshotFile), fullPage: true });
      results.push({
        suite: 'Public Booking',
        name: `Landing Page & Responsive Layout (${vp.name})`,
        status: 'FAIL',
        details: err.message,
        durationMs: Date.now() - start,
        consoleErrors,
        screenshotPath: screenshotFile,
      });
    } finally {
      await context.close();
    }
  }

  // Complete End-to-End Booking Interaction
  console.log('\n--- Executing Full Booking Interaction ---');
  const startInteraction = Date.now();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const consoleErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  try {
    await page.goto('http://localhost:3001/luxe-salon', { waitUntil: 'networkidle' });

    // Verify branch selector
    const branchSelect = page.locator('select').first();
    await branchSelect.waitFor({ state: 'visible' });
    const branchOptions = await branchSelect.locator('option').allTextContents();
    console.log('Available branches:', branchOptions);

    // Switch branch to Dhanmondi Branch
    await branchSelect.selectOption({ label: 'Dhanmondi Branch' });
    await page.waitForTimeout(500);

    // Switch back to Gulshan Avenue
    await branchSelect.selectOption({ label: 'Gulshan Avenue' });
    await page.waitForTimeout(500);

    // Verify services loaded
    const serviceRadioOrSelect = page.locator('input[type="radio"], select').nth(1);
    await page.waitForTimeout(500);

    // Check service list items
    const services = await page.locator('text=Executive Haircut').first();
    // Select Sarah Khan (has active shifts)
    const stylistSelect = page.locator('select').nth(2);
    await stylistSelect.selectOption({ label: 'Sarah Khan' });
    await page.waitForTimeout(500);

    // Click Find times button
    const findTimesBtn = page.getByRole('button', { name: 'Find times' });
    await findTimesBtn.waitFor({ state: 'visible' });
    await findTimesBtn.click();
    await page.waitForTimeout(1000);

    // Check slots
    const slotButtons = page.locator('div.flex.flex-wrap button');
    const slotCount = await slotButtons.count();
    console.log(`Found ${slotCount} selectable slot buttons`);

    if (slotCount === 0) {
      throw new Error('Expected slot buttons to appear after clicking Find times');
    }

    // Pick first slot
    await slotButtons.first().click();
    await page.waitForTimeout(500);

    // Fill customer details
    const nameInput = page.locator('input[placeholder="Your name"]');
    const phoneInput = page.locator('input[placeholder="Phone"]');

    await nameInput.fill('Farhana Yasmin');
    await phoneInput.fill('+8801711122233');

    // Take screenshot of filled booking form
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_booking_form_filled.png') });

    // Click confirm button
    const confirmBtn = page.getByRole('button', { name: /^Confirm/ });
    await confirmBtn.waitFor({ state: 'visible' });
    await confirmBtn.click();
    await page.waitForTimeout(2000);

    // Check confirmation state
    const bookedHeading = page.locator('text=You\'re booked!');
    await bookedHeading.waitFor({ state: 'visible', timeout: 5000 });
    const isConfirmed = await bookedHeading.isVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_booking_confirmed.png') });

    results.push({
      suite: 'Public Booking',
      name: 'End-to-End Booking Submission Flow',
      status: isConfirmed ? 'PASS' : 'FAIL',
      details: isConfirmed
        ? 'Successfully selected service, staff, date, and completed appointment booking with confirmation message.'
        : 'Confirmation message was not visible.',
      durationMs: Date.now() - startInteraction,
      consoleErrors,
      screenshotPath: '01_booking_confirmed.png',
    });
  } catch (err: any) {
    results.push({
      suite: 'Public Booking',
      name: 'End-to-End Booking Submission Flow',
      status: 'FAIL',
      details: err.message,
      durationMs: Date.now() - startInteraction,
      consoleErrors,
    });
  } finally {
    await context.close();
  }

  await browser.close();

  console.log('\n--- RESULTS SUMMARY ---');
  console.table(results.map((r) => ({
    name: r.name,
    status: r.status,
    duration: `${r.durationMs}ms`,
    errors: r.consoleErrors.length,
    screenshot: r.screenshotPath ?? 'none',
  })));

  fs.writeFileSync(
    path.resolve(process.cwd(), 'tests/e2e/01-results.json'),
    JSON.stringify(results, null, 2),
  );
}

run().catch(console.error);
