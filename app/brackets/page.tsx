"use client";
import { useEffect, useMemo, useState } from "react";

type Pool = { id: string; name: string; sport: "NHL" | "NBA"; season: number };
type Matchup = { id: string; round_number: number; matchup_number: number; team1: string | null; team2: string | null };
type Pick = { winner: string; seriesLength: number };
const rounds = ["Round 1", "Round 2", "Conference Finals", "Championship"];

export default function Brackets() {
  const [pools, setPools] = useState<Pool[]>([]), [poolId, setPoolId] = useState(""),
    [matchups, setMatchups] = useState<Matchup[]>([]), [picks, setPicks] = useState<Record<string, Pick>>({}),
    [notice, setNotice] = useState(""), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const selected = pools.find((pool) => pool.id === poolId) || pools[0];

  async function load(nextPoolId?: string) {
    setLoading(true); setNotice("");
    const query = nextPoolId ? `?poolId=${encodeURIComponent(nextPoolId)}` : "";
    const response = await fetch(`/api/brackets/submit${query}`);
    const result = await response.json();
    if (!response.ok) { setNotice(result.error || "Could not load bracket."); setLoading(false); return; }
    setPools(result.pools || []); setPoolId(result.pool?.id || ""); setMatchups(result.matchups || []);
    setPicks(Object.fromEntries((result.picks || []).map((pick: any) => [pick.matchup_id, { winner: pick.predicted_winner, seriesLength: pick.predicted_series_length || 6 }])));
    if (result.error) setNotice(result.error);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  const bracketRounds = useMemo(() => {
    return [1, 2, 3, 4].map((round) => matchups.filter((matchup) => matchup.round_number === round).map((matchup) => {
      if (matchup.team1 || matchup.team2 || round === 1) return matchup;
      const previous = matchups.filter((item) => item.round_number === round - 1);
      const first = previous[(matchup.matchup_number - 1) * 2];
      const second = previous[(matchup.matchup_number - 1) * 2 + 1];
      return { ...matchup, team1: picks[first?.id]?.winner || null, team2: picks[second?.id]?.winner || null };
    }));
  }, [matchups, picks]);

  function choose(matchup: Matchup, winner: string) {
    if (!winner) return;
    setPicks((current) => ({ ...current, [matchup.id]: { winner, seriesLength: current[matchup.id]?.seriesLength || 6 } }));
  }
  async function submit() {
    if (!selected) return;
    if (Object.keys(picks).length !== matchups.length || matchups.some((matchup) => !picks[matchup.id]?.winner)) {
      setNotice(`Complete all ${matchups.length} series before submitting.`); return;
    }
    setSaving(true); setNotice("");
    const response = await fetch("/api/brackets/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ poolId: selected.id, picks }) });
    const result = await response.json();
    setNotice(response.ok ? `${selected.sport} bracket saved to ${selected.name}.` : result.error || "Could not save bracket.");
    setSaving(false);
  }
  return <main className="bracketPage"><header className="bracketHeader"><a href="/">← Home</a><div><b>SPORTS SYNDICATE</b><span>PLAYOFF BRACKETS</span></div><a href="/">Dashboard</a></header>
    <section className="bracketShell"><div className="bracketHero"><span>LEAGUE-BASED PLAYOFF CHALLENGE</span><h1>{selected ? `${selected.sport} Playoff Bracket` : "Playoff Brackets"}</h1><p>Choose every series winner and length. Your submission is saved to your selected league and entry.</p></div>
      {pools.length > 0 && <label className="fieldLabel">Bracket league<select className="textInput" value={selected?.id || ""} onChange={(event) => { setPoolId(event.target.value); void load(event.target.value); }}>{pools.map((pool) => <option key={pool.id} value={pool.id}>{pool.name} · {pool.sport} {pool.season}</option>)}</select></label>}
      {loading ? <div className="bracketNotice">Loading your bracket leagues…</div> : !pools.length ? <div className="bracketNotice">You are not in an NHL or NBA bracket league yet. Join a league first, then return here.</div> : <>
        <div className="bracketRounds">{bracketRounds.map((round, index) => <section key={index}><h2>{rounds[index]}</h2>{round.map((matchup) => <article className="seriesCard" key={matchup.id}><button disabled={!matchup.team1} className={picks[matchup.id]?.winner === matchup.team1 ? "winner" : ""} onClick={() => choose(matchup, matchup.team1 || "")}><b>{matchup.team1 || "TBD"}</b></button><button disabled={!matchup.team2} className={picks[matchup.id]?.winner === matchup.team2 ? "winner" : ""} onClick={() => choose(matchup, matchup.team2 || "")}><b>{matchup.team2 || "TBD"}</b></button><div className="games"><span>Series length</span>{[4, 5, 6, 7].map((length) => <button disabled={!picks[matchup.id]?.winner} className={picks[matchup.id]?.seriesLength === length ? "selected" : ""} key={length} onClick={() => setPicks((current) => ({ ...current, [matchup.id]: { winner: current[matchup.id]?.winner || matchup.team1 || "", seriesLength: length } }))}>{length}</button>)}</div></article>)}</section>)}</div>
        {notice && <div className="bracketNotice">{notice}</div>}<button className="bracketSubmit" disabled={saving} onClick={submit}>{saving ? "Saving…" : `Submit ${selected?.sport} Bracket`}</button></>}
    </section></main>;
}
