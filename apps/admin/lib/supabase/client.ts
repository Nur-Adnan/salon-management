import { createBrowserClient } from '@supabase/ssr';

// Browser Supabase client (login/signup happen client-side, tokens land in cookies).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  );
}
