'use server';

import { createHmac } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const DEV_JWT_SECRET = 'dev-only-insecure-jwt-secret-change-me';

export async function loginAsDemo(role: 'owner' | 'manager' | 'stylist' = 'owner') {
  const emailMap = {
    owner: { sub: 'supa-owner-id', email: 'owner@luxe.com' },
    manager: { sub: 'supa-owner-id', email: 'owner@luxe.com' },
    stylist: { sub: 'supa-stylist-1', email: 'sarah@luxe.com' },
  };
  const user = emailMap[role] ?? emailMap.owner;

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.sub,
      email: user.email,
      aud: 'authenticated',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 86400,
    }),
  ).toString('base64url');
  const signature = createHmac('sha256', DEV_JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  const token = `${header}.${payload}.${signature}`;

  const c = await cookies();
  c.set('salon_token', token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  c.set('active_tenant', '660000000000000000000001', { path: '/' });
  c.set('active_branch', '660000000000000000000010', { path: '/' });
  redirect('/');
}
