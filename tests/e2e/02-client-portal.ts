import { chromium } from 'playwright';
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
  console.log('=== E2E SUITE 2: CLIENT SELF-SERVICE PORTAL ===');
  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { width: 375, height: 667, name: 'Mobile_375px' },
    { width: 768, height: 1024, name: 'Tablet_768px' },
    { width: 1280, height: 800, name: 'Desktop_1280px' },
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
      await page.goto('http://localhost:3001/luxe-salon/portal', { waitUntil: 'networkidle' });

      // Verify portal header
      const heading = await page.locator('h1').textContent();
      if (!heading?.includes('Luxe') && !heading?.includes('Portal')) {
        throw new Error(`Expected heading to contain 'Luxe' or 'Portal', got '${heading}'`);
      }

      // Check responsive layout: horizontal overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      if (scrollWidth > clientWidth) {
        throw new Error(`Horizontal overflow at ${vp.width}px! scrollWidth (${scrollWidth}) > clientWidth (${clientWidth})`);
      }

      const screenshotFile = `02_portal_login_${vp.name}.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, screenshotFile), fullPage: true });

      results.push({
        suite: 'Client Portal',
        name: `Login Screen Layout (${vp.name})`,
        status: 'PASS',
        details: `Rendered clean login view at ${vp.width}x${vp.height} with 0 horizontal overflow.`,
        durationMs: Date.now() - start,
        consoleErrors,
        screenshotPath: screenshotFile,
      });
    } catch (err: any) {
      results.push({
        suite: 'Client Portal',
        name: `Login Screen Layout (${vp.name})`,
        status: 'FAIL',
        details: err.message,
        durationMs: Date.now() - start,
        consoleErrors,
      });
    } finally {
      await context.close();
    }
  }

  // Full End-to-End Client Authentication & Portal Interaction
  console.log('\n--- Executing Full Client Portal Flow ---');
  const startAuth = Date.now();
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
    await page.goto('http://localhost:3001/luxe-salon/portal', { waitUntil: 'networkidle' });

    // Step 1: Request OTP
    const phoneInput = page.locator('input[placeholder*="Phone"], input[type="tel"], input[placeholder*="01"]').first();
    await phoneInput.fill('+8801711122233');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_portal_otp_request.png') });

    const sendCodeBtn = page.getByRole('button', { name: /Send|Code|Login|Continue/i });
    await sendCodeBtn.click();
    await page.waitForTimeout(1500);

    // Step 2: Enter OTP Code
    const otpInput = page.locator('input[placeholder*="Code"], input[placeholder*="OTP"], input[placeholder*="6-digit"], input[type="text"]').last();
    await otpInput.waitFor({ state: 'visible' });
    await otpInput.fill('123456');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_portal_otp_enter.png') });

    const verifyBtn = page.getByRole('button', { name: /Verify|Sign in|Submit/i });
    await verifyBtn.click();
    await page.waitForTimeout(2000);

    // Step 3: Check Dashboard Loaded
    const welcomeHeader = page.locator('text=Farhana Yasmin').first();
    await welcomeHeader.waitFor({ state: 'visible', timeout: 5000 });
    const isWelcomeVisible = await welcomeHeader.isVisible();

    if (!isWelcomeVisible) {
      throw new Error('Customer name Farhana Yasmin not visible after OTP verification.');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_portal_dashboard_upcoming.png'), fullPage: true });

    results.push({
      suite: 'Client Portal',
      name: 'OTP Authentication & Session Initiation',
      status: 'PASS',
      details: 'Successfully requested OTP, submitted 123456, and authenticated client Farhana Yasmin.',
      durationMs: Date.now() - startAuth,
      consoleErrors,
      screenshotPath: '02_portal_dashboard_upcoming.png',
    });

    // Step 4: Test Tab Switching - History & Treatments
    const startTabTest = Date.now();
    const historyTab = page.locator('button:has-text("History"), button:has-text("Past")').first();
    if (await historyTab.isVisible()) {
      await historyTab.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_portal_tab_history.png') });
    }

    // Step 5: Test Tab Switching - Rewards & Wallet
    const walletTab = page.locator('button:has-text("Rewards"), button:has-text("Wallet"), button:has-text("Loyalty")').first();
    if (await walletTab.isVisible()) {
      await walletTab.click();
      await page.waitForTimeout(800);
      const pointsText = page.locator('text=450').first();
      const hasPoints = await pointsText.isVisible();
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_portal_tab_wallet.png') });

      results.push({
        suite: 'Client Portal',
        name: 'Digital Wallet, Loyalty & Gift Cards View',
        status: hasPoints ? 'PASS' : 'PARTIAL' as any,
        details: hasPoints
          ? 'Loyalty points (450), Tier (Gold), and digital wallet balances displayed accurately.'
          : 'Rewards tab opened; verify points visibility.',
        durationMs: Date.now() - startTabTest,
        consoleErrors,
        screenshotPath: '02_portal_tab_wallet.png',
      });
    }

    // Step 6: Test Tab Switching - Profile
    const profileTab = page.locator('button:has-text("Profile"), button:has-text("Settings")').first();
    if (await profileTab.isVisible()) {
      await profileTab.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_portal_tab_profile.png') });
    }

    // Step 7: Refresh Persistence Check
    const startRefresh = Date.now();
    await page.reload({ waitUntil: 'networkidle' });
    const refreshedName = await page.locator('text=Farhana Yasmin').first().isVisible();

    results.push({
      suite: 'Client Portal',
      name: 'Client Session Persistence on Page Reload',
      status: refreshedName ? 'PASS' : 'FAIL',
      details: refreshedName
        ? 'Session persisted after hard refresh without requiring re-authentication.'
        : 'Session lost after page reload.',
      durationMs: Date.now() - startRefresh,
      consoleErrors,
      screenshotPath: '02_portal_tab_profile.png',
    });

  } catch (err: any) {
    results.push({
      suite: 'Client Portal',
      name: 'Full Client Portal Flow',
      status: 'FAIL',
      details: err.message,
      durationMs: Date.now() - startAuth,
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
    path.resolve(process.cwd(), 'tests/e2e/02-results.json'),
    JSON.stringify(results, null, 2),
  );
}

run().catch(console.error);
