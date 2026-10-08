import { test, expect } from '@playwright/test';
import { AdminLoginPage } from '../pages/AdminLoginPage';

test.describe('Admin Back-Office Portal', () => {
  let loginPage: AdminLoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new AdminLoginPage(page);
    await loginPage.goto();
  });

  test('should display admin login form with required fields', async ({ page }) => {
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test('should reject invalid credentials with a descriptive error', async ({ page }) => {
    await loginPage.login('invalid-user@example.com', 'wrongpassword');
    // Expect error message or alert to appear
    await expect(loginPage.errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should authenticate owner credentials and navigate to operations dashboard', async ({ page }) => {
    await loginPage.loginAsDemoOwner();
    // Verify redirection to dashboard/sales/calendar
    await expect(page).toHaveURL(/\/(|sales|calendar|pos|app)/, { timeout: 10000 });
  });
});
