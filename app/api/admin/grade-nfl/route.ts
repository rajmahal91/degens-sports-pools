import { NextResponse } from 'next/server';
import { syncAndGradeNFLWeek } from '@/lib/sports/nfl-operations';

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return !!secret && request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { season, week, seasonType = 'REG' } = await request.json();
  if (!season || !week) return NextResponse.json({ error: 'season and week are required' }, { status: 400 });

  try {
    return NextResponse.json(await syncAndGradeNFLWeek(Number(season),Number(week),seasonType));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Grading failed' }, { status: 500 });
  }
}
