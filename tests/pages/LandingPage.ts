import { type Page, type Locator, expect } from '@playwright/test';

export class LandingPage {
  readonly page: Page;
  readonly heroHeading: Locator;
  readonly synapticCore: Locator;
  readonly conciergeSection: Locator;
  readonly telemetryCard: Locator;
  readonly architecturalPillars: Locator;
  readonly pipelineSection: Locator;
  readonly faqSection: Locator;
  readonly ctaReserveBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heroHeading = page.locator('h1');
    this.synapticCore = page.locator('#hero svg');
    this.conciergeSection = page.locator('#concierge');
    this.telemetryCard = page.locator('.glass-panel-sharp:has-text("CONFIRMATION_TELEMETRY")');
    this.architecturalPillars = page.locator('#pillars');
    this.pipelineSection = page.locator('#architecture');
    this.faqSection = page.locator('#faq');
    this.ctaReserveBtn = page.getByRole('link', { name: 'Reserve Bespoke Ritual' }).first();
  }

  async goto() {
    await this.page.goto('/');
    await expect(this.heroHeading).toBeVisible();
  }

  async selectBranch(branchName: string) {
    const branchBtn = this.page.locator(`button:has-text("${branchName}")`).first();
    await branchBtn.click();
  }

  async selectRitual(ritualName: string) {
    const ritualBtn = this.page.locator(`button:has-text("${ritualName}")`).first();
    await ritualBtn.click();
  }

  async selectArtisan(artisanName: string) {
    const artisanBtn = this.page.locator(`button:has-text("${artisanName}")`).first();
    await artisanBtn.click();
  }

  async selectPipelineStage(stageText: string) {
    const stageBtn = this.page.locator(`button:has-text("${stageText}")`).first();
    await stageBtn.click();
  }

  async toggleFaq(questionText: string) {
    const faqBtn = this.page.locator(`button:has-text("${questionText}")`).first();
    await faqBtn.click();
  }
}
