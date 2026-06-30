'use client';

import { Button } from '@salon/ui';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const inputCls =
  'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';

export function LoginForm() {
  const t = useTranslations('auth');
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function signIn(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setMsg(error.message);
    window.location.href = '/';
  }
  async function signUp() {
    const { error } = await supabase.auth.signUp({ email, password });
    setMsg(error ? error.message : t('checkEmail'));
  }
  async function magicLink() {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setMsg(error ? error.message : t('magicSent'));
  }
  async function google() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <form onSubmit={signIn} className="flex flex-col gap-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('email')}
        aria-label={t('email')}
        className={inputCls}
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t('password')}
        aria-label={t('password')}
        className={inputCls}
      />
      <Button type="submit">{t('signIn')}</Button>
      <div className="flex gap-2">
        <Button type="button" onPress={signUp}>
          {t('signUp')}
        </Button>
        <Button type="button" onPress={magicLink}>
          {t('magicLink')}
        </Button>
      </div>
      <Button type="button" onPress={google}>
        {t('google')}
      </Button>
      {msg ? <p className="text-sm text-danger">{msg}</p> : null}
    </form>
  );
}
