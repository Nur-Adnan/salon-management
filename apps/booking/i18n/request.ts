import { DEFAULT_LOCALE, LOCALES, type Locale } from '@salon/shared';
import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

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
