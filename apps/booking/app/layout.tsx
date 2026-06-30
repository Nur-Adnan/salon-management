import { UiProvider } from '@salon/ui';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Book an appointment',
  description: 'Public online booking',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider>
          <UiProvider>{children}</UiProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
