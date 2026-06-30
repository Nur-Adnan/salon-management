import type { Locale } from '@salon/shared';
import { ThemeSwitch } from '@salon/ui';
import { getLocale, getTranslations } from 'next-intl/server';
import { LocaleSwitcher } from './locale-switcher';
import { PingForm } from './ping-form';

export default async function HomePage() {
  const t = await getTranslations('home');
  const tp = await getTranslations('ping');
  const locale = (await getLocale()) as Locale;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand">{t('title')}</h1>
          <p className="opacity-70">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher locale={locale} />
          <ThemeSwitch />
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{tp('heading')}</h2>
        <PingForm />
      </section>
    </main>
  );
}
