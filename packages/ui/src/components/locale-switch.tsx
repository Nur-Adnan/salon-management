'use client';

import { Button } from '@heroui/react';
import { LOCALES, type Locale } from '@salon/shared';

// Presentational only: the host app passes its own (server-action-backed) setter.
export function LocaleSwitch({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (next: Locale) => void;
}) {
  return (
    <div className="flex gap-1">
      {LOCALES.map((l) => (
        <Button
          key={l}
          aria-pressed={l === locale}
          className={l === locale ? 'font-bold' : 'opacity-60'}
          onPress={() => onChange(l)}
        >
          {l.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
