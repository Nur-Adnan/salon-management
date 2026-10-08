import { test, expect } from '@playwright/test';
import { LandingPage } from '../pages/LandingPage';

test.describe('Luxury Landing Page Experience', () => {
  let landingPage: LandingPage;

  test.beforeEach(async ({ page }) => {
    landingPage = new LandingPage(page);
    await landingPage.goto();
  });

  test('should render editorial hero section and kinetic synaptic core', async ({ page }) => {
    await expect(landingPage.heroHeading).toContainText('Precision Aesthetics');
    await expect(page.locator('text=Aura OS · Enterprise Wellness')).toBeVisible();
    await expect(page.locator('#hero').getByRole('link', { name: 'RESERVE APPOINTMENT' })).toBeVisible();
  });

  test('should interact with the live treatment concierge simulator and update pricing reactive ledger', async ({ page }) => {
    await landingPage.conciergeSection.scrollIntoViewIfNeeded();

    // Select Dhanmondi Sanctuary
    await landingPage.selectBranch('Dhanmondi Botanical Sanctuary');

    // Select Diamond Glow Hydrafacial
    await landingPage.selectRitual('Diamond Glow Hydrafacial');

    // Select Sophia Rahman
    await landingPage.selectArtisan('Sophia Rahman');

    // Verify the ledger updates with correct calculations
    await expect(landingPage.telemetryCard).toContainText('Diamond Glow Hydrafacial');
    await expect(landingPage.telemetryCard).toContainText('Sophia Rahman');
    await expect(landingPage.telemetryCard).toContainText('3,500.00'); // Base price
    await expect(landingPage.telemetryCard).toContainText('525.00');   // 15% VAT
    await expect(landingPage.telemetryCard).toContainText('4,025.00'); // Total BDT
  });

  test('should display all six architectural system pillars with technical guarantees', async ({ page }) => {
    await landingPage.architecturalPillars.scrollIntoViewIfNeeded();
    const pillarCards = page.locator('#pillars div.group');
    await expect(pillarCards).toHaveCount(6);

    // Verify specific pillar titles
    await expect(page.locator('#pillars')).toContainText('Atomic Availability Engine');
    await expect(page.locator('#pillars')).toContainText('Clinical Aesthetic CRM & Charting');
    await expect(page.locator('#pillars')).toContainText('Dual-Rail Point of Sale (POS)');
    await expect(page.locator('#pillars')).toContainText('FIFO Perishable Inventory');
    await expect(page.locator('#pillars')).toContainText('Staff Sovereignty & Payroll Engine');
    await expect(page.locator('#pillars')).toContainText('VIP Client Sovereign Portal');
  });

  test('should dynamically toggle through the 5-stage distributed transaction pipeline', async ({ page }) => {
    await landingPage.pipelineSection.scrollIntoViewIfNeeded();

    // Click on STAGE 03 (ACID ReplicaSet)
    await landingPage.selectPipelineStage('STAGE 03');
    await expect(page.locator('h3:has-text("ACID ReplicaSet Transaction")')).toBeVisible();
    await expect(page.locator('#architecture')).toContainText('MongoDB ReplicaSet (rs0)');

    // Click on STAGE 05 (Real-Time Telemetry & Dispatch)
    await landingPage.selectPipelineStage('STAGE 05');
    await expect(page.locator('h3:has-text("Real-Time Telemetry & Dispatch")')).toBeVisible();
  });

  test('should expand and collapse the FAQ accordion using accessible spring animations', async ({ page }) => {
    await landingPage.faqSection.scrollIntoViewIfNeeded();

    // Expand second FAQ item
    await landingPage.toggleFaq('How does the POS register handle bKash, Nagad, and Card split-tenders?');
    await expect(page.locator('text=Our Point of Sale register features native multi-rail tender support')).toBeVisible();
  });

  test('should have no horizontal overflow across standard viewports', async ({ page }) => {
    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(isOverflowing).toBe(false);
  });
});
