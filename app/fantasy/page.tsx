"use client";

import { useEffect, useMemo, useState } from "react";

type Entry = { id: string; entry_name: string; pool_id: string; entry_status: string };
type Round = { id: string; pool_id: string; label: string; round_order: number };
type Player = { id: string; full_name: string; team_code: string; position: string; used: boolean; kickoff: string | null };
type FantasyPick = { entry_id: string; round_id: string; slot: string; athlete_id: string; athletes?: { id: string; name: string; team_code: string; position: string } | null };

const slots = ["QB", "RB1", "RB2", "WR1", "WR2", "TE"] as const;
const positionFor = (slot: string) => slot === "QB" ? "QB" : slot.startsWith("RB") ? "RB" : slot.startsWith("WR") ? "WR" : "TE";

export default function Fantasy() {
  const [entries, setEntries] = useState<Entry[]>([]), [rounds, setRounds] = useState<Round[]>([]), [entryId, setEntryId] = useState(""), [roundId, setRoundId] = useState(""), [slot, setSlot] = useState<string>("QB"), [players, setPlayers] = useState<Player[]>([]), [picks, setPicks] = useState<FantasyPick[]>([]), [teams, setTeams] = useState<string[]>([]), [roundStatus, setRoundStatus] = useState({ startsAt: null as string | null, locked: false }), [notice, setNotice] = useState(""), [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/bootstrap").then((r) => r.json()).then((b) => {
      const fantasyPoolIds = new Set((b.pools || []).filter((p: any) => p.sport === "NFL" && p.pool_type === "PLAYOFF_FANTASY").map((p: any) => p.id));
      const nextEntries = (b.entries || []).filter((e: any) => fantasyPoolIds.has(e.pool_id));
      const nextRounds = (b.rounds || []).filter((r: any) => fantasyPoolIds.has(r.pool_id)).sort((a: Round, b: Round) => a.round_order - b.round_order);
      setEntries(nextEntries); setRounds(nextRounds); setPicks((b.fantasy || []).filter((p: FantasyPick) => nextEntries.some((e: Entry) => e.id === p.entry_id)));
      if (nextEntries[0]) setEntryId(nextEntries[0].id); if (nextRounds[0]) setRoundId(nextRounds[0].id); setLoading(false);
    }).catch(() => { setNotice("Could not load your playoff fantasy pool."); setLoading(false); });
  }, []);

  const entry = entries.find((item) => item.id === entryId);
  const entryRounds = rounds.filter((item) => item.pool_id === entry?.pool_id);
  const round = entryRounds.find((item) => item.id === roundId) || entryRounds[0];
  const usedAthleteIds = useMemo(() => new Set(picks.filter((pick) => pick.entry_id === entryId && !(pick.round_id === round?.id && pick.slot === slot)).map((pick) => pick.athlete_id)), [picks, entryId, round?.id, slot]);
  const selectedCount = picks.filter((pick) => pick.entry_id === entryId && pick.round_id === round?.id).length;

  useEffect(() => {
    if (!entry || !round) return;
    fetch(`/api/fantasy/players?entryId=${encodeURIComponent(entry.id)}&roundId=${encodeURIComponent(round.id)}&slot=${encodeURIComponent(slot)}`).then((r) => r.json()).then((j) => {
      setPlayers(j.players || []); setTeams(j.teams || []); setRoundStatus({ startsAt: j.round?.startsAt || null, locked: Boolean(j.round?.locked) }); if (j.error) setNotice(j.error);
    }).catch(() => setNotice("Could not load the playoff player pool."));
  }, [entry?.id, round?.id, slot]);

  const available = players.filter((player) => player.position === positionFor(slot));

  async function choose(player: Player) {
    if (!entry || !round || player.used || usedAthleteIds.has(player.id) || roundStatus.locked) return;
    setNotice("");
    const response = await fetch("/api/picks/fantasy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entryId: entry.id, roundId: round.id, slot, athleteId: player.id }) });
    const body = await response.json();
    if (!response.ok) { setNotice(body.error || "Could not save player"); return; }
    setPicks((current) => [...current.filter((pick) => !(pick.entry_id === entry.id && pick.round_id === round.id && pick.slot === slot)), { entry_id: entry.id, round_id: round.id, slot, athlete_id: player.id, athletes: { id: player.id, name: player.full_name, team_code: player.team_code, position: player.position } }]);
    setNotice(`${player.full_name} saved to ${slot}.`);
  }

  if (loading) return <main className="featurePage"><section className="featureShell"><div className="notice">Loading playoff fantasy…</div></section></main>;
  if (!entries.length) return <main className="featurePage"><header className="featureTop"><a href="/">← Degens</a><b>NFL PLAYOFF FANTASY</b></header><section className="featureShell"><div className="featureHero"><span>FULL-PPR PLAYOFF POOL</span><h1>No playoff fantasy entry yet</h1><p>Join the NFL Playoff Fantasy pool first, then return here to build your lineups.</p></div><a className="primary" href="/join">Join a Pool</a></section></main>;

  return <main className="featurePage"><header className="featureTop"><a href="/">← Degens</a><b>NFL PLAYOFF FANTASY</b><a href="/">Home</a></header><section className="featureShell"><div className="featureHero"><span>FULL PPR · QB · RB · RB · WR · WR · TE</span><h1>Build every playoff round</h1><p>Choose from the teams still alive in each round. Every player can be used once per entry for the entire postseason.</p></div><div className="fantasyRules"><strong>Scoring: full PPR</strong><span>1 point per reception · 1 point per 10 receiving/rushing yards · 1 point per 25 passing yards · TDs 4/6 · INT −2 · fumble lost −2</span></div><label className="fieldLabel">Entry<select className="textInput" value={entryId} onChange={(e) => setEntryId(e.target.value)}>{entries.map((item) => <option key={item.id} value={item.id}>{item.entry_name}</option>)}</select></label><nav className="weekTabs" aria-label="Choose playoff round">{entryRounds.map((item) => <button type="button" key={item.id} className={item.id === round?.id ? "weekActive" : ""} onClick={() => { setRoundId(item.id); setNotice(""); }}>{item.label}</button>)}</nav>{round && <div className="roundSummary"><strong>{round.label}</strong><span>{teams.length ? `Teams available: ${teams.join(", ")}` : "Playoff schedule not synced yet"}{roundStatus.startsAt ? ` · Locks ${new Date(roundStatus.startsAt).toLocaleString()}` : ""}</span></div>}<div className="lineupSlots">{slots.map((item) => { const pick = picks.find((p) => p.entry_id === entryId && p.round_id === round?.id && p.slot === item); return <button type="button" key={item} className={slot === item ? "activeSlot" : ""} onClick={() => setSlot(item)}><small>{item}</small><b>{pick?.athletes?.name || "Select player"}</b><span>{pick?.athletes?.team_code || positionFor(item)}</span></button>; })}</div><h2>Available {positionFor(slot)}s</h2>{roundStatus.locked && <div className="warning">This round is locked because playoff games have started.</div>}{!roundStatus.locked && !available.length && <div className="notice">No players are available yet. The commissioner needs to sync the NFL playoff schedule and player list.</div>}<div className="playerList">{available.map((player) => { const unavailable = player.used || usedAthleteIds.has(player.id); return <button type="button" key={player.id} disabled={unavailable || roundStatus.locked} onClick={() => choose(player)}><div><b>{player.full_name}</b><span>{player.team_code}{player.kickoff ? ` · ${new Date(player.kickoff).toLocaleString()}` : ""}</span></div><small>{unavailable ? "USED" : roundStatus.locked ? "LOCKED" : "SELECT"}</small></button>; })}</div>{notice && <div className="notice">{notice}</div>}<div className="roundProgress"><strong>{selectedCount}/6 slots filled</strong><span>{usedAthleteIds.size} players already used by this entry across the postseason.</span></div></section></main>;
}
