import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url); const code = url.searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL('/auth/login?confirmation=invalid', request.url));
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL('/auth/login?confirmation=failed', request.url));
  return NextResponse.redirect(new URL('/beta', request.url));
}
