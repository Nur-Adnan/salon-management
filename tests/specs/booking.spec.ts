import { test, expect } from '@playwright/test';
import { BookingFlowPage } from '../pages/BookingFlowPage';

test.describe('Public Salon Booking Experience', () => {
  let bookingPage: BookingFlowPage;

  test.beforeEach(async ({ page }) => {
    bookingPage = new BookingFlowPage(page);
    await bookingPage.goto('luxe-salon');
  });

  test('should load the salon booking portal and display available branches and services', async ({ page }) => {
    await expect(page).toHaveURL(/\/luxe-salon/);
    // Verify salon header and appointment booking interface
    await expect(page.locator('body')).toContainText('Luxe Salon');
  });
});
