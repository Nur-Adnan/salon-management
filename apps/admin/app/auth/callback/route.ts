import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// OAuth / magic-link redirect target: exchange the code for a session cookie.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}/`);
}
