"use client";

import { useEffect, useMemo, useState } from "react";
import {
  entries as seedEntries,
  leaderboard,
  pools as seedPools,
  week1Games as seedWeek1Games,
} from "@/lib/mock";
import type {
  Entry,
  FantasySlot,
  PickemSelection,
  Pool,
  SurvivorPick,
  UserRole,
} from "@/lib/types";

const fantasySlots: FantasySlot[] = [
  { position: "QB", label: "QB" },
  { position: "RB", label: "RB1" },
  { position: "RB", label: "RB2" },
  { position: "WR", label: "WR1" },
  { position: "WR", label: "WR2" },
  { position: "TE", label: "TE" },
];
const demoPlayers: Record<string, string[]> = {
  QB: ["Josh Allen", "Patrick Mahomes", "Lamar Jackson", "Jalen Hurts"],
  RB: ["Saquon Barkley", "Jahmyr Gibbs", "James Cook", "Derrick Henry"],
  WR: ["Ja’Marr Chase", "A.J. Brown", "Puka Nacua", "Nico Collins"],
  TE: ["George Kittle", "Travis Kelce", "Sam LaPorta", "Trey McBride"],
};
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

type LeaderboardType = "SURVIVOR" | "PICKEM" | "PLAYOFF_FANTASY";
type LeaderboardRow = {
  entryId: string;
  name: string;
  rank: number;
  status: string;
  score: number;
  detail: string;
  alive?: boolean;
};

