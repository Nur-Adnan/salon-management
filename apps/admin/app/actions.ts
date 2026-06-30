'use server';

import { LOCALES, type Locale } from '@salon/shared';
import { cookies } from 'next/headers';

export async function setLocale(locale: Locale): Promise<void> {
  if (!(LOCALES as readonly string[]).includes(locale)) return;
  const store = await cookies();
  store.set('locale', locale, { path: '/', maxAge: 60 * 60 * 24 * 365 });
}
