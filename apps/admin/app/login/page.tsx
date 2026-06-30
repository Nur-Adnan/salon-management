import { getTranslations } from 'next-intl/server';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const t = await getTranslations('auth');
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold text-brand">{t('signIn')}</h1>
      <LoginForm />
    </main>
  );
}
