'use client';

import type { Locale } from '@salon/shared';
import { LocaleSwitch } from '@salon/ui';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setLocale } from './actions';

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <LocaleSwitch
      locale={locale}
      onChange={(next) =>
        startTransition(async () => {
          await setLocale(next);
          router.refresh();
        })
      }
    />
  );
}
