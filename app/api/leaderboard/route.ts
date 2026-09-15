import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

type StandingRow = {
  entryId: string;
  name: string;
  rank: number;
  status: string;
  score: number;
  detail: string;
  alive?: boolean;
};

type LeaderboardEntry = {
  entry_id: string;
  entry_name: string;
  entry_status: string;
  score: number | string | null;
  secondary_value: number | null;
};

type PickemWeeklyEntry = {
  entry_id: string;
  entry_name: string;
  weekly_score: number;
  weekly_graded: number;
  total_score: number;
  total_graded: number;
};

function rankRows(rows: Omit<StandingRow, "rank">[]) {
  let priorKey = "";
  let priorRank = 0;
  return rows.map((row, index) => {
    const key = `${row.alive ?? ""}:${row.score}`;
    if (key !== priorKey) priorRank = index + 1;
    priorKey = key;
    return { ...row, rank: priorRank };
  });
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireUser();
    const params = new URL(request.url).searchParams;
    const poolId = params.get("poolId");
    const requestedWeek = params.get("week");
    const week = requestedWeek === null ? null : Number(requestedWeek);
    if (!poolId) return NextResponse.json({ error: "Choose a pool." }, { status: 400 });
    if (week !== null && (!Number.isInteger(week) || week < 1 || week > 18)) {
      return NextResponse.json({ error: "Week must be between 1 and 18." }, { status: 400 });
    }

    // This user-scoped lookup is the access check. Pool RLS only returns leagues
    // the signed-in user belongs to or manages.
    const { data: pool, error: poolError } = await supabase
      .from("pools")
      .select("id,name,pool_type")
      .eq("id", poolId)
      .single();
    if (poolError || !pool) return NextResponse.json({ error: "Pool not found or access denied." }, { status: 403 });

    if (pool.pool_type === "PICKEM" && week !== null) {
      const { data: weeklyData, error: weeklyError } = await supabase.rpc(
        "get_pickem_weekly_rows",
        { p_pool_id: pool.id, p_week: week },
      );
      if (weeklyError) {
        console.error("weekly Pick'em leaderboard query failed", weeklyError);
        throw new Error(weeklyError.message);
      }
      const prepared = ((weeklyData || []) as PickemWeeklyEntry[])
        .map((entry) => ({
          entryId: entry.entry_id,
          name: entry.entry_name,
          status: "Points",
          score: Number(entry.weekly_score || 0),
          detail: `${Number(entry.weekly_score || 0)} Week ${week} point${Number(entry.weekly_score || 0) === 1 ? "" : "s"} · ${Number(entry.total_score || 0)} season point${Number(entry.total_score || 0) === 1 ? "" : "s"}`,
        }))
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
      return NextResponse.json({
        pool: { id: pool.id, name: pool.name, type: pool.pool_type },
        week,
        rows: rankRows(prepared),
      });
    }

    const { data, error: standingsError } = await supabase.rpc("get_leaderboard_rows", { p_pool_id: pool.id });
    if (standingsError) {
      console.error("leaderboard query failed", standingsError);
      throw new Error(standingsError.message);
    }

    const entries = (data || []) as LeaderboardEntry[];
    if (!entries.length) {
      return NextResponse.json({ pool: { id: pool.id, name: pool.name, type: pool.pool_type }, rows: [] });
    }

    let rows: StandingRow[] = [];
    if (pool.pool_type === "SURVIVOR") {
      const prepared = entries.map((entry) => {
        const wins = Number(entry.score || 0);
        const lossWeek = entry.secondary_value;
        const alive = entry.entry_status === "ACTIVE";
        return {
          entryId: entry.entry_id,
          name: entry.entry_name,
          status: alive ? "Alive" : "Eliminated",
          score: wins,
          detail: alive ? `${wins} win${wins === 1 ? "" : "s"}` : lossWeek ? `Out in Week ${lossWeek}` : "Eliminated",
          alive,
        };
      }).sort((a, b) => Number(b.alive) - Number(a.alive) || b.score - a.score || a.name.localeCompare(b.name));
      rows = rankRows(prepared);
    } else if (pool.pool_type === "PICKEM") {
      const prepared = entries.map((entry) => {
        const correct = Number(entry.score || 0);
        const graded = Number(entry.secondary_value || 0);
        return {
          entryId: entry.entry_id,
          name: entry.entry_name,
          status: "Points",
          score: correct,
          detail: `${correct} point${correct === 1 ? "" : "s"} · ${graded} graded pick${graded === 1 ? "" : "s"}`,
        };
      }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
      rows = rankRows(prepared);
    } else if (pool.pool_type === "PLAYOFF_FANTASY") {
      const prepared = entries.map((entry) => {
        const points = Number(entry.score || 0);
        return {
          entryId: entry.entry_id,
          name: entry.entry_name,
          status: "Active",
          score: points,
          detail: `${points.toFixed(1)} points`,
        };
      }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
      rows = rankRows(prepared);
    }

    return NextResponse.json({ pool: { id: pool.id, name: pool.name, type: pool.pool_type }, rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load standings.";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}
