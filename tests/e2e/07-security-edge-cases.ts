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
  console.log('=== E2E SUITE 7: SECURITY, AUTHORIZATION & EDGE CASES ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  try {
    // 1. Unauthenticated API access rejection
    console.log('\n--- 1. Testing Unauthenticated API Access ---');
    const startUnauth = Date.now();
    const unauthRes = await fetch('http://localhost:4000/catalog/products', {
      headers: { 'x-tenant-id': '660000000000000000000001' },
    });
    const isUnauthBlocked = unauthRes.status === 401;
    console.log('Unauthenticated access blocked (401):', isUnauthBlocked);

    results.push({
      suite: 'Security & Access Control',
      name: 'Unauthenticated Request Rejection',
      status: isUnauthBlocked ? 'PASS' : 'FAIL',
      details: `GET /catalog/products returned HTTP ${unauthRes.status} (expected 401 Unauthorized).`,
      durationMs: Date.now() - startUnauth,
      consoleErrors: [],
    });

    // 2. Cross-Tenant IDOR Protection
    console.log('\n--- 2. Testing Multi-Tenant IDOR Isolation ---');
    const startIdor = Date.now();
    // Use valid owner token but tamper with tenant-id header to non-existent or other tenant
    const devToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzdXBhLW93bmVyLWlkIiwiZW1haWwiOiJvd25lckBsdXhlLmNvbSIsImF1ZCI6ImF1dGhlbnRpY2F0ZWQiLCJpYXQiOjE3OTE0NjMwNDIsImV4cCI6MTc5MTU0OTQ0Mn0.HvRvrLLcJ51G73f8L62hj1XDhqV0tk6J-Whaqlju3NU';
    const idorRes = await fetch('http://localhost:4000/customers/660000000000000000000050/profile', {
      headers: {
        authorization: `Bearer ${devToken}`,
        'x-tenant-id': '660000000000000000000999', // Foreign tenant
        'x-branch-id': '660000000000000000000010',
      },
    });
    // Should be rejected because user is not a member of foreign tenant 999
    const isIdorBlocked = idorRes.status === 403 || idorRes.status === 401;
    console.log('Cross-tenant IDOR access blocked:', isIdorBlocked, idorRes.status);

    results.push({
      suite: 'Security & Access Control',
      name: 'Cross-Tenant IDOR Boundary',
      status: isIdorBlocked ? 'PASS' : 'FAIL',
      details: `Cross-tenant profile query rejected with HTTP ${idorRes.status} (expected 403/401).`,
      durationMs: Date.now() - startIdor,
      consoleErrors: [],
    });

    // 3. RBAC Privilege Escalation Guard
    console.log('\n--- 3. Testing RBAC Role Separation ---');
    const startRbac = Date.now();
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    const stylistBtn = page.getByRole('button', { name: /^Stylist$/i });
    await stylistBtn.click();
    await page.waitForURL('http://localhost:3000/', { timeout: 8000 });

    // Stylist attempts to navigate to /team
    await page.goto('http://localhost:3000/team', { waitUntil: 'networkidle' });
    const teamContent = await page.locator('body').textContent();
    const isPermissionBlocked = teamContent?.includes('You do not have permission') || teamContent?.includes('403');
    console.log('Stylist restricted from team management:', isPermissionBlocked);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_admin_rbac_stylist_restricted.png') });

    results.push({
      suite: 'Security & Access Control',
      name: 'Role-Based Access Control (RBAC) Enforcement',
      status: isPermissionBlocked ? 'PASS' : 'FAIL',
      details: 'Stylist role strictly prohibited from accessing team member invitations and management.',
      durationMs: Date.now() - startRbac,
      consoleErrors: [...consoleErrors],
      screenshotPath: '07_admin_rbac_stylist_restricted.png',
    });

    // 4. Rate Limiting on OTP endpoint
    console.log('\n--- 4. Testing API Rate Limiting ---');
    const startRate = Date.now();
    const burstPromises = Array.from({ length: 65 }).map(() =>
      fetch('http://localhost:4000/public/luxe-salon/portal/auth/request-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: '+8801711122233' }),
      }),
    );
    const burstResponses = await Promise.all(burstPromises);
    const has429 = burstResponses.some((r) => r.status === 429);
    console.log('Rate limiter triggered HTTP 429 Too Many Requests:', has429);

    results.push({
      suite: 'Security & Infrastructure',
      name: 'Rate Limiting & Anti-Brute-Force Protection',
      status: has429 ? 'PASS' : 'FAIL',
      details: has429
        ? 'Burst of 65 requests successfully triggered 429 Too Many Requests rate limiting.'
        : 'Rate limiting was not triggered on burst request.',
      durationMs: Date.now() - startRate,
      consoleErrors: [],
    });

    // 5. Input Validation & Boundary Testing (Negative test)
    console.log('\n--- 5. Testing Schema Validation & Boundary Checks ---');
    const startVal = Date.now();
    const malformedBooking = await fetch('http://localhost:4000/public/luxe-salon/660000000000000000000010/appointments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customer: { name: '', phone: 'not-a-phone' },
        lines: [],
      }),
    });
    const isValidationWorking = malformedBooking.status === 400;
    console.log('Malformed appointment payload rejected (400):', isValidationWorking);

    results.push({
      suite: 'Data Integrity & Validation',
      name: 'Input Validation & Malformed Payload Rejection',
      status: isValidationWorking ? 'PASS' : 'FAIL',
      details: `Submitting empty customer name and invalid phone rejected with HTTP ${malformedBooking.status}.`,
      durationMs: Date.now() - startVal,
      consoleErrors: [],
    });

  } catch (err: any) {
    results.push({
      suite: 'Security & Edge Cases',
      name: 'Security Test Flow',
      status: 'FAIL',
      details: err.message,
      durationMs: 0,
      consoleErrors: [...consoleErrors],
    });
  } finally {
    await context.close();
    await browser.close();
  }

  console.log('\n--- RESULTS SUMMARY ---');
  console.table(results.map((r) => ({
    name: r.name,
    status: r.status,
    duration: `${r.durationMs}ms`,
    errors: r.consoleErrors.length,
    screenshot: r.screenshotPath ?? 'none',
  })));

  fs.writeFileSync(
    path.resolve(process.cwd(), 'tests/e2e/07-results.json'),
    JSON.stringify(results, null, 2),
  );
}

run().catch(console.error);
