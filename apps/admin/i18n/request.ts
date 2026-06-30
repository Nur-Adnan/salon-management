import { DEFAULT_LOCALE, LOCALES, type Locale } from '@salon/shared';
import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

// Locale from a cookie (no i18n routing). The admin app is behind auth, so SEO
// per-locale URLs are not needed here; the booking site can add routing later.
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get('locale')?.value;
  const locale: Locale = (LOCALES as readonly string[]).includes(cookieLocale ?? '')
    ? (cookieLocale as Locale)
    : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
