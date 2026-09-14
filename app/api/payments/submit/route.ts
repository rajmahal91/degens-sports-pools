import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Payments are not collected, processed, or tracked by this platform.' },
    { status: 410 },
  );
}
