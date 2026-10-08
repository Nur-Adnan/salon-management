import { type Page, type Locator, expect } from '@playwright/test';

export class BookingFlowPage {
  readonly page: Page;
  readonly salonNameHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.salonNameHeading = page.locator('h1');
  }

  async goto(slug = 'luxe-salon') {
    await this.page.goto(`/${slug}`);
    await expect(this.salonNameHeading).toBeVisible();
  }
}
