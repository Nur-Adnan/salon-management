'use client';

import { type PingResponse, pingRequestSchema, pingResponseSchema } from '@salon/shared';
import { Button } from '@salon/ui';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function PingForm() {
  const t = useTranslations('ping');
  const [name, setName] = useState('');
  const [result, setResult] = useState<PingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setResult(null);

    // Same shared schema the API validates against.
    const parsed = pingRequestSchema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'invalid input');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/ping`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-tenant-id': 'demo' },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        setError(`API responded ${res.status}`);
        return;
      }
      setResult(pingResponseSchema.parse(await res.json()));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-sm flex-col gap-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('namePlaceholder')}
        aria-label={t('namePlaceholder')}
        className="rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand"
      />
      <Button type="submit" isDisabled={loading}>
        {t('submit')}
      </Button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {result ? (
        <p className="text-sm text-brand">
          {result.greeting} (cid: {result.correlationId.slice(0, 8)})
        </p>
      ) : null}
    </form>
  );
}
