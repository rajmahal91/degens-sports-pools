import { NextResponse } from "next/server";
import { syncPlayoffBrackets } from "@/lib/sports/playoff-operations";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncPlayoffBrackets();
    return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Playoff sync failed." },
      { status: 500 },
    );
  }
}