export default function Home() {
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const [tab, setTab] = useState<
    "home" | "pools" | "leaderboard" | "admin"
  >("home");
  const [role, setRole] = useState<UserRole>("PLAYER");
  const [pools, setPools] = useState<Pool[]>(
    supabaseConfigured ? [] : seedPools,
  );
  const [games, setGames] = useState(seedWeek1Games);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [pickWeek, setPickWeek] = useState(1);
  const [nowMs,setNowMs]=useState(()=>Date.now());
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [signedOut, setSignedOut] = useState(false);
  const [entries, setEntries] = useState<Entry[]>(
    supabaseConfigured ? [] : seedEntries,
  );
  const [survivorPicks, setSurvivorPicks] = useState<SurvivorPick[]>([]);
  const [pendingSurvivor, setPendingSurvivor] = useState<{
    gameId: string;
    teamCode: string;
    teamName: string;
  } | null>(null);
  const [savingSurvivor, setSavingSurvivor] = useState(false);
  const [pickem, setPickem] = useState<PickemSelection[]>([]);
  const [pickemSubmitted, setPickemSubmitted] = useState(false);
  const [activeEntry, setActiveEntry] = useState("entry-r91");
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [pickMode, setPickMode] = useState<"survivor" | "pickem" | "fantasy">(
    "survivor",
  );
  const [fantasy, setFantasy] = useState(fantasySlots);
  const [usedPlayers] = useState(["Josh Allen", "James Cook"]);
  const [showFantasyPicker, setShowFantasyPicker] = useState<number | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>("SURVIVOR");
  const [leaderboardPoolId, setLeaderboardPoolId] = useState("");
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [account, setAccount] = useState<{
    email: string;
    displayName: string;
    username: string;
  } | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    fetch("/api/bootstrap")
      .then(async (r) => {
        if (!r.ok) {
          setPools([]);
          setEntries([]);
          setAccount(null);
          setSignedOut(r.status === 401);
          if (r.status !== 401)
            setNotice(
              "Your pool data could not be loaded. Please refresh the page.",
            );
          return;
        }
        const b = await r.json();
        setAccount({
          email: b.user?.email || "",
          displayName: b.profile?.display_name || "",
          username: b.profile?.username || "",
        });
        const mappedPools: Pool[] = (b.pools || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          sport: p.sport,
          type: p.contest_type || p.pool_type,
          status: p.status || (p.is_active ? "OPEN" : "CLOSED"),
          season: String(p.season || ""),
          registrationClosesAt: p.registration_closes_at || undefined,
        }));
        const mappedEntries: Entry[] = (b.entries || []).map((e: any) => ({
          id: e.id,
          poolId: e.pool_id,
          userId: e.user_id,
          entryName: e.entry_name,
          status: e.status || e.entry_status,
        }));
        const mappedGames = (b.games || []).map((g: any) => ({
          id: g.id,
          week: g.week,
          away: g.away_team_code || g.away_team,
          awayCode: g.away_team_code || g.away_team,
          home: g.home_team_code || g.home_team,
          homeCode: g.home_team_code || g.home_team,
          kickoff: g.starts_at || g.kickoff_at,
          status: g.status,
          awayScore: g.away_score ?? undefined,
          homeScore: g.home_score ?? undefined,
        }));
        const gameById = new Map(mappedGames.map((g: any) => [g.id, g]));
        const mappedSurvivor: SurvivorPick[] = (b.survivor || []).map(
          (p: any) => {
            const g: any = gameById.get(p.game_id);
            const teamCode = p.team_code;
            return {
              entryId: p.entry_id,
              week: p.week,
              teamCode,
              teamName:
                teamCode === g?.homeCode
                  ? g.home
                  : teamCode === g?.awayCode
                    ? g.away
                    : teamCode,
              locked: g
                ? g.status !== "SCHEDULED" ||
                  new Date(g.kickoff).getTime() <= Date.now()
                : false,
              result: p.result || "PENDING",
            };
          },
        );
        const mappedPickem: PickemSelection[] = (b.pickem || []).map(
          (p: any) => ({
            entryId: p.entry_id,
            gameId: p.game_id,
            teamCode: p.selected_team || p.team_code,
          }),
        );
        setPools(mappedPools);
        setEntries(mappedEntries);
        if (mappedGames.length) setGames(mappedGames);
        setSurvivorPicks(mappedSurvivor);
        setPickem(mappedPickem);
        const openWeek = Number(b.currentWeek) || 1;
        setCurrentWeek(openWeek);
        setPickWeek(openWeek);
        setSignedOut(false);
        setConnected(true);
      })
      .catch(() => {
        setPools([]);
        setEntries([]);
        setAccount(null);
        setNotice(
          "Your pool data could not be loaded. Please refresh the page.",
        );
      })
      .finally(() => setLoading(false));
  }, [supabaseConfigured]);

  useEffect(()=>{
    const timer=window.setInterval(()=>setNowMs(Date.now()),30000);
    return()=>window.clearInterval(timer);
  },[]);

  useEffect(()=>{
    if(!connected||!games.length)return;
    const season=Number(games.find(game=>game.week===currentWeek)?.kickoff.slice(0,4)||new Date().getUTCFullYear());
    let stopped=false;
    const refresh=async()=>{
      try{
        const response=await fetch(`/api/nfl/live?season=${season}&week=${currentWeek}`,{cache:'no-store'});
        if(!response.ok||stopped)return;
        const body=await response.json();
        const updated=(body.games||[]).map((g:any)=>({id:g.id,week:g.week,away:g.away_team,awayCode:g.away_team,home:g.home_team,homeCode:g.home_team,kickoff:g.kickoff_at,status:g.status,awayScore:g.away_score??undefined,homeScore:g.home_score??undefined}));
        setGames(current=>[...current.filter(game=>game.week!==currentWeek),...updated]);
        const statuses=new Map((body.entries||[]).map((entry:any)=>[entry.id,entry.entry_status]));
        setEntries(current=>current.map(entry=>statuses.has(entry.id)?{...entry,status:statuses.get(entry.id) as Entry['status']}:entry));
        const results=new Map((body.picks||[]).map((pick:any)=>[`${pick.entry_id}-${pick.week}`,pick.result||'PENDING']));
        setSurvivorPicks(current=>current.map(pick=>results.has(`${pick.entryId}-${pick.week}`)?{...pick,result:results.get(`${pick.entryId}-${pick.week}`) as SurvivorPick['result']}:pick));
        setNowMs(Date.now());
      }catch{/* Keep the last verified scoreboard if refresh is temporarily unavailable. */}
    };
    refresh();
    const timer=window.setInterval(refresh,60000);
    return()=>{stopped=true;window.clearInterval(timer);};
  },[connected,currentWeek]);

  useEffect(() => {
    if (tab !== "leaderboard" || !supabaseConfigured) return;
    const matchingPools = pools.filter((pool) => pool.type === leaderboardType);
    const selected = matchingPools.find((pool) => pool.id === leaderboardPoolId) || matchingPools[0];
    if (!selected) {
      setLeaderboardPoolId("");
      setLeaderboardRows([]);
      setLeaderboardError("");
      return;
    }
    if (leaderboardPoolId !== selected.id) {
      setLeaderboardPoolId(selected.id);
      return;
    }

    const controller = new AbortController();
    setLeaderboardLoading(true);
    setLeaderboardError("");
    fetch(`/api/leaderboard?poolId=${encodeURIComponent(selected.id)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load standings.");
        setLeaderboardRows(body.rows || []);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLeaderboardRows([]);
        setLeaderboardError(error instanceof Error ? error.message : "Could not load standings.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLeaderboardLoading(false);
      });
    return () => controller.abort();
  }, [tab, supabaseConfigured, pools, leaderboardType, leaderboardPoolId]);

  const survivorPoolIds = new Set(
    pools
      .filter((p) => p.type === "SURVIVOR" && p.sport === "NFL")
      .map((p) => p.id),
  );
  const pickemPoolIds = new Set(
    pools
      .filter((p) => p.type === "PICKEM" && p.sport === "NFL")
      .map((p) => p.id),
  );
  const mySurvivorEntries = entries.filter((e) =>
    survivorPoolIds.has(e.poolId),
  );
  const activePoolForPicks = selectedPoolId
    ? pools.find((pool) => pool.id === selectedPoolId)
    : undefined;
  const selectedPoolEntries = selectedPoolId
    ? entries.filter((entry) => entry.poolId === selectedPoolId)
    : [];
  const availableSurvivorEntries = selectedPoolId
    ? selectedPoolEntries
    : mySurvivorEntries;
  const activeSurvivor =
    entries.find(
      (e) =>
        e.id === activeEntry &&
        survivorPoolIds.has(e.poolId) &&
        (!selectedPoolId || e.poolId === selectedPoolId),
    ) || availableSurvivorEntries[0];
  const currentGames = games.filter((g) => g.week === currentWeek);
  const pickWeekGames = games.filter((g) => g.week === pickWeek);
  const selectedSurvivor = survivorPicks.find(
    (p) => p.entryId === activeSurvivor?.id && p.week === pickWeek,
  );
  const survivorChoice = pendingSurvivor || selectedSurvivor;
  const usedSurvivorTeams = new Set(
    survivorPicks
      .filter((p) => p.entryId === activeSurvivor?.id && p.week !== pickWeek)
      .map((p) => p.teamCode),
  );
  const fantasyFilled = fantasy.filter((s) => s.player).length;
  const pickemEntries = entries.filter(
    (e) =>
      pickemPoolIds.has(e.poolId) &&
      (!selectedPoolId || e.poolId === selectedPoolId),
  );
  const pickemEntry =
    entries.find((e) => e.id === activeEntry && pickemPoolIds.has(e.poolId)) ||
    pickemEntries[0];
  const currentGameIds = new Set(currentGames.map((g) => g.id));
  const currentPickemCount = pickem.filter(
    (p) => p.entryId === pickemEntry?.id && currentGameIds.has(p.gameId),
  ).length;
  const pickWeekGameIds = new Set(pickWeekGames.map((g) => g.id));
  const pickemCount = pickem.filter(
    (p) => p.entryId === pickemEntry?.id && pickWeekGameIds.has(p.gameId),
  ).length;
  const leaderboardPools = pools.filter((pool) => pool.type === leaderboardType);
  const visibleLeaderboard: LeaderboardRow[] = supabaseConfigured
    ? leaderboardRows
    : leaderboard.map((row) => ({
        entryId: row.name,
        name: row.name,
        rank: row.rank,
        status: row.alive ? "Alive" : "Eliminated",
        score: 0,
        detail: row.alive ? "Alive" : "Eliminated",
        alive: row.alive,
      }));

  function selectSurvivor(gameId: string, teamCode: string, teamName: string) {
    if (!activeSurvivor) return;
    if (usedSurvivorTeams.has(teamCode)) return;
    setPendingSurvivor({ gameId, teamCode, teamName });
    setNotice(null);
  }
  async function confirmSurvivor() {
    if (!activeSurvivor || !pendingSurvivor || savingSurvivor) return;
    const entryId = activeSurvivor.id;
    const { gameId, teamCode, teamName } = pendingSurvivor;
    const confirmed: SurvivorPick = {
      entryId,
      week: pickWeek,
      teamCode,
      teamName,
      locked: false,
      result: "PENDING",
    };
    setSavingSurvivor(true);
    if (!connected) {
      setSurvivorPicks((prev) => [
        ...prev.filter(
          (p) => !(p.entryId === entryId && p.week === pickWeek),
        ),
        confirmed,
      ]);
      setPendingSurvivor(null);
      setSavingSurvivor(false);
      return;
    }
    try {
      const r = await fetch("/api/picks/survivor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryId, gameId, week: pickWeek, teamCode }),
      });
      if (r.ok) {
        setSurvivorPicks((prev) => [
          ...prev.filter(
            (p) => !(p.entryId === entryId && p.week === pickWeek),
          ),
          confirmed,
        ]);
        setPendingSurvivor(null);
        setNotice(`Week ${pickWeek} pick confirmed.`);
        return;
      }
      const j = await r.json();
      setNotice(j.error || "Could not save pick");
    } catch {
      setNotice("Could not save pick. Check your connection and try again.");
    } finally {
      setSavingSurvivor(false);
    }
  }
  async function togglePickem(gameId: string, teamCode: string) {
    if (!pickemEntry) return;
    const entryId = pickemEntry.id;
    const previous = pickem.find(
      (p) => p.entryId === entryId && p.gameId === gameId,
    );
    setPickem((prev) => [
      ...prev.filter((p) => !(p.entryId === entryId && p.gameId === gameId)),
      { entryId, gameId, teamCode },
    ]);
    setPickemSubmitted(false);
    if (!connected) return;
    try {
      const r = await fetch("/api/picks/pickem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryId, gameId, teamCode }),
      });
      if (r.ok) return;
      const j = await r.json();
      setPickem((prev) => {
        const current = prev.find(
          (p) => p.entryId === entryId && p.gameId === gameId,
        );
        if (current?.teamCode !== teamCode) return prev;
        return [
          ...prev.filter(
            (p) => !(p.entryId === entryId && p.gameId === gameId),
          ),
          ...(previous ? [previous] : []),
        ];
      });
      setNotice(j.error || "Could not save Pick’em choice");
    } catch {
      setPickem((prev) => {
        const current = prev.find(
          (p) => p.entryId === entryId && p.gameId === gameId,
        );
        if (current?.teamCode !== teamCode) return prev;
        return [
          ...prev.filter(
            (p) => !(p.entryId === entryId && p.gameId === gameId),
          ),
          ...(previous ? [previous] : []),
        ];
      });
      setNotice(
        "Could not save Pick’em choice. Check your connection and try again.",
      );
    }
  }
  function submitPickem() {
    if (pickemCount !== pickWeekGames.length) return;
    setPickemSubmitted(true);
    setNotice(
      `All ${pickWeekGames.length} Week ${pickWeek} Pick’em selections are submitted and saved.`,
    );
  }
  function openPoolPicks(pool: Pool) {
    const entry = entries.find((e) => e.poolId === pool.id);
    if (entry) setActiveEntry(entry.id);
    setSelectedPoolId(pool.id);
    setPickWeek(currentWeek);
    setPendingSurvivor(null);
    if (pool.type === "SURVIVOR") setPickMode("survivor");
    if (pool.type === "PICKEM") setPickMode("pickem");
    if (pool.type === "PLAYOFF_FANTASY") setPickMode("fantasy");
    setTab("pools");
  }
  function pickFantasy(i: number, player: string) {
    setFantasy((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, player } : s)),
    );
    setShowFantasyPicker(null);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="homeBrand" href="/" aria-label="Degens Sports Pools home">
          <div className="brand">DEGENS</div>
          <div className="subbrand">
            SPORTS POOLS {connected ? "· CONNECTED" : "· DEMO"}
          </div>
        </a>
        <div className="topActions">
          {process.env.NEXT_PUBLIC_SUPABASE_URL &&
            (account ? (
              <a className="accountIdentity" href="/account" aria-label="Open your account">
                <span className="signedInDot" aria-hidden="true" />
                <span>
                  <small>Signed in as</small>
                  <strong>{account.username ? `@${account.username}` : account.displayName || account.email}</strong>
                </span>
              </a>
            ) : (
              <a className="authLink" href="/auth/login">Sign In</a>
            ))}
          <div className="viewSwitcher" role="group" aria-label="Dashboard view">
            <button
              type="button"
              className={role === "PLAYER" ? "active player" : ""}
              aria-pressed={role === "PLAYER"}
              onClick={() => setRole("PLAYER")}
            >
              Player
            </button>
            <button
              type="button"
              className={role === "COMMISSIONER" ? "active commissioner" : ""}
              aria-pressed={role === "COMMISSIONER"}
              onClick={() => setRole("COMMISSIONER")}
            >
              Commissioner
            </button>
          </div>
        </div>
      </header>

      {tab === "home" && (
        <section className="stack">
          <div className="hero">
            <span className="eyebrow">
              {role === "COMMISSIONER"
                ? "COMMISSIONER DASHBOARD"
                : "WELCOME BACK"}
            </span>
            <h1>
              {role === "COMMISSIONER"
                ? "Run every pool from one place."
                : "Your pools, picks and prizes in one place."}
            </h1>
            <p>
              {role === "COMMISSIONER"
                ? "Entries, picks, deadlines, standings and prize draws."
                : "Survivor, Pick’em, playoff fantasy, brackets and live draws."}
            </p>
          </div>
          <nav className="homeQuickActions" aria-label="Quick actions">
            {role === "COMMISSIONER" ? (
              <>
                <a href="/leagues/new">
                  <span>＋</span>
                  <strong>Create League</strong>
                  <small>Start a new pool</small>
                </a>
                <a href="/prizes">
                  <span>◇</span>
                  <strong>Prize Centre</strong>
                  <small>Manage prizes and draws</small>
                </a>
                <a href="/live?host=1">
                  <span>●</span>
                  <strong>Go Live</strong>
                  <small>Broadcast a prize draw</small>
                </a>
                <a href="/join">
                  <span>→</span>
                  <strong>Join League</strong>
                  <small>Enter an invitation code</small>
                </a>
              </>
            ) : (
              <>
                <a href="/join">
                  <span>＋</span>
                  <strong>Join League</strong>
                  <small>Enter your invitation code</small>
                </a>
                <a href="/live?viewer=1">
                  <span>●</span>
                  <strong>Watch Live Draw</strong>
                  <small>Enter a meeting code</small>
                </a>
                <a href="/prizes">
                  <span>◇</span>
                  <strong>Prizes</strong>
                  <small>Upcoming draws and winners</small>
                </a>
                <a href={account ? "/account" : "/auth/login"}>
                  <span>○</span>
                  <strong>My Account</strong>
                  <small>{account ? account.username ? `@${account.username}` : account.email : "Sign in or create account"}</small>
                </a>
              </>
            )}
          </nav>
          {role === "PLAYER" ? (
            <>
              <div className="statsGrid">
                <div>
                  <b>{mySurvivorEntries.length}</b>
                  <span>Survivor entries</span>
                </div>
                <div>
                  <b>
                    {currentPickemCount}/{currentGames.length}
                  </b>
                  <span>Pick’em made</span>
                </div>
                <div>
                  <b>{pools.length}</b>
                  <span>Active pools</span>
                </div>
              </div>
              <div className="alert">
                <strong>Week {currentWeek} is open</strong>
                <span>
                  Make Survivor and Pick’em selections. Each game locks at
                  kickoff.
                </span>
              </div>
            </>
          ) : (
            <div className="statsGrid">
              <div>
                <b>{entries.length}</b>
                <span>Demo entries</span>
              </div>
              <div>
                <b>{pools.length}</b>
                <span>Managed pools</span>
              </div>
              <div>
                <b>{currentWeek}</b>
                <span>Current week</span>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "pools" && !activePoolForPicks && (
        <section className="stack">
          <div className="sectionHeader">
            <div>
              <span className="eyebrow">YOUR LEAGUES</span>
              <h1>My Pools</h1>
            </div>
            <a className="mini manageLink" href="/join">
              + Join
            </a>
          </div>
          <p className="sectionIntro">
            Choose a pool to make picks or manage your entries.
          </p>
          {loading ? (
            <div className="wideCard">
              <span>Loading your pools…</span>
            </div>
          ) : signedOut ? (
            <div className="wideCard poolEmptyState">
              <strong>Sign in to view your pools</strong>
              <span>Your leagues and picks are private to your account.</span>
              <a className="primary" href="/auth/login">
                Sign In or Create Account
              </a>
            </div>
          ) : pools.length === 0 ? (
            <div className="wideCard poolEmptyState">
              <strong>No pools yet</strong>
              <span>Use the invitation code from your commissioner to join.</span>
              <a className="primary" href="/join">
                Join a Pool
              </a>
            </div>
          ) : (
            <div className="poolHubList">
              {pools.map((pool) => {
                const poolEntries = entries.filter(
                  (entry) => entry.poolId === pool.id,
                );
                const canMakePicks =
                  poolEntries.length > 0 &&
                  ["SURVIVOR", "PICKEM", "PLAYOFF_FANTASY"].includes(
                    pool.type,
                  );
                return (
                  <article className="poolHubCard" key={pool.id}>
                    <div className="poolHubTop">
                      <div className="poolIcon" aria-hidden="true">
                        {pool.sport === "NFL"
                          ? "🏈"
                          : pool.sport === "NHL"
                            ? "🏒"
                            : "🏀"}
                      </div>
                      <div className="grow">
                        <strong>{pool.name}</strong>
                        <span>
                          {pool.season} · {pool.type.replaceAll("_", " ")}
                        </span>
                      </div>
                      {poolEntries.length > 0 && <span className="pill paid">Joined</span>}
                    </div>
                    <div className="poolHubMeta">
                      <div>
                        <span>Entries</span>
                        <b>{poolEntries.length}</b>
                      </div>
                      <div>
                        <span>Format</span>
                        <b>{pool.type.replaceAll("_", " ")}</b>
                      </div>
                      <div>
                        <span>Current round</span>
                        <b>Week {currentWeek}</b>
                      </div>
                    </div>
                    {poolEntries.length > 0 && (
                      <div className="poolEntryNames">
                        {poolEntries.map((entry) => (
                          <span key={entry.id}>{entry.entryName}</span>
                        ))}
                      </div>
                    )}
                    <div className="poolHubActions">
                      {canMakePicks && (
                        <button
                          className="primary"
                          onClick={() => openPoolPicks(pool)}
                        >
                          View & Make Picks
                        </button>
                      )}
                      {role === "COMMISSIONER" && (
                        <a
                          className="secondary poolSecondary"
                          href={`/leagues/${pool.id}`}
                        >
                          Manage Pool
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "pools" && activePoolForPicks && (
        <section className="stack">
          <button
            className="poolBackButton"
            onClick={() => {
              setSelectedPoolId(null);
              setPendingSurvivor(null);
            }}
          >
            ← All Pools
          </button>
          <div className="selectedPoolHeader">
            <span className="eyebrow">{activePoolForPicks.sport} POOL</span>
            <h1>{activePoolForPicks.name}</h1>
            <span>
              {activePoolForPicks.type.replaceAll("_", " ")} · Week {pickWeek}
            </span>
          </div>
          {(pickMode === "survivor" || pickMode === "pickem") && (
            <nav className="weekTabs" aria-label="Choose an NFL week">
              {Array.from({ length: 18 }, (_, index) => index + 1).map((week) => {
                const weekGames = games.filter((game) => game.week === week);
                const survivorSaved = survivorPicks.some(
                  (pick) => pick.entryId === activeSurvivor?.id && pick.week === week,
                );
                const weekGameIds = new Set(weekGames.map((game) => game.id));
                const pickemSaved = pickem.filter(
                  (pick) => pick.entryId === pickemEntry?.id && weekGameIds.has(pick.gameId),
                ).length;
                const status = pickMode === "survivor"
                  ? survivorSaved ? "Pick saved" : "Not picked"
                  : weekGames.length ? `${pickemSaved}/${weekGames.length} saved` : "Schedule pending";
                return (
                  <button
                    type="button"
                    key={week}
                    className={`${pickWeek === week ? "weekActive" : ""} ${week === currentWeek ? "weekCurrent" : ""} ${survivorSaved || (weekGames.length > 0 && pickemSaved === weekGames.length) ? "weekComplete" : ""}`}
                    onClick={() => {
                      setPickWeek(week);
                      setPendingSurvivor(null);
                      setPickemSubmitted(false);
                      setNotice(null);
                    }}
                  >
                    <strong>Week {week}</strong>
                    <small>{status}</small>
                  </button>
                );
              })}
            </nav>
          )}
          {pickMode === "survivor" && (
            <>
              <div className="sectionHeader">
                <div>
                  <span className="eyebrow">
                    NFL SURVIVOR · WEEK {pickWeek}
                  </span>
                  <h1>Choose one team</h1>
                </div>
              </div>
              <div className="entryTabs">
                {availableSurvivorEntries.map((e) => (
                  <button
                    className={activeSurvivor?.id === e.id ? "entryActive" : ""}
                    key={e.id}
                    onClick={() => {
                      setActiveEntry(e.id);
                      setPendingSurvivor(null);
                    }}
                  >
                    {e.entryName}
                    <small>{e.status}</small>
                  </button>
                ))}
              </div>
              {usedSurvivorTeams.size > 0 && (
                <div className="ruleBox">
                  <strong>Teams saved in another week are unavailable</strong>
                  <span>
                    {usedSurvivorTeams.size
                      ? [...usedSurvivorTeams].join(" · ")
                      : "No teams used yet."}
                  </span>
                </div>
              )}
              {pickWeekGames.length === 0 && (
                <div className="wideCard"><span>The Week {pickWeek} schedule is not available yet.</span></div>
              )}
              {pickWeekGames.map((g) => (
                <div className="gameCard" key={g.id}>
                  <div className="gameTime">
                    <span>{when(g.kickoff)}</span>
                    <b>{g.status === "FINAL" ? "FINAL" : g.status === "LIVE" ? "LIVE" : "SCHEDULED"}</b>
                  </div>
                  <div className="matchup">
                    <button
                      disabled={
                        g.status !== "SCHEDULED" || new Date(g.kickoff).getTime() <= nowMs || usedSurvivorTeams.has(g.awayCode)
                      }
                      className={
                        survivorChoice?.teamCode === g.awayCode
                          ? "teamPick selectedTeam"
                          : "teamPick"
                      }
                      onClick={() => selectSurvivor(g.id, g.awayCode, g.away)}
                    >
                      <b>{g.awayCode}</b>
                      <span>{g.away}</span>
                      {g.awayScore !== undefined && <strong>{g.awayScore}</strong>}
                    </button>
                    <span className="at">@</span>
                    <button
                      disabled={
                        g.status !== "SCHEDULED" || new Date(g.kickoff).getTime() <= nowMs || usedSurvivorTeams.has(g.homeCode)
                      }
                      className={
                        survivorChoice?.teamCode === g.homeCode
                          ? "teamPick selectedTeam"
                          : "teamPick"
                      }
                      onClick={() => selectSurvivor(g.id, g.homeCode, g.home)}
                    >
                      <b>{g.homeCode}</b>
                      <span>{g.home}</span>
                      {g.homeScore !== undefined && <strong>{g.homeScore}</strong>}
                    </button>
                  </div>
                </div>
              ))}
              {pendingSurvivor ? (
                <div className="stickySubmit">
                  <span>
                    Selected: <b>{pendingSurvivor.teamName}</b>
                  </span>
                  <button
                    className="primary"
                    disabled={savingSurvivor}
                    onClick={confirmSurvivor}
                  >
                    {savingSurvivor ? "Confirming…" : "Confirm Pick"}
                  </button>
                </div>
              ) : (
                selectedSurvivor && (
                  <div className="stickySubmit">
                    <span>
                      Confirmed: <b>{selectedSurvivor.teamName}</b>
                    </span>
                    <button className="primary" disabled>
                      Pick Confirmed
                    </button>
                  </div>
                )
              )}
            </>
          )}
          {pickMode === "pickem" && (
            <>
              <div className="sectionHeader">
                <div>
                  <span className="eyebrow">
                    NFL PICK’EM · WEEK {pickWeek}
                  </span>
                  <h1>
                    {pickemCount}/{pickWeekGames.length} selections
                  </h1>
                </div>
              </div>
              <div className="entryTabs">
                {pickemEntries.map((e) => (
                  <button
                    className={pickemEntry?.id === e.id ? "entryActive" : ""}
                    key={e.id}
                    onClick={() => {
                      setActiveEntry(e.id);
                      setPickemSubmitted(false);
                    }}
                  >
                    {e.entryName}
                    <small>{pools.find((p) => p.id === e.poolId)?.name}</small>
                  </button>
                ))}
              </div>
              {pickWeekGames.length === 0 && (
                <div className="wideCard"><span>The Week {pickWeek} schedule is not available yet.</span></div>
              )}
              {pickWeekGames.map((g) => {
                const sel = pickem.find(
                  (p) => p.gameId === g.id && p.entryId === pickemEntry?.id,
                );
                return (
                  <div className="pickemGame" key={g.id}>
                    <div>
                      <strong>
                        {g.awayCode} @ {g.homeCode}
                      </strong>
                      <span>{when(g.kickoff)}</span>
                    </div>
                    <div className="pickButtons">
                      <button
                        className={sel?.teamCode === g.awayCode ? "chosen" : ""}
                        onClick={() => togglePickem(g.id, g.awayCode)}
                      >
                        {g.awayCode}
                      </button>
                      <button
                        className={sel?.teamCode === g.homeCode ? "chosen" : ""}
                        onClick={() => togglePickem(g.id, g.homeCode)}
                      >
                        {g.homeCode}
                      </button>
                    </div>
                  </div>
                );
              })}
              {pickemSubmitted && (
                <div className="notice">
                  All {pickWeekGames.length} Week {pickWeek} Pick’em
                  selections are submitted and saved.
                </div>
              )}
              <button
                className="primary"
                disabled={
                  pickWeekGames.length === 0 || pickemCount !== pickWeekGames.length || pickemSubmitted
                }
                onClick={submitPickem}
              >
                {pickemSubmitted
                  ? `Week ${pickWeek} Picks Submitted`
                  : "Submit All Picks"}
              </button>
            </>
          )}
          {pickMode === "fantasy" && (
            <>
              <div className="sectionHeader">
                <div>
                  <span className="eyebrow">NFL PLAYOFF FANTASY</span>
                  <h1>Wild Card Lineup</h1>
                </div>
                <div className="scoreBadge">{fantasyFilled}/6</div>
              </div>
              <div className="ruleBox">
                <strong>QB · RB · RB · WR · WR · TE</strong>
                <span>
                  Each player can be used only once by this entry across the
                  entire postseason. Total fantasy points accumulate through the
                  Super Bowl.
                </span>
              </div>
              <div className="used">
                <span>Already used</span>
                {usedPlayers.map((p) => (
                  <b key={p}>{p}</b>
                ))}
              </div>
              <div className="lineup">
                {fantasy.map((slot, i) => (
                  <button
                    className="slot"
                    key={slot.label}
                    onClick={() => setShowFantasyPicker(i)}
                  >
                    <span className="slotPos">{slot.label}</span>
                    <span className="slotPlayer">
                      {slot.player || "Select player"}
                    </span>
                    <span>›</span>
                  </button>
                ))}
              </div>
              <button className="primary" disabled={fantasyFilled < 6}>
                Submit Wild Card Lineup
              </button>
            </>
          )}
        </section>
      )}

      {tab === "leaderboard" && (
        <section className="stack">
          <div>
            <span className="eyebrow">LIVE STANDINGS</span>
            <h1>Leaderboards</h1>
          </div>
          <div className="segmented">
            {([
              ["SURVIVOR", "Survivor"],
              ["PICKEM", "Pick’em"],
              ["PLAYOFF_FANTASY", "Fantasy"],
            ] as const).map(([type, label]) => (
              <button
                type="button"
                key={type}
                className={leaderboardType === type ? "selected" : ""}
                onClick={() => {
                  setLeaderboardType(type);
                  setLeaderboardPoolId("");
                  setLeaderboardRows([]);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {leaderboardPools.length > 0 && (
            <div className="leaderboardPoolTabs" aria-label="Choose a pool">
              {leaderboardPools.map((pool) => (
                <button
                  type="button"
                  key={pool.id}
                  className={leaderboardPoolId === pool.id ? "selected" : ""}
                  onClick={() => {
                    setLeaderboardPoolId(pool.id);
                    setLeaderboardRows([]);
                  }}
                >
                  {pool.name}
                </button>
              ))}
            </div>
          )}
          {leaderboardLoading ? (
            <div className="wideCard"><span>Loading standings…</span></div>
          ) : leaderboardError ? (
            <div className="warning">{leaderboardError}</div>
          ) : leaderboardPools.length === 0 && supabaseConfigured ? (
            <div className="wideCard">
              <span>You do not have a {leaderboardType === "PLAYOFF_FANTASY" ? "Fantasy" : leaderboardType === "PICKEM" ? "Pick’em" : "Survivor"} pool yet.</span>
            </div>
          ) : visibleLeaderboard.length ? (
            visibleLeaderboard.map((row) => (
              <div className="leaderRow" key={row.entryId}>
                <b>#{row.rank}</b>
                <div>
                  <strong>{row.name}</strong>
                  <span>{row.detail}</span>
                </div>
                <div className="leaderResult">
                  <b>{row.score}</b>
                  <span className={row.alive === false ? "out" : "alive"}>{row.status}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="wideCard">
              <span>No entries are ranked in this pool yet.</span>
            </div>
          )}
        </section>
      )}

      {tab === "admin" && (
        <section className="stack">
          <div>
            <span className="eyebrow">COMMISSIONER</span>
            <h1>Control Centre</h1>
          </div>
          {role !== "COMMISSIONER" ? (
            <div className="warning">
              Switch to Commissioner view using the button at the top.
            </div>
          ) : (
            <>
              <div className="statsGrid">
                <div>
                  <b>{entries.length}</b>
                  <span>Entries</span>
                </div>
                <div>
                  <b>{pools.length}</b>
                  <span>Pools</span>
                </div>
                <div>
                  <b>{currentWeek}</b>
                  <span>Current week</span>
                </div>
              </div>
              <h2>Commissioner Actions</h2>
              <div className="actionGrid">
                <button>Send Pick Reminder</button>
                <button>Lock Week</button>
                <a href="/prizes">Prize Centre</a>
                <a href="/live?host=1">Go Live</a>
              </div>
            </>
          )}
        </section>
      )}

      {showFantasyPicker !== null && (
        <div className="sheet">
          <div className="sheetInner">
            <div className="grabber" />
            <div className="sectionHeader">
              <h2>Select {fantasy[showFantasyPicker].label}</h2>
              <button
                className="close"
                onClick={() => setShowFantasyPicker(null)}
              >
                ×
              </button>
            </div>
            {demoPlayers[fantasy[showFantasyPicker].position].map((player) => {
              const used =
                usedPlayers.includes(player) ||
                fantasy.some(
                  (s, idx) => idx !== showFantasyPicker && s.player === player,
                );
              return (
                <button
                  className="playerRow"
                  key={player}
                  disabled={used}
                  onClick={() => pickFantasy(showFantasyPicker, player)}
                >
                  <span>{player}</span>
                  <small>{used ? "USED / UNAVAILABLE" : "AVAILABLE"}</small>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <nav className="bottomNav">
        {(
          [
            ["home", "⌂", "Home"],
            ["pools", "▦", "Pools"],
            ["leaderboard", "≡", "Standings"],
            ["admin", "⚙", "Admin"],
          ] as const
        ).map(([key, icon, label]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => {
              setTab(key);
              if (key === "pools") {
                setSelectedPoolId(null);
                setPendingSurvivor(null);
              }
            }}
          >
            <span>{icon}</span>
            <small>{label}</small>
          </button>
        ))}
      </nav>
    </main>
  );
}
