import { ThemeSwitch } from '@salon/ui';
import { getTranslations } from 'next-intl/server';

export default async function HomePage() {
  const t = await getTranslations('home');
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand">{t('title')}</h1>
          <p className="opacity-70">{t('subtitle')}</p>
        </div>
        <ThemeSwitch />
      </header>
    </main>
  );
}
