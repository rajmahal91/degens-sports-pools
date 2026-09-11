import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

async function manageablePoolIds(supabase: SupabaseClient, userId: string) {
  const { data: ownedOrgs } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_user_id", userId);
  const { data: staffOrgs } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .in("role", ["OWNER", "ADMIN", "COMMISSIONER"]);
  const orgIds = [
    ...new Set([
      ...(ownedOrgs || []).map((o) => o.id),
      ...(staffOrgs || []).map((o) => o.organization_id),
    ]),
  ];
  const { data: owned } = orgIds.length
    ? await supabase.from("pools").select("id").in("organization_id", orgIds)
    : { data: [] as { id: string }[] };
  const { data: league } = await supabase
    .from("league_members")
    .select("pool_id")
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .in("role", ["COMMISSIONER", "CO_COMMISSIONER"]);
  return new Set([
    ...(owned || []).map((p: any) => p.id),
    ...(league || []).map((m: any) => m.pool_id),
  ]);
}
export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data: visiblePools } = await supabase
      .from("pools")
      .select("id,name,sport,pool_type")
      .order("created_at");
    const poolIds = (visiblePools || []).map((p) => p.id);
    if (!poolIds.length)
      return NextResponse.json({ prizes: [], pools: [], canManagePoolIds: [] });
    const canManage = await manageablePoolIds(supabase, user.id);
    const { data: prizes, error } = await supabase
      .from("prizes")
      .select(
        "*,prize_draws(id,winner_entry_id,original_winner_entry_id,winner_snapshot_id,original_winner_snapshot_id,winner_name,original_winner_name,drawn_at,verification_hash,eligible_snapshot,override_reason,overridden_at)",
      )
      .in("pool_id", poolIds)
      .order("draw_at");
    if (error) throw error;
    const result = [];
    for (const prize of prizes || []) {
      let q = supabase
        .from("entries")
        .select("id,entry_name,user_id,entry_status,payment_status")
        .eq("pool_id", prize.pool_id)
        .eq("payment_status", prize.eligibility?.payment_status || "PAID");
      if (prize.eligibility?.entry_status)
        q = q.eq("entry_status", prize.eligibility.entry_status);
      const { data: raw } = await q;
      let eligible = raw || [];
      if (prize.eligibility?.one_prize_per_entry) {
        const { data: wins } = await supabase
          .from("prize_draws")
          .select("winner_entry_id,prizes!inner(pool_id)")
          .eq("prizes.pool_id", prize.pool_id);
        const won = new Set((wins || []).map((x: any) => x.winner_entry_id));
        eligible = eligible.filter((e) => !won.has(e.id));
      }
      const manual = Array.isArray(prize.eligibility?.manual_entries)
        ? prize.eligibility.manual_entries
        : [];
      const displayed =
        prize.eligibility?.draw_list_mode === "MANUAL"
          ? manual
          : eligible.map((e) => ({ id: e.id, name: e.entry_name }));
      result.push({
        ...prize,
        title: prize.name,
        scheduled_draw_at: prize.draw_at,
        week: Number(prize.eligibility?.week) || null,
        eligible_count: displayed.length,
        my_eligible_entries:
          prize.eligibility?.draw_list_mode === "MANUAL"
            ? []
            : eligible
                .filter((e) => e.user_id === user.id)
                .map((e) => e.entry_name),
        can_manage: canManage.has(prize.pool_id),
        eligible_entries: canManage.has(prize.pool_id) ? displayed : undefined,
      });
    }
    return NextResponse.json({
      prizes: result,
      pools: visiblePools || [],
      canManagePoolIds: [...canManage],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load prizes.";
    console.error("[api/prizes] GET failed", { message });
    return NextResponse.json(
      { error: message },
      { status: message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}
export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await req.json();
    const poolId = String(body.poolId || ""),
      name = String(body.name || "")
        .trim()
        .slice(0, 100),
      week = Number(body.week),
      valueDollars = Number(body.valueDollars || 0);
    if (!poolId || name.length < 2 || week < 1 || week > 18)
      return NextResponse.json(
        { error: "Choose a league, enter a prize name, and select Week 1–18." },
        { status: 400 },
      );
    const canManage = await manageablePoolIds(supabase, user.id);
    if (!canManage.has(poolId))
      return NextResponse.json(
        { error: "Commissioner access required." },
        { status: 403 },
      );
    const eligibility: any = {
      week,
      payment_status: "PAID",
      one_prize_per_entry: body.onePrizePerEntry !== false,
    };
    if (body.activeOnly !== false) eligibility.entry_status = "ACTIVE";
    const { data, error } = await supabase
      .from("prizes")
      .insert({
        pool_id: poolId,
        name,
        description:
          String(body.description || "")
            .trim()
            .slice(0, 300) || null,
        value_cents: Math.max(0, Math.round(valueDollars * 100)) || null,
        draw_at: body.drawAt || null,
        status: "UPCOMING",
        eligibility,
      })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ prize: data }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create prize." },
      { status: 403 },
    );
  }
}
export async function PATCH(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await req.json(),
      prizeId = String(body.prizeId || "");
    const { data: prize, error } = await supabase
      .from("prizes")
      .select("id,pool_id,eligibility")
      .eq("id", prizeId)
      .single();
    if (error || !prize) throw error || new Error("Prize not found.");
    const canManage = await manageablePoolIds(supabase, user.id);
    if (!canManage.has(prize.pool_id))
      return NextResponse.json(
        { error: "Commissioner access required." },
        { status: 403 },
      );
    const eligibility: any = { ...(prize.eligibility || {}) };
    if (typeof body.allowRepeatWinners === "boolean")
      eligibility.one_prize_per_entry = !body.allowRepeatWinners;
    if (typeof body.manualNames === "string") {
      const names = body.manualNames
        .split(/\r?\n|,/)
        .map((name: string) => name.trim())
        .filter(Boolean)
        .slice(0, 2000);
      if (body.useManualList && names.length === 0)
        return NextResponse.json(
          { error: "Enter at least one name before using the manual list." },
          { status: 400 },
        );
      eligibility.draw_list_mode = body.useManualList ? "MANUAL" : "LEAGUE";
      eligibility.manual_entries = names.map((name: string) => ({
        id: `manual-${randomUUID()}`,
        name: name.slice(0, 80),
      }));
    }
    const { data: saved, error: updateError } = await supabase
      .from("prizes")
      .update({ eligibility })
      .eq("id", prizeId)
      .select("id,eligibility")
      .single();
    if (updateError || !saved)
      throw updateError || new Error("Prize settings were not saved.");
    await supabase.from("commissioner_audit_log").insert({
      commissioner_id: user.id,
      action: "PRIZE_ELIGIBILITY_UPDATED",
      entity_type: "prize",
      entity_id: prizeId,
      before_state: { eligibility: prize.eligibility },
      after_state: { eligibility },
    });
    console.info("[api/prizes] PATCH saved", {
      prizeId,
      drawListMode: eligibility.draw_list_mode,
      manualCount: eligibility.manual_entries?.length || 0,
    });
    return NextResponse.json({
      ok: true,
      eligibility: saved.eligibility,
      allowRepeatWinners: !eligibility.one_prize_per_entry,
      drawListMode: eligibility.draw_list_mode,
      manualCount: eligibility.manual_entries?.length || 0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not update prize.";
    console.error("[api/prizes] PATCH failed", { message });
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await req.json(),
      prizeId = String(body.prizeId || "");
    if (!prizeId)
      return NextResponse.json(
        { error: "Choose a prize to delete." },
        { status: 400 },
      );
    const { data: prize, error } = await supabase
      .from("prizes")
      .select("id,pool_id,name,pools(organization_id)")
      .eq("id", prizeId)
      .single();
    if (error || !prize) throw error || new Error("Prize not found.");
    const canManage = await manageablePoolIds(supabase, user.id);
    if (!canManage.has(prize.pool_id))
      return NextResponse.json(
        { error: "Commissioner access required." },
        { status: 403 },
      );
    const { data: draws, error: drawsError } = await supabase
      .from("prize_draws")
      .select("id,winner_name,drawn_at,verification_hash")
      .eq("prize_id", prizeId);
    if (drawsError) throw drawsError;
    const organizationId = (prize as any).pools?.organization_id;
    const { error: auditError } = await supabase
      .from("commissioner_audit_log")
      .insert({
        commissioner_id: user.id,
        organization_id: organizationId,
        action: "PRIZE_DELETED",
        entity_type: "prize",
        entity_id: prizeId,
        before_state: {
          id: prize.id,
          pool_id: prize.pool_id,
          name: prize.name,
          completed_draws: draws || [],
        },
      });
    if (auditError) throw auditError;
    const { data: deleted, error: deleteError } = await supabase
      .from("prizes")
      .delete()
      .eq("id", prizeId)
      .select("id")
      .single();
    if (deleteError) throw deleteError;
    if (!deleted) throw new Error("Prize was not deleted.");
    console.info("[api/prizes] DELETE completed", {
      prizeId,
      poolId: prize.pool_id,
      userId: user.id,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const detail =
      e && typeof e === "object"
        ? (e as {
            message?: string;
            details?: string;
            hint?: string;
            code?: string;
          })
        : null;
    const message =
      e instanceof Error
        ? e.message
        : detail?.message || detail?.details || "Could not delete prize.";
    console.error("[api/prizes] DELETE failed", {
      message,
      code: detail?.code,
      details: detail?.details,
      hint: detail?.hint,
    });
    return NextResponse.json(
      { error: message },
      { status: message === "UNAUTHENTICATED" ? 401 : 400 },
    );
  }
}
