import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";

const teams = {
  NHL: ["WPG", "STL", "DAL", "COL", "VGK", "MIN", "LA", "EDM", "TOR", "OTT", "TB", "FLA", "WSH", "MTL", "CAR", "NJ"],
  NBA: ["OKC", "MEM", "DEN", "LAC", "LAL", "MIN", "GSW", "HOU", "CLE", "MIA", "BOS", "ORL", "NYK", "DET", "IND", "MIL"],
} as const;

function bracketRows(poolId: string, sport: "NHL" | "NBA") {
  const ids = Array.from({ length: 15 }, () => randomUUID());
  const offsets = [0, 8, 12, 14];
  const rows: any[] = [];
  for (let round = 1; round <= 4; round++) {
    const count = 16 / 2 ** round;
    for (let number = 1; number <= count; number++) {
      const index = rows.length;
      rows.push({
        id: ids[index], pool_id: poolId, round_number: round, matchup_number: number,
        team1: round === 1 ? teams[sport][(number - 1) * 2] : null,
        team2: round === 1 ? teams[sport][(number - 1) * 2 + 1] : null,
        next_matchup_id: round < 4 ? ids[offsets[round] + Math.ceil(number / 2) - 1] : null,
        advance_to_slot: round < 4 ? (number % 2 ? 1 : 2) : null,
      });
    }
  }
  return rows;
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const poolId = new URL(request.url).searchParams.get("poolId");
    const { data: memberships } = await supabase.from("league_members").select("pool_id").eq("user_id", user.id).eq("status", "ACTIVE");
    const memberPoolIds = (memberships || []).map((row) => row.pool_id);
    const { data: pools } = memberPoolIds.length
      ? await supabase.from("pools").select("id,name,sport,season").in("id", memberPoolIds).eq("pool_type", "BRACKET").order("season", { ascending: false })
      : { data: [] };
    const selected = (pools || []).find((pool) => pool.id === poolId) || pools?.[0];
    if (!selected) return NextResponse.json({ pools: [], pool: null, matchups: [], picks: [] });
    const { data: entry } = await supabase.from("entries").select("id,entry_name").eq("pool_id", selected.id).eq("user_id", user.id).eq("entry_status", "ACTIVE").maybeSingle();
    if (!entry) return NextResponse.json({ pools, pool: selected, matchups: [], picks: [], error: "Join this bracket league before submitting a bracket." });
    let { data: matchups } = await supabase.from("bracket_matchups").select("*").eq("pool_id", selected.id).order("round_number").order("matchup_number");
    if (!matchups?.length) {
      const rows = bracketRows(selected.id, selected.sport as "NHL" | "NBA");
      const inserted = await supabase.from("bracket_matchups").insert(rows).select("*");
      if (inserted.error) throw inserted.error;
      matchups = inserted.data || rows;
    }
    const { data: picks } = await supabase.from("bracket_picks").select("matchup_id,predicted_winner,predicted_series_length,points_awarded").eq("entry_id", entry.id);
    return NextResponse.json({ pools, pool: selected, entry, matchups, picks: picks || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load bracket.";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 400 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await request.json();
    const poolId = String(body.poolId || "");
    if (!poolId || !body.picks || typeof body.picks !== "object") return NextResponse.json({ error: "Missing bracket data." }, { status: 400 });
    const { data: pool } = await supabase.from("pools").select("id,sport,pool_type").eq("id", poolId).eq("pool_type", "BRACKET").maybeSingle();
    if (!pool || !["NHL", "NBA"].includes(pool.sport)) return NextResponse.json({ error: "Choose an NHL or NBA bracket league." }, { status: 400 });
    const { data: entry } = await supabase.from("entries").select("id").eq("pool_id", poolId).eq("user_id", user.id).eq("entry_status", "ACTIVE").maybeSingle();
    if (!entry) return NextResponse.json({ error: "Join this bracket league before submitting." }, { status: 403 });
    const { data: matchups } = await supabase.from("bracket_matchups").select("id,team1,team2").eq("pool_id", poolId);
    const allowed = new Map((matchups || []).map((m) => [m.id, m]));
    const rows = Object.entries(body.picks).map(([matchupId, pick]: any) => {
      const matchup = allowed.get(matchupId);
      const winner = String(pick?.winner || "");
      const seriesLength = Number(pick?.seriesLength);
      if (!matchup || !winner || !Number.isInteger(seriesLength) || seriesLength < 4 || seriesLength > 7) throw new Error("Complete every series with a valid winner and series length.");
      return { entry_id: entry.id, matchup_id: matchupId, predicted_winner: winner, predicted_series_length: seriesLength, points_awarded: 0 };
    });
    if (rows.length !== allowed.size) return NextResponse.json({ error: `Complete all ${allowed.size} series before submitting.` }, { status: 400 });
    const { error } = await supabase.from("bracket_picks").upsert(rows, { onConflict: "entry_id,matchup_id" });
    if (error) throw error;
    return NextResponse.json({ ok: true, count: rows.length, poolId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save bracket.";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 400 });
  }
}
