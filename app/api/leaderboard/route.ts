import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type StandingRow = {
  entryId: string;
  name: string;
  rank: number;
  status: string;
  score: number;
  detail: string;
  alive?: boolean;
};

function rankRows(rows: Omit<StandingRow, "rank">[]) {
  let priorKey = "";
  let priorRank = 0;
  return rows.map((row, index) => {
    const key = `${row.alive ?? ""}:${row.score}:${row.detail}`;
    if (key !== priorKey) priorRank = index + 1;
    priorKey = key;
    return { ...row, rank: priorRank };
  });
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireUser();
    const poolId = new URL(request.url).searchParams.get("poolId");
    if (!poolId) return NextResponse.json({ error: "Choose a pool." }, { status: 400 });

    // This user-scoped lookup is the access check. Pool RLS only returns leagues
    // the signed-in user belongs to or manages.
    const { data: pool, error: poolError } = await supabase
      .from("pools")
      .select("id,name,pool_type")
      .eq("id", poolId)
      .single();
    if (poolError || !pool) return NextResponse.json({ error: "Pool not found or access denied." }, { status: 403 });

    const admin = createAdminClient();
    const { data: entries, error: entriesError } = await admin
      .from("entries")
      .select("id,entry_name,entry_status,payment_status")
      .eq("pool_id", pool.id)
      .eq("payment_status", "PAID")
      .order("created_at");
    if (entriesError) throw entriesError;

    const entryIds = (entries || []).map((entry) => entry.id);
    if (!entryIds.length) {
      return NextResponse.json({ pool: { id: pool.id, name: pool.name, type: pool.pool_type }, rows: [] });
    }

    let rows: StandingRow[] = [];
    if (pool.pool_type === "SURVIVOR") {
      const { data: picks, error } = await admin
        .from("survivor_picks")
        .select("entry_id,week,result")
        .in("entry_id", entryIds);
      if (error) throw error;
      const prepared = (entries || []).map((entry) => {
        const mine = (picks || []).filter((pick) => pick.entry_id === entry.id);
        const wins = mine.filter((pick) => pick.result === "WIN").length;
        const lossWeek = mine.find((pick) => pick.result === "LOSS")?.week;
        const alive = entry.entry_status === "ACTIVE";
        return {
          entryId: entry.id,
          name: entry.entry_name,
          status: alive ? "Alive" : "Eliminated",
          score: wins,
          detail: alive ? `${wins} win${wins === 1 ? "" : "s"}` : lossWeek ? `Out in Week ${lossWeek}` : "Eliminated",
          alive,
        };
      }).sort((a, b) => Number(b.alive) - Number(a.alive) || b.score - a.score || a.name.localeCompare(b.name));
      rows = rankRows(prepared);
    } else if (pool.pool_type === "PICKEM") {
      const { data: picks, error } = await admin
        .from("pickem_picks")
        .select("entry_id,is_correct")
        .in("entry_id", entryIds);
      if (error) throw error;
      const prepared = (entries || []).map((entry) => {
        const graded = (picks || []).filter((pick) => pick.entry_id === entry.id && pick.is_correct !== null);
        const correct = graded.filter((pick) => pick.is_correct === true).length;
        return {
          entryId: entry.id,
          name: entry.entry_name,
          status: "Active",
          score: correct,
          detail: `${correct} correct · ${graded.length} graded`,
        };
      }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
      rows = rankRows(prepared);
    } else if (pool.pool_type === "PLAYOFF_FANTASY") {
      const { data: picks, error } = await admin
        .from("playoff_fantasy_picks")
        .select("entry_id,fantasy_points")
        .in("entry_id", entryIds);
      if (error) throw error;
      const prepared = (entries || []).map((entry) => {
        const points = (picks || [])
          .filter((pick) => pick.entry_id === entry.id)
          .reduce((sum, pick) => sum + Number(pick.fantasy_points || 0), 0);
        return {
          entryId: entry.id,
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
