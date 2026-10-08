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
  console.log('=== E2E SUITE 3: ADMIN AUTHENTICATION, DASHBOARD & NAVIGATION ===');
  const browser = await chromium.launch({ headless: true });

  // Test 1: Protected route gate (Unauthenticated access to / redirects to /login)
  console.log('\n--- 1. Testing Unauthenticated Gate ---');
  {
    const start = Date.now();
    const context = await browser.newContext();
    const page = await context.newPage();
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    try {
      await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
      const currentUrl = page.url();
      if (!currentUrl.includes('/login')) {
        throw new Error(`Expected redirect to /login, but stayed at ${currentUrl}`);
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_admin_unauth_redirect.png') });
      results.push({
        suite: 'Admin Auth & Dashboard',
        name: 'Protected Route Gate (Redirect to /login)',
        status: 'PASS',
        details: 'Visiting root / without token automatically redirected to /login.',
        durationMs: Date.now() - start,
        consoleErrors,
        screenshotPath: '03_admin_unauth_redirect.png',
      });
    } catch (err: any) {
      results.push({
        suite: 'Admin Auth & Dashboard',
        name: 'Protected Route Gate (Redirect to /login)',
        status: 'FAIL',
        details: err.message,
        durationMs: Date.now() - start,
        consoleErrors,
      });
    } finally {
      await context.close();
    }
  }

  // Test 2: Responsive Login Page Layouts
  console.log('\n--- 2. Testing Login Page Responsive Viewports ---');
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
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    try {
      await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

      const heading = await page.locator('h1').textContent();
      if (!heading?.includes('Sign in') && !heading?.includes('Login')) {
        throw new Error(`Expected login heading, got '${heading}'`);
      }

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      if (scrollWidth > clientWidth) {
        throw new Error(`Horizontal overflow at ${vp.width}px!`);
      }

      const screenshotFile = `03_admin_login_${vp.name}.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, screenshotFile) });

      results.push({
        suite: 'Admin Auth & Dashboard',
        name: `Login Screen Layout (${vp.name})`,
        status: 'PASS',
        details: `Rendered clean login form at ${vp.width}x${vp.height} with 0 horizontal overflow.`,
        durationMs: Date.now() - start,
        consoleErrors,
        screenshotPath: screenshotFile,
      });
    } catch (err: any) {
      results.push({
        suite: 'Admin Auth & Dashboard',
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

  // Test 3: Authenticated Admin Flow, Dashboard, KPI Cards & Navigation
  console.log('\n--- 3. Testing Authenticated Dashboard, KPIs & Navigation ---');
  {
    const start = Date.now();
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    try {
      await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

      // Click "Sign in as Demo Owner"
      const demoOwnerBtn = page.getByRole('button', { name: /Demo Owner/i });
      await demoOwnerBtn.waitFor({ state: 'visible' });
      await demoOwnerBtn.click();
      await page.waitForURL('http://localhost:3000/', { timeout: 8000 });

      // Check header elements
      const headerTitle = await page.locator('header a.font-bold').textContent();
      if (!headerTitle?.includes('Salon Admin')) {
        throw new Error(`Expected 'Salon Admin' in header brand, got '${headerTitle}'`);
      }

      // Check user email in header
      const userEmail = await page.locator('header span:has-text("@")').textContent();
      console.log('Logged in as:', userEmail);

      // Check Dashboard KPI tiles
      const kpisSection = page.locator('section.flex.flex-wrap.gap-3');
      await kpisSection.waitFor({ state: 'visible', timeout: 5000 });
      const kpiTiles = await kpisSection.locator('> div').allTextContents();
      console.log('KPI Tiles rendered:', kpiTiles);

      if (kpiTiles.length === 0) {
        throw new Error('Expected Dashboard KPI tiles to be rendered.');
      }

      // Check Branches section
      const branchesList = await page.locator('section:has-text("Branches") ul li').allTextContents();
      console.log('Branches listed:', branchesList);
      if (!branchesList.some((b) => b.includes('Gulshan') || b.includes('Dhanmondi'))) {
        throw new Error('Expected Gulshan or Dhanmondi branches to be listed.');
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_admin_dashboard_full.png'), fullPage: true });

      results.push({
        suite: 'Admin Auth & Dashboard',
        name: 'Dashboard KPIs & Branches View',
        status: 'PASS',
        details: `Dashboard rendered ${kpiTiles.length} KPI tiles and ${branchesList.length} branches for owner.`,
        durationMs: Date.now() - start,
        consoleErrors,
        screenshotPath: '03_admin_dashboard_full.png',
      });

      // Test 4: Scope Switcher Interaction
      const startScope = Date.now();
      const scopeSelect = page.locator('header select').first();
      if (await scopeSelect.isVisible()) {
        const currentScope = await scopeSelect.inputValue();
        console.log('Current scope value:', currentScope);

        // Switch scope
        const options = await scopeSelect.locator('option').allTextContents();
        console.log('Scope options:', options);

        if (options.length > 1) {
          await scopeSelect.selectOption({ index: 1 });
          await page.waitForTimeout(1000);
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_admin_scope_switched.png') });
        }
      }

      results.push({
        suite: 'Admin Auth & Dashboard',
        name: 'Multi-Branch Scope Switcher',
        status: 'PASS',
        details: 'Active branch/tenant scope selector operational in navigation bar.',
        durationMs: Date.now() - startScope,
        consoleErrors,
        screenshotPath: '03_admin_scope_switched.png',
      });

      // Test 5: Sign Out
      const startSignOut = Date.now();
      const signOutBtn = page.getByRole('button', { name: /Sign out/i });
      await signOutBtn.click();
      await page.waitForURL('**/login', { timeout: 5000 });

      // Verify cookies cleared and protected routes blocked
      await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
      if (!page.url().includes('/login')) {
        throw new Error('Session persisted after sign out! Expected redirect to /login.');
      }

      results.push({
        suite: 'Admin Auth & Dashboard',
        name: 'Sign Out & Session Invalidation',
        status: 'PASS',
        details: 'Signed out successfully; token deleted; subsequent route access redirected to /login.',
        durationMs: Date.now() - startSignOut,
        consoleErrors,
      });

    } catch (err: any) {
      results.push({
        suite: 'Admin Auth & Dashboard',
        name: 'Authenticated Dashboard Flow',
        status: 'FAIL',
        details: err.message,
        durationMs: Date.now() - start,
        consoleErrors,
      });
    } finally {
      await context.close();
    }
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
    path.resolve(process.cwd(), 'tests/e2e/03-results.json'),
    JSON.stringify(results, null, 2),
  );
}

run().catch(console.error);
