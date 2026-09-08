import { NextResponse } from 'next/server';
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return NextResponse.json({ ok: true, app: 'Degens Sports Pools', version: '0.7.0', time: new Date().toISOString(), supabaseConfigured: Boolean(url && secret) });
}
