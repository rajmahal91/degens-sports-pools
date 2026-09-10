"use client";
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
type Prize = {
  id: string;
  pool_id: string;
  title: string;
  value_cents: number | null;
  scheduled_draw_at: string | null;
  week: number | null;
  eligible_count: number;
  my_eligible_entries: string[];
  eligible_entries?: { id: string; name: string }[];
  eligibility: any;
  prize_draws: any[];
};
type Pool = { id: string; name: string };
const money = (c: number | null) =>
  c == null
    ? "Value TBA"
    : new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
      }).format(c / 100);
export default function Prizes() {
  const [prizes, setPrizes] = useState<Prize[]>([]),
    [pools, setPools] = useState<Pool[]>([]),
    [manageable, setManageable] = useState<string[]>([]),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState("");
  const [manualDrafts, setManualDrafts] = useState<Record<string, string>>({});
  const [savingList, setSavingList] = useState<string>("");
  const [deleting, setDeleting] = useState<string>("");
  const [poolId, setPoolId] = useState(""),
    [name, setName] = useState(""),
    [week, setWeek] = useState(1),
    [value, setValue] = useState(""),
    [drawAt, setDrawAt] = useState(""),
    [saving, setSaving] = useState(false);
  async function api(path: string, init: RequestInit = {}) {
    const { data } = await createClient().auth.getSession();
    const headers = new Headers(init.headers);
    if (data.session?.access_token)
      headers.set("authorization", `Bearer ${data.session.access_token}`);
    return fetch(path, { ...init, headers });
  }
  async function load() {
    const r = await api("/api/prizes");
    const j = await r.json();
    if (r.status === 401 && j.error === "UNAUTHENTICATED") {
      window.location.replace("/auth/login?next=/prizes&reason=session");
      return;
    }
    if (!r.ok) {
      setMessage(j.error || "Could not load prizes");
      return;
    }
    setPrizes(j.prizes || []);
    setPools(j.pools || []);
    setManageable(j.canManagePoolIds || []);
    if (!poolId) setPoolId((j.canManagePoolIds || [])[0] || "");
  }
  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);
  async function create(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const r = await api("/api/prizes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        poolId,
        name,
        week,
        valueDollars: value,
        drawAt: drawAt ? new Date(drawAt).toISOString() : null,
        activeOnly: true,
        onePrizePerEntry: true,
      }),
    });
    const j = await r.json();
    if (r.ok) {
      setName("");
      setValue("");
      setDrawAt("");
      setMessage("Prize added to the weekly draw schedule.");
      await load();
    } else setMessage(j.error || "Could not add prize");
    setSaving(false);
  }
  async function setRepeats(prize: Prize, allow: boolean) {
    const r = await api("/api/prizes", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prizeId: prize.id, allowRepeatWinners: allow }),
    });
    const j = await r.json();
    setMessage(
      r.ok
        ? allow
          ? "Repeat winners are allowed for this prize."
          : "Previous winning entries are excluded for this prize."
        : j.error || "Could not update prize",
    );
    if (r.ok) await load();
  }
  async function saveManual(prize: Prize, useManualList: boolean) {
    const names =
      manualDrafts[prize.id] ??
      (prize.eligibility?.manual_entries || [])
        .map((e: any) => e.name)
        .join("\n");
    setSavingList(prize.id);
    setMessage("");
    const r = await api("/api/prizes", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prizeId: prize.id,
        useManualList,
        manualNames: names,
      }),
    });
    const j = await r.json();
    if (r.ok) {
      setPrizes((current) =>
        current.map((p) =>
          p.id === prize.id
            ? {
                ...p,
                eligibility: j.eligibility,
                eligible_count: useManualList
                  ? j.manualCount
                  : p.eligible_count,
              }
            : p,
        ),
      );
      setMessage(
        useManualList
          ? `Manual list saved: ${j.manualCount} names will appear on the wheel.`
          : "League entries saved as the wheel source.",
      );
      await load();
    } else setMessage(j.error || "Could not save draw list");
    setSavingList("");
  }
  async function editWinner(draw: any, winnerEntryId: string) {
    const reason = window.prompt("Reason for changing this winner:");
    if (!reason) return;
    const r = await api("/api/admin/draw", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drawId: draw.id, winnerEntryId, reason }),
    });
    const j = await r.json();
    setMessage(
      r.ok
        ? `Winner changed to ${j.winner.name}. The override was added to the audit log.`
        : j.error || "Could not edit winner",
    );
    if (r.ok) await load();
  }
  async function deletePrize(prize: Prize) {
    const confirmed = window.confirm(
      `Delete “${prize.title}”? This cannot be undone.`,
    );
    if (!confirmed) return;
    setDeleting(prize.id);
    setMessage("");
    const r = await api("/api/prizes", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prizeId: prize.id }),
    });
    const j = await r.json();
    setMessage(
      r.ok
        ? `${prize.title} was deleted.`
        : j.error || "Could not delete prize",
    );
    if (r.ok) await load();
    setDeleting("");
  }
  const upcoming = prizes.filter(
      (p) => !p.prize_draws?.some((d) => d.drawn_at),
    ),
    past = prizes.filter((p) => p.prize_draws?.some((d) => d.drawn_at));
  return (
    <main className="prizePage">
      <header className="prizeTop">
        <a href="/">← Degens</a>
        <div>
          <b>DEGENS</b>
          <span>PRIZE CENTRE</span>
        </div>
        <a href="/live?host=1">Spin Wheel</a>
      </header>
      <section className="prizeShell">
        <div className="prizeHero">
          <span>WEEKS 1–18 · VERIFIED DRAWS</span>
          <h1>Prizes & Draws</h1>
          <p>
            Paid, active entries are calculated directly from each league. Every
            draw saves its eligible list, winner, timestamp and verification
            record.
          </p>
        </div>
        {!loading && manageable.length > 0 && (
          <form className="wideCard leagueForm" onSubmit={create}>
            <h2>Add Weekly Prize</h2>
            <label className="fieldLabel">
              League
              <select
                className="textInput"
                value={poolId}
                onChange={(e) => setPoolId(e.target.value)}
              >
                {pools
                  .filter((p) => manageable.includes(p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="fieldLabel">
              Week
              <select
                className="textInput"
                value={week}
                onChange={(e) => setWeek(Number(e.target.value))}
              >
                {Array.from({ length: 18 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Week {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldLabel">
              Prize name
              <input
                className="textInput"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Signed jersey"
                required
              />
            </label>
            <label className="fieldLabel">
              Value (CAD)
              <input
                className="textInput"
                type="number"
                min="0"
                step=".01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="500"
              />
            </label>
            <label className="fieldLabel">
              Draw date and time
              <input
                className="textInput"
                type="datetime-local"
                value={drawAt}
                onChange={(e) => setDrawAt(e.target.value)}
              />
            </label>
            <button className="primary" disabled={saving}>
              {saving ? "Adding…" : "Add Prize"}
            </button>
          </form>
        )}
        {message && <div className="notice">{message}</div>}
        {loading ? (
          <div className="notice">Loading prizes…</div>
        ) : (
          <>
            <div className="prizeSummary">
              <div>
                <b>{upcoming.length}</b>
                <span>Upcoming</span>
              </div>
              <div>
                <b>{past.length}</b>
                <span>Completed</span>
              </div>
              <div>
                <b>{prizes.reduce((n, p) => n + p.eligible_count, 0)}</b>
                <span>Eligible entries</span>
              </div>
            </div>
            <h2>Upcoming Draws</h2>
            <div className="prizeGrid">
              {upcoming.map((p) => (
                <article className="prizeCard" key={p.id}>
                  <div className="prizeSport">
                    🏆 {p.week ? `WEEK ${p.week}` : "SPECIAL DRAW"}
                  </div>
                  <h3>{p.title}</h3>
                  <b className="prizeValue">{money(p.value_cents)}</b>
                  <div className="prizeMeta">
                    <span>
                      {p.scheduled_draw_at
                        ? new Date(p.scheduled_draw_at).toLocaleString()
                        : "Date TBA"}
                    </span>
                    <span>
                      {p.eligible_count} names on wheel ·{" "}
                      {p.eligibility?.draw_list_mode === "MANUAL"
                        ? "Manual list"
                        : "League entries"}
                    </span>
                  </div>
                  <div
                    className={
                      p.my_eligible_entries.length ? "elig yes" : "elig"
                    }
                  >
                    {p.my_eligible_entries.length
                      ? `✓ Eligible: ${p.my_eligible_entries.join(", ")}`
                      : "No eligible entry on this account"}
                  </div>
                  {manageable.includes(p.pool_id) && (
                    <div className="methodPanel">
                      <label className="fieldLabel">
                        <input
                          type="checkbox"
                          checked={!p.eligibility?.one_prize_per_entry}
                          onChange={(e) => setRepeats(p, e.target.checked)}
                        />{" "}
                        Allow an entry to win multiple prizes
                      </label>
                      <label className="fieldLabel">
                        Manual draw names — one per line
                        <textarea
                          className="textInput"
                          rows={7}
                          value={
                            manualDrafts[p.id] ??
                            (p.eligibility?.manual_entries || [])
                              .map((e: any) => e.name)
                              .join("\n")
                          }
                          onChange={(e) =>
                            setManualDrafts((x) => ({
                              ...x,
                              [p.id]: e.target.value,
                            }))
                          }
                          placeholder={"Rouge91\nHMundi\nSunnyS"}
                        />
                      </label>
                      <div className="actionGrid">
                        <button
                          type="button"
                          disabled={savingList === p.id}
                          onClick={() => saveManual(p, true)}
                        >
                          {savingList === p.id ? "Saving…" : "Use Manual List"}
                        </button>
                        <button
                          type="button"
                          disabled={savingList === p.id}
                          onClick={() => saveManual(p, false)}
                        >
                          {savingList === p.id
                            ? "Saving…"
                            : "Use League Entries"}
                        </button>
                        <button
                          type="button"
                          className="deletePrizeButton"
                          disabled={deleting === p.id}
                          onClick={() => deletePrize(p)}
                        >
                          {deleting === p.id ? "Deleting…" : "Delete Prize"}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
            {upcoming.length === 0 && (
              <div className="notice">No upcoming prizes scheduled.</div>
            )}
            <h2>Past Winners</h2>
            {past.length === 0 ? (
              <div className="notice">No completed draws yet.</div>
            ) : (
              past.map((p) => {
                const d = p.prize_draws.find((x) => x.drawn_at);
                const options = d?.eligible_snapshot || [];
                const winner = options.find(
                  (e: any) =>
                    e.id === (d.winner_snapshot_id || d.winner_entry_id),
                );
                return (
                  <div className="pastPrize" key={p.id}>
                    <div>
                      <strong>
                        {p.week ? `Week ${p.week} · ` : ""}
                        {p.title}
                      </strong>
                      <span>
                        {d.winner_name || winner?.name || "Winner recorded"} ·{" "}
                        {money(p.value_cents)}
                      </span>
                      {d.override_reason && (
                        <small>
                          Commissioner override: {d.override_reason}
                        </small>
                      )}
                    </div>
                    <div>
                      <small>
                        {d.overridden_at ? "AUDITED OVERRIDE" : "VERIFIED DRAW"}
                      </small>
                      {manageable.includes(p.pool_id) && (
                        <select
                          value={
                            d.winner_snapshot_id || d.winner_entry_id || ""
                          }
                          onChange={(e) => editWinner(d, e.target.value)}
                        >
                          {options.map((entry: any) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <a href={`/api/draws/verify?id=${d.id}`} target="_blank">
                        Verify
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </section>
    </main>
  );
}
