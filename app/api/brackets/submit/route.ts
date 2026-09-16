import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

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
    const { data: picks } = await supabase.from("bracket_picks").select("matchup_id,predicted_winner,predicted_series_length,points_awarded").eq("entry_id", entry.id);
    return NextResponse.json({ pools, pool: selected, entry, matchups: matchups || [], picks: picks || [], matchupsConfirmed: Boolean(matchups?.length) });
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
