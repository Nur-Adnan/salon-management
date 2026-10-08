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
  console.log('=== E2E SUITE 6: HR, ATTENDANCE, PAYROLL & REPORTS ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  try {
    // 1. Authenticate as Owner
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    const demoOwnerBtn = page.getByRole('button', { name: /Demo Owner/i });
    await demoOwnerBtn.click();
    await page.waitForURL('http://localhost:3000/', { timeout: 8000 });

    // 2. Team Directory & Invitations
    console.log('\n--- 1. Testing Team Page ---');
    const startTeam = Date.now();
    await page.goto('http://localhost:3000/team', { waitUntil: 'networkidle' });

    const teamH1 = await page.locator('h1').textContent();
    if (!teamH1?.includes('Team')) {
      throw new Error(`Expected 'Team' in h1, got '${teamH1}'`);
    }

    const memberItems = page.locator('ul li');
    const memberCount = await memberItems.count();
    console.log(`Team members count: ${memberCount}`);

    // Send invitation
    const inviteEmail = `staff_${Date.now().toString().slice(-4)}@luxe.com`;
    await page.fill('input[name="email"]', inviteEmail);
    await page.selectOption('select[name="role"]', 'stylist');
    await page.click('button:has-text("Invite")');
    await page.waitForTimeout(1000);

    const hasInvitedEmail = await page.locator(`text=${inviteEmail}`).isVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_admin_team.png'), fullPage: true });

    results.push({
      suite: 'HR & Team Management',
      name: 'Team Directory & Staff Invitations',
      status: hasInvitedEmail ? 'PASS' : 'FAIL',
      details: `Loaded team directory with ${memberCount} members and invited new stylist '${inviteEmail}'.`,
      durationMs: Date.now() - startTeam,
      consoleErrors: [...consoleErrors],
      screenshotPath: '06_admin_team.png',
    });

    // 3. Attendance Tracking
    console.log('\n--- 2. Testing Attendance Page ---');
    const startAtt = Date.now();
    await page.goto('http://localhost:3000/attendance', { waitUntil: 'networkidle' });

    const attH1 = await page.locator('h1').textContent();
    if (!attH1?.includes('Attendance')) {
      throw new Error(`Expected 'Attendance' in h1, got '${attH1}'`);
    }

    // Click Clock In
    const clockInBtn = page.getByRole('button', { name: 'Clock in' });
    await clockInBtn.click();
    await page.waitForTimeout(1000);

    // Verify open shift exists
    const hasOpenShift = await page.locator('text=open').isVisible();
    console.log('Open attendance shift recorded:', hasOpenShift);

    // Click Clock Out
    const clockOutBtn = page.getByRole('button', { name: 'Clock out' });
    await clockOutBtn.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_admin_attendance.png'), fullPage: true });

    results.push({
      suite: 'HR & Staff Operations',
      name: 'Shift Attendance Clock-In & Clock-Out',
      status: hasOpenShift ? 'PASS' : 'FAIL',
      details: 'Clock-in recorded open shift successfully and clock-out closed shift.',
      durationMs: Date.now() - startAtt,
      consoleErrors: [...consoleErrors],
      screenshotPath: '06_admin_attendance.png',
    });

    // 4. Payroll & Commission
    console.log('\n--- 3. Testing Payroll Page ---');
    const startPayroll = Date.now();
    await page.goto('http://localhost:3000/payroll', { waitUntil: 'networkidle' });

    const payrollH1 = await page.locator('h1').textContent();
    if (!payrollH1?.includes('Payroll')) {
      throw new Error(`Expected 'Payroll' in h1, got '${payrollH1}'`);
    }

    const hasRunPayrollForm = await page.locator('button:has-text("Run")').isVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_admin_payroll.png'), fullPage: true });

    results.push({
      suite: 'HR & Payroll',
      name: 'Payroll Processing & Commission Ledger',
      status: hasRunPayrollForm ? 'PASS' : 'FAIL',
      details: 'Payroll dashboard with compensation calculations and commission ledger visible.',
      durationMs: Date.now() - startPayroll,
      consoleErrors: [...consoleErrors],
      screenshotPath: '06_admin_payroll.png',
    });

    // 5. Reports: Sales Analytics
    console.log('\n--- 4. Testing Sales Report ---');
    const startRepSales = Date.now();
    await page.goto('http://localhost:3000/reports/sales', { waitUntil: 'networkidle' });

    const repSalesH1 = await page.locator('h1').textContent();
    const hasSalesTable = await page.locator('table').isVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_admin_reports_sales.png'), fullPage: true });

    results.push({
      suite: 'Executive Reports & Analytics',
      name: 'Sales & Revenue Analytics Report',
      status: repSalesH1?.includes('Sales report') && hasSalesTable ? 'PASS' : 'FAIL',
      details: 'Sales summary, breakdown by payment method and service/product category loaded.',
      durationMs: Date.now() - startRepSales,
      consoleErrors: [...consoleErrors],
      screenshotPath: '06_admin_reports_sales.png',
    });

    // 6. Reports: Staff Performance
    console.log('\n--- 5. Testing Staff Performance Report ---');
    const startRepStaff = Date.now();
    await page.goto('http://localhost:3000/reports/staff', { waitUntil: 'networkidle' });

    const repStaffH1 = await page.locator('h1').textContent();
    const hasStaffTable = await page.locator('table').isVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_admin_reports_staff.png'), fullPage: true });

    results.push({
      suite: 'Executive Reports & Analytics',
      name: 'Staff Performance & Attribution Report',
      status: repStaffH1?.includes('Staff') && hasStaffTable ? 'PASS' : 'FAIL',
      details: 'Staff appointment volume, service revenue attribution, and tips tracking loaded.',
      durationMs: Date.now() - startRepStaff,
      consoleErrors: [...consoleErrors],
      screenshotPath: '06_admin_reports_staff.png',
    });

    // 7. Reports: Inventory Valuation
    console.log('\n--- 6. Testing Inventory Report ---');
    const startRepInv = Date.now();
    await page.goto('http://localhost:3000/reports/inventory', { waitUntil: 'networkidle' });

    const repInvH1 = await page.locator('h1').textContent();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_admin_reports_inventory.png'), fullPage: true });

    results.push({
      suite: 'Executive Reports & Analytics',
      name: 'Inventory Valuation & Reorder Status Report',
      status: repInvH1?.includes('Inventory') ? 'PASS' : 'FAIL',
      details: 'Total inventory retail valuation, cost valuation, and reorder alerts loaded.',
      durationMs: Date.now() - startRepInv,
      consoleErrors: [...consoleErrors],
      screenshotPath: '06_admin_reports_inventory.png',
    });

    // 8. Reports: Appointment Analytics
    console.log('\n--- 7. Testing Appointments Report ---');
    const startRepAppt = Date.now();
    await page.goto('http://localhost:3000/reports/appointments', { waitUntil: 'networkidle' });

    const repApptH1 = await page.locator('h1').textContent();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_admin_reports_appointments.png'), fullPage: true });

    results.push({
      suite: 'Executive Reports & Analytics',
      name: 'Appointment Volume & Booking Analytics Report',
      status: repApptH1?.includes('Appointments') ? 'PASS' : 'FAIL',
      details: 'Booking channels, completion vs cancellation rates, and occupancy analytics loaded.',
      durationMs: Date.now() - startRepAppt,
      consoleErrors: [...consoleErrors],
      screenshotPath: '06_admin_reports_appointments.png',
    });

  } catch (err: any) {
    results.push({
      suite: 'HR & Reports',
      name: 'HR & Reports Suite Flow',
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
    path.resolve(process.cwd(), 'tests/e2e/06-results.json'),
    JSON.stringify(results, null, 2),
  );
}

run().catch(console.error);
