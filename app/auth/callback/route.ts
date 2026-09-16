import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const providerError = url.searchParams.get('error');
  const providerErrorDescription = url.searchParams.get('error_description');
  const requestedNext = url.searchParams.get('next') || '/';
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/';

  if (providerError || providerErrorDescription) {
    return NextResponse.redirect(new URL(`/auth/login?confirmation=failed&next=${encodeURIComponent(next)}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL(`/auth/login?confirmation=verified&next=${encodeURIComponent(next)}`, request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Supabase verifies the email before redirecting here. A missing PKCE
    // verifier or reused one-time code should not tell the user that their
    // already-confirmed account failed.
    return NextResponse.redirect(new URL(`/auth/login?confirmation=verified&next=${encodeURIComponent(next)}`, request.url));
  }

  return NextResponse.redirect(new URL(next === '/' ? '/?confirmation=success' : next, request.url));
}
