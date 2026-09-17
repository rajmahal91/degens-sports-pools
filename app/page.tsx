"use client";

import { useEffect, useMemo, useState } from "react";
import PickReceipts from "@/components/PickReceipts";
import {
  entries as seedEntries,
  leaderboard,
  pools as seedPools,
  week1Games as seedWeek1Games,
} from "@/lib/mock";
import type {
  Entry,
  FantasySlot,
  NFLGame,
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

function pickemLockTime(
  game: NFLGame,
  weekGames: NFLGame[],
  deadlineMode: Pool["deadlineMode"],
) {
  const kickoff = new Date(game.kickoff).getTime();
  if (deadlineMode !== "SUNDAY_10AM_PT") return kickoff;
  const sundayKickoffs = weekGames
    .filter(
      (weekGame) =>
        new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Vancouver",
          weekday: "short",
        }).format(new Date(weekGame.kickoff)) === "Sun",
    )
    .map((weekGame) => new Date(weekGame.kickoff).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  return Math.min(kickoff, sundayKickoffs[0] ?? kickoff);
}

type LeaderboardType = "SURVIVOR" | "PICKEM" | "PLAYOFF_FANTASY";
type LeaderboardRow = {
  entryId: string;
  name: string;
  rank: number;
  status: string;
  score: number;
  detail: string;
  alive?: boolean;
  picks?: Array<{
    week: number;
    teamCode: string | null;
    locked: boolean;
    result: "WIN" | "LOSS" | "PENDING";
  }>;
};

type DashboardPrize = {
  id: string;
  pool_id: string;
  title: string;
  status: string;
  scheduled_draw_at: string | null;
  week: number | null;
  prize_draws?: Array<{ drawn_at: string | null; winner_name: string | null }>;
};

function countdown(targetMs: number | null, nowMs: number) {
  if (!targetMs) return "Deadline unavailable";
  const difference = targetMs - nowMs;
  if (difference <= 0) return "Deadline passed";
  const totalMinutes = Math.floor(difference / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${Math.max(1, minutes)}m remaining`;
}

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
  const [manageablePoolIds, setManageablePoolIds] = useState<string[]>(
    supabaseConfigured ? [] : seedPools.map((pool) => pool.id),
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
  const [fantasyPickCounts, setFantasyPickCounts] = useState<Record<string, number>>({});
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
  const [receiptRefreshToken, setReceiptRefreshToken] = useState(0);
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>("SURVIVOR");
  const [leaderboardPoolId, setLeaderboardPoolId] = useState("");
  const [leaderboardWeek, setLeaderboardWeek] = useState<number | null>(null);
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [dashboardPrizes, setDashboardPrizes] = useState<DashboardPrize[]>([]);
  const [dashboardStandingRows, setDashboardStandingRows] = useState<LeaderboardRow[]>([]);
  const [dashboardStandingPool, setDashboardStandingPool] = useState<Pool | null>(null);
  const [account, setAccount] = useState<{
    email: string;
    displayName: string;
    username: string;
    isCommissioner: boolean;
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
          isCommissioner: Boolean(b.profile?.is_commissioner),
        });
        const mappedPools: Pool[] = (b.pools || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          sport: p.sport,
          type: p.contest_type || p.pool_type,
          status: p.status || (p.is_active ? "OPEN" : "CLOSED"),
          season: String(p.season || ""),
          registrationClosesAt: p.registration_closes_at || undefined,
          deadlineMode:
            p.scoring_settings?.deadline_mode === "SUNDAY_10AM_PT"
              ? "SUNDAY_10AM_PT"
              : "GAME_KICKOFF",
          playoffStartsAt:
            p.pool_type === "PLAYOFF_FANTASY"
              ? (b.rounds || [])
                  .filter((round: any) => round.pool_id === p.id && round.starts_at)
                  .sort((a: any, b: any) => Number(a.round_order) - Number(b.round_order))[0]
                  ?.starts_at
              : undefined,
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
          awayWinProbability: g.raw?.market?.awayWinProbability ?? undefined,
          homeWinProbability: g.raw?.market?.homeWinProbability ?? undefined,
          marketProvider: g.raw?.market?.provider ?? undefined,
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
        setManageablePoolIds(b.manageablePoolIds || []);
        setEntries(mappedEntries);
        if (mappedGames.length) setGames(mappedGames);
        setSurvivorPicks(mappedSurvivor);
        setPickem(mappedPickem);
        setFantasyPickCounts(
          (b.fantasy || []).reduce((counts: Record<string, number>, pick: any) => {
            const entryId = String(pick.entry_id || "");
            if (entryId) counts[entryId] = (counts[entryId] || 0) + 1;
            return counts;
          }, {}),
        );
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
    const season=Number(
      pools.find(pool=>pool.id===selectedPoolId)?.season||
      pools.find(pool=>pool.sport==="NFL"&&pool.type==="SURVIVOR")?.season||
      new Date().getUTCFullYear(),
    );
    let stopped=false;
    const refresh=async()=>{
      try{
        const displayedWeek=tab==="pools"?pickWeek:currentWeek;
        const response=await fetch(`/api/nfl/live?season=${season}&week=${displayedWeek}&currentWeek=${currentWeek}`,{cache:'no-store'});
        if(!response.ok||stopped)return;
        const body=await response.json();
        const updated=(body.games||[]).map((g:any)=>({id:g.id,week:g.week,away:g.away_team,awayCode:g.away_team,home:g.home_team,homeCode:g.home_team,kickoff:g.kickoff_at,status:g.status,awayScore:g.away_score??undefined,homeScore:g.home_score??undefined,awayWinProbability:g.raw?.market?.awayWinProbability??undefined,homeWinProbability:g.raw?.market?.homeWinProbability??undefined,marketProvider:g.raw?.market?.provider??undefined}));
        const refreshedWeeks=new Set<number>(updated.map((game:{week:number})=>game.week));
        setGames(current=>[...current.filter(game=>!refreshedWeeks.has(game.week)),...updated]);
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
  },[connected,currentWeek,pickWeek,selectedPoolId,pools,tab]);

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
    const weekQuery =
      leaderboardType === "PICKEM" && leaderboardWeek !== null
        ? `&week=${leaderboardWeek}`
        : "";
    fetch(`/api/leaderboard?poolId=${encodeURIComponent(selected.id)}${weekQuery}`, { signal: controller.signal })
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
  }, [tab, supabaseConfigured, pools, leaderboardType, leaderboardPoolId, leaderboardWeek]);

  useEffect(() => {
    if (!connected || tab !== "home") return;
    const controller = new AbortController();
    const priorityPool = pools.find(
      (pool) =>
        entries.some((entry) => entry.poolId === pool.id) &&
        ["SURVIVOR", "PICKEM", "PLAYOFF_FANTASY"].includes(pool.type),
    );

    fetch("/api/prizes", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return { prizes: [] };
        return response.json();
      })
      .then((body) => setDashboardPrizes(body.prizes || []))
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setDashboardPrizes([]);
      });

    if (!priorityPool) {
      setDashboardStandingPool(null);
      setDashboardStandingRows([]);
      return () => controller.abort();
    }
    const weekQuery = priorityPool.type === "PICKEM" ? `&week=${currentWeek}` : "";
    fetch(
      `/api/leaderboard?poolId=${encodeURIComponent(priorityPool.id)}${weekQuery}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (response) => {
        if (!response.ok) return { rows: [] };
        return response.json();
      })
      .then((body) => {
        setDashboardStandingPool(priorityPool);
        setDashboardStandingRows(body.rows || []);
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setDashboardStandingPool(priorityPool);
          setDashboardStandingRows([]);
        }
      });
    return () => controller.abort();
  }, [connected, tab, pools, entries, currentWeek]);

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

  const dashboardTasks = useMemo(() => {
    const tasks: Array<{
      pool: Pool;
      entry: Entry;
      kind: "SURVIVOR" | "PICKEM" | "PLAYOFF_FANTASY";
      missing: number;
      deadlineMs: number | null;
    }> = [];
    for (const entry of entries) {
      if (entry.status !== "ACTIVE") continue;
      const pool = pools.find((candidate) => candidate.id === entry.poolId);
      if (
        !pool ||
        !["SURVIVOR", "PICKEM", "PLAYOFF_FANTASY"].includes(pool.type)
      )
        continue;
      const weekGames = games.filter((game) => game.week === currentWeek);
      if (pool.type === "PLAYOFF_FANTASY") {
        const missing = Math.max(0, 6 - (fantasyPickCounts[entry.id] || 0));
        const playoffStart = pool.playoffStartsAt
          ? new Date(pool.playoffStartsAt).getTime()
          : null;
        // Playoff Fantasy is dormant until the postseason schedule has a real
        // start date. Never use a regular-season NFL kickoff as its deadline.
        if (!missing || !playoffStart || !Number.isFinite(playoffStart) || playoffStart <= nowMs) continue;
        tasks.push({
          pool,
          entry,
          kind: "PLAYOFF_FANTASY",
          missing,
          deadlineMs: playoffStart,
        });
        continue;
      }
      if (!weekGames.length) continue;
      if (pool.type === "SURVIVOR") {
        const hasPick = survivorPicks.some(
          (pick) => pick.entryId === entry.id && pick.week === currentWeek,
        );
        if (hasPick) continue;
        const openKickoffs = weekGames
          .filter((game) => game.status === "SCHEDULED")
          .map((game) => new Date(game.kickoff).getTime())
          .filter((time) => Number.isFinite(time) && time > nowMs)
          .sort((a, b) => a - b);
        tasks.push({
          pool,
          entry,
          kind: "SURVIVOR",
          missing: 1,
          deadlineMs: openKickoffs[0] ?? null,
        });
        continue;
      }
      const gameIds = new Set(weekGames.map((game) => game.id));
      const completed = pickem.filter(
        (pick) => pick.entryId === entry.id && gameIds.has(pick.gameId),
      ).length;
      const missing = Math.max(0, weekGames.length - completed);
      if (!missing) continue;
      const openLocks = weekGames
        .filter(
          (game) =>
            !pickem.some(
              (pick) => pick.entryId === entry.id && pick.gameId === game.id,
            ),
        )
        .map((game) => pickemLockTime(game, weekGames, pool.deadlineMode))
        .filter((time) => Number.isFinite(time) && time > nowMs)
        .sort((a, b) => a - b);
      tasks.push({
        pool,
        entry,
        kind: "PICKEM",
        missing,
        deadlineMs: openLocks[0] ?? null,
      });
    }
    return tasks.sort(
      (a, b) =>
        (a.deadlineMs ?? Number.MAX_SAFE_INTEGER) -
        (b.deadlineMs ?? Number.MAX_SAFE_INTEGER),
    );
  }, [entries, pools, games, currentWeek, survivorPicks, pickem, fantasyPickCounts, nowMs]);

  const primaryTask = dashboardTasks[0];
  const upcomingPrize = dashboardPrizes
    .filter(
      (prize) =>
        !prize.prize_draws?.length &&
        !["DRAWN", "COMPLETE", "CANCELLED"].includes(prize.status),
    )
    .sort((a, b) => {
      const left = a.scheduled_draw_at
        ? new Date(a.scheduled_draw_at).getTime()
        : Number.MAX_SAFE_INTEGER;
      const right = b.scheduled_draw_at
        ? new Date(b.scheduled_draw_at).getTime()
        : Number.MAX_SAFE_INTEGER;
      return left - right;
    })[0];
  const recentSurvivorResults = [...survivorPicks]
    .filter((pick) => pick.week <= currentWeek)
    .sort((a, b) => b.week - a.week)
    .slice(0, 3);
  const dashboardTopRows = dashboardStandingRows.slice(0, 3);
  const dashboardIdentity =
    account?.displayName || account?.username || account?.email?.split("@")[0] || "Player";

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
        setReceiptRefreshToken((value) => value + 1);
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
    const game = games.find((candidate) => candidate.id === gameId);
    const pool = pools.find((candidate) => candidate.id === pickemEntry.poolId);
    if (
      !game ||
      game.status !== "SCHEDULED" ||
      pickemLockTime(
        game,
        games.filter((candidate) => candidate.week === game.week),
        pool?.deadlineMode,
      ) <= nowMs
    ) {
      setNotice("That game is locked and its pick can no longer be changed.");
      return;
    }
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
      if (r.ok) {
        setReceiptRefreshToken((value) => value + 1);
        return;
      }
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
    if (pool.type === "PLAYOFF_FANTASY") {
      window.location.href = `/fantasy?pool=${encodeURIComponent(pool.id)}`;
      return;
    }
    const entry = entries.find((e) => e.poolId === pool.id);
    if (entry) setActiveEntry(entry.id);
    setSelectedPoolId(pool.id);
    setPickWeek(currentWeek);
    setPendingSurvivor(null);
    if (pool.type === "SURVIVOR") setPickMode("survivor");
    if (pool.type === "PICKEM") setPickMode("pickem");
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
        <a className="homeBrand" href="/" aria-label="Sports Syndicate Fantasy home">
          <div className="brand homeBrandTitle">
            <span className="brandSports">SPORTS</span>{" "}
            <span className="brandSyndicate">SYNDICATE</span>
          </div>
          <div className="subbrand">FANTASY</div>
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
              onClick={() => {
                if (!supabaseConfigured || account?.isCommissioner)
                  setRole("COMMISSIONER");
                else window.location.href = "/beta";
              }}
              title={
                account && !account.isCommissioner
                  ? "Enable Commissioner Mode to run your own leagues"
                  : undefined
              }
            >
              {account && !account.isCommissioner
                ? "Become Commissioner"
                : "Commissioner"}
            </button>
          </div>
        </div>
      </header>

      {tab === "home" && (
        <section className="stack smartDashboard">
          <div className="dashboardWelcome">
            <div>
              <span className="eyebrow">
                {role === "COMMISSIONER" ? "COMMISSIONER CONTROL ROOM" : signedOut ? "YOUR SPORTS POOL HUB" : `WEEK ${currentWeek}`}
              </span>
              <h1>
                {role === "COMMISSIONER"
                  ? "Everything under control."
                  : signedOut ? "Welcome to Sports Syndicate Fantasy." : `Welcome back, ${dashboardIdentity}.`}
              </h1>
              <p>
                {role === "COMMISSIONER"
                  ? "Manage leagues, entries, deadlines and live prize draws."
                  : "Your next move, standings and prizes are ready below."}
              </p>
            </div>
            {signedOut ? null : <div className="weekBadge">
              <small>CURRENT</small>
              <strong>{currentWeek}</strong>
              <span>WEEK</span>
            </div>}
          </div>

          {role === "PLAYER" ? (
            <>
              {loading ? (
                <div className="actionCard loadingAction">
                  <span className="actionIcon">•••</span>
                  <div>
                    <span className="actionLabel">LOADING YOUR DASHBOARD</span>
                    <strong>Checking your picks and deadlines…</strong>
                  </div>
                </div>
              ) : signedOut ? (
                <div className="actionCard signInAction">
                  <span className="actionIcon">→</span>
                  <div>
                    <span className="actionLabel">YOUR PRIVATE DASHBOARD</span>
                    <strong>Sign in to see your leagues and required picks.</strong>
                    <small>Your pools remain private to your account.</small>
                  </div>
                  <a className="dashboardPrimary" href="/auth/login">Sign In</a>
                </div>
              ) : primaryTask ? (
                <div className={`actionCard ${primaryTask.deadlineMs ? "urgent" : "overdue"}`}>
                  <span className="actionIcon">!</span>
                  <div className="actionCopy">
                    <span className="actionLabel">NEXT REQUIRED ACTION</span>
                    <strong>
                      {primaryTask.kind === "SURVIVOR"
                        ? `Make your Week ${currentWeek} Survivor pick`
                        : primaryTask.kind === "PICKEM"
                          ? `Finish ${primaryTask.missing} Pick’em selection${primaryTask.missing === 1 ? "" : "s"}`
                          : `Fill ${primaryTask.missing} playoff fantasy roster spot${primaryTask.missing === 1 ? "" : "s"}`}
                    </strong>
                    <small>{primaryTask.pool.name} · {primaryTask.entry.entryName}</small>
                    <div className="deadlineLine">
                      <b>{countdown(primaryTask.deadlineMs, nowMs)}</b>
                      {primaryTask.deadlineMs && <span>{when(new Date(primaryTask.deadlineMs).toISOString())}</span>}
                    </div>
                  </div>
                  <button className="dashboardPrimary" onClick={() => openPoolPicks(primaryTask.pool)}>
                    Make Your Pick
                  </button>
                </div>
              ) : entries.length ? (
                <div className="actionCard completeAction">
                  <span className="actionIcon">✓</span>
                  <div>
                    <span className="actionLabel">ALL CAUGHT UP</span>
                    <strong>Your current picks are submitted.</strong>
                    <small>We’ll show your next required action here.</small>
                  </div>
                  <button className="dashboardSecondary" onClick={() => setTab("pools")}>Review Picks</button>
                </div>
              ) : (
                <div className="actionCard joinAction">
                  <span className="actionIcon">＋</span>
                  <div>
                    <span className="actionLabel">GET STARTED</span>
                    <strong>Join your first league.</strong>
                    <small>Use the invitation code from your commissioner.</small>
                  </div>
                  <a className="dashboardPrimary" href="/join">Join League</a>
                </div>
              )}

              <div className="dashboardStats" aria-label="Your weekly overview">
                <div>
                  <span>Needs action</span>
                  <strong className={dashboardTasks.length ? "dangerText" : "successText"}>{dashboardTasks.length}</strong>
                </div>
                <div>
                  <span>Active entries</span>
                  <strong>{entries.filter((entry) => entry.status === "ACTIVE").length}</strong>
                </div>
                <div>
                  <span>Your leagues</span>
                  <strong>{pools.length}</strong>
                </div>
              </div>

              <div className="dashboardGrid">
                <article className="dashboardPanel standingsPanel">
                  <div className="dashboardPanelHeader">
                    <div>
                      <span className="panelKicker">STANDINGS</span>
                      <h2>{dashboardStandingPool?.name || "Your leaderboard"}</h2>
                    </div>
                    {dashboardStandingPool && (
                      <button
                        onClick={() => {
                          setLeaderboardType(dashboardStandingPool.type as LeaderboardType);
                          setLeaderboardPoolId(dashboardStandingPool.id);
                          setLeaderboardWeek(
                            dashboardStandingPool.type === "PICKEM" ? currentWeek : null,
                          );
                          setTab("leaderboard");
                        }}
                      >
                        View All
                      </button>
                    )}
                  </div>
                  {dashboardTopRows.length ? (
                    <div className="standingPreview">
                      {dashboardTopRows.map((row) => (
                        <div key={row.entryId}>
                          <b>{row.rank}</b>
                          <span>{row.name}</span>
                          <small>{row.detail}</small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="dashboardEmpty">Standings will appear after results are graded.</p>
                  )}
                </article>

                <article className="dashboardPanel prizePreview">
                  <div className="dashboardPanelHeader">
                    <div>
                      <span className="panelKicker">NEXT PRIZE DRAW</span>
                      <h2>{upcomingPrize?.title || "No draw scheduled"}</h2>
                    </div>
                    <a href="/prizes">View Prizes</a>
                  </div>
                  {upcomingPrize ? (
                    <>
                      <div className="prizeDateBadge">
                        <strong>{upcomingPrize.week ? `WEEK ${upcomingPrize.week}` : "UPCOMING"}</strong>
                        <span>
                          {upcomingPrize.scheduled_draw_at
                            ? when(upcomingPrize.scheduled_draw_at)
                            : "Date to be announced"}
                        </span>
                      </div>
                      <p>
                        {pools.find((pool) => pool.id === upcomingPrize.pool_id)?.name || "Your league"}
                      </p>
                    </>
                  ) : (
                    <p className="dashboardEmpty">Your commissioner’s next prize will appear here.</p>
                  )}
                </article>
              </div>

              <div className="dashboardGrid lowerDashboardGrid">
                <article className="dashboardPanel">
                  <div className="dashboardPanelHeader">
                    <div>
                      <span className="panelKicker">RECENT RESULTS</span>
                      <h2>Your Survivor picks</h2>
                    </div>
                  </div>
                  {recentSurvivorResults.length ? (
                    <div className="resultPreview">
                      {recentSurvivorResults.map((pick) => {
                        const entry = entries.find((candidate) => candidate.id === pick.entryId);
                        return (
                          <div key={`${pick.entryId}-${pick.week}`}>
                            <span>W{pick.week}</span>
                            <strong>{pick.teamName}</strong>
                            <small>{entry?.entryName}</small>
                            <b className={`result${pick.result || "PENDING"}`}>{pick.result || "PENDING"}</b>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="dashboardEmpty">Your completed picks will appear here.</p>
                  )}
                </article>

                <article className="dashboardPanel updatePanel">
                  <span className="panelKicker">LEAGUE UPDATE</span>
                  <h2>{signedOut ? "Your leagues start here" : `Week ${currentWeek} is open`}</h2>
                  <p>{signedOut ? "Sign in to view your leagues, deadlines and submitted picks." : "Submit selections early. Games lock according to your league’s deadline settings."}</p>
                  <button onClick={() => {
                    if (signedOut) window.location.href = "/auth/login?reason=required";
                    else setTab("pools");
                  }}>{signedOut ? "Sign In to Continue" : "Open My Pools"}</button>
                </article>
              </div>
            </>
          ) : (
            <>
              <div className="dashboardStats commissionerStats">
                <div><span>Managed leagues</span><strong>{manageablePoolIds.length}</strong></div>
                <div><span>Total entries</span><strong>{entries.length}</strong></div>
                <div><span>Current week</span><strong>{currentWeek}</strong></div>
              </div>
              <article className="dashboardPanel commissionerPanel">
                <div className="dashboardPanelHeader">
                  <div>
                    <span className="panelKicker">YOUR LEAGUES</span>
                    <h2>Commissioner overview</h2>
                  </div>
                  <a href="/leagues/new">Create League</a>
                </div>
                <div className="commissionerLeagueList">
                  {pools.filter((pool) => manageablePoolIds.includes(pool.id)).slice(0, 4).map((pool) => (
                    <a href={`/leagues/${pool.id}`} key={pool.id}>
                      <span><strong>{pool.name}</strong><small>{pool.type.replaceAll("_", " ")} · {pool.season}</small></span>
                      <b>Manage →</b>
                    </a>
                  ))}
                  {!manageablePoolIds.length && (
                    <p className="dashboardEmpty">Create a league to start your commissioner dashboard.</p>
                  )}
                </div>
              </article>
            </>
          )}

          <nav className="homeQuickActions" aria-label="Quick actions">
            {role === "COMMISSIONER" ? (
              <>
                <a href="/leagues/new"><span>＋</span><strong>Create League</strong><small>Start a new pool</small></a>
                <a href="/prizes?mode=commissioner"><span>◇</span><strong>Prize Centre</strong><small>Manage prizes and draws</small></a>
                <a href="/live?host=1"><span>●</span><strong>Go Live</strong><small>Broadcast a prize draw</small></a>
                <a href="/join"><span>→</span><strong>Join League</strong><small>Enter an invitation code</small></a>
              </>
            ) : (
              <>
                <a href="/join"><span>＋</span><strong>Join League</strong><small>Enter your invitation code</small></a>
                <a href="/live?viewer=1"><span>●</span><strong>Watch Live</strong><small>Join a prize draw</small></a>
                <a href="/prizes"><span>◇</span><strong>Prize Centre</strong><small>Draws and winners</small></a>
                <a href={account ? "/account" : "/auth/login"}><span>○</span><strong>My Account</strong><small>{account ? account.username ? `@${account.username}` : account.email : "Sign in or create account"}</small></a>
              </>
            )}
          </nav>
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
                      {role === "COMMISSIONER" && manageablePoolIds.includes(pool.id) && (
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
          <PickReceipts
            entryId={pickMode === "survivor" ? activeSurvivor?.id : pickemEntry?.id}
            refreshToken={receiptRefreshToken}
          />
          {(pickMode === "survivor" || pickMode === "pickem") && (
            <div className="weekPicker">
              <label htmlFor="pool-week-select">Select week</label>
              <select
                id="pool-week-select"
                value={pickWeek}
                onChange={(event) => {
                  const week = Number(event.target.value);
                  setPickWeek(week);
                  setPendingSurvivor(null);
                  setPickemSubmitted(false);
                  setNotice(null);
                }}
              >
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
                  const currentLabel = week === currentWeek ? " — Current" : "";
                  return (
                    <option key={week} value={week}>
                      Week {week}{currentLabel} — {status}
                    </option>
                  );
                })}
              </select>
            </div>
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
                      {g.awayWinProbability !== undefined && <em className="marketProbability">Market {Math.round(g.awayWinProbability*100)}%</em>}
                      {g.status !== "SCHEDULED" && g.awayScore !== undefined && <strong>{g.awayScore}</strong>}
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
                      {g.homeWinProbability !== undefined && <em className="marketProbability">Market {Math.round(g.homeWinProbability*100)}%</em>}
                      {g.status !== "SCHEDULED" && g.homeScore !== undefined && <strong>{g.homeScore}</strong>}
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
                const locked =
                  g.status !== "SCHEDULED" ||
                  pickemLockTime(
                    g,
                    pickWeekGames,
                    activePoolForPicks?.deadlineMode,
                  ) <= nowMs;
                return (
                  <div
                    className={locked ? "pickemGame locked" : "pickemGame"}
                    key={g.id}
                  >
                    <div>
                      <strong>
                        {g.awayCode} @ {g.homeCode}
                      </strong>
                      <span>{when(g.kickoff)}</span>
                      <small>
                        {g.status === "FINAL"
                          ? `FINAL · ${g.awayScore ?? 0}–${g.homeScore ?? 0}`
                          : g.status === "LIVE"
                            ? `LIVE · ${g.awayScore ?? 0}–${g.homeScore ?? 0}`
                            : locked
                              ? "LOCKED"
                              : "OPEN"}
                      </small>
                    </div>
                    <div className="pickButtons">
                      <button
                        className={sel?.teamCode === g.awayCode ? "chosen" : ""}
                        disabled={locked || pickemEntry?.status !== "ACTIVE"}
                        onClick={() => togglePickem(g.id, g.awayCode)}
                      >
                        <b>{g.awayCode}</b>
                        {g.awayWinProbability !== undefined && <small>Market {Math.round(g.awayWinProbability*100)}%</small>}
                      </button>
                      <button
                        className={sel?.teamCode === g.homeCode ? "chosen" : ""}
                        disabled={locked || pickemEntry?.status !== "ACTIVE"}
                        onClick={() => togglePickem(g.id, g.homeCode)}
                      >
                        <b>{g.homeCode}</b>
                        {g.homeWinProbability !== undefined && <small>Market {Math.round(g.homeWinProbability*100)}%</small>}
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
                  setLeaderboardWeek(null);
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
          {leaderboardType === "PICKEM" && leaderboardPools.length > 0 && (
            <div
              className="leaderboardPeriodPicker"
              aria-label="Choose Pick'em standings period"
            >
              <button
                type="button"
                className="periodArrow"
                aria-label="Previous standings period"
                disabled={leaderboardWeek === null}
                onClick={() => {
                  setLeaderboardWeek(
                    leaderboardWeek === 1
                      ? null
                      : Math.max(1, (leaderboardWeek ?? 1) - 1),
                  );
                  setLeaderboardRows([]);
                }}
              >
                ‹
              </button>
              <label>
                <small>STANDINGS PERIOD</small>
                <select
                  value={leaderboardWeek ?? 0}
                  onChange={(event) => {
                    const selected = Number(event.target.value);
                    setLeaderboardWeek(selected === 0 ? null : selected);
                    setLeaderboardRows([]);
                  }}
                >
                  <option value={0}>Season Total</option>
                  {Array.from({ length: 18 }, (_, index) => index + 1).map(
                    (week) => (
                      <option key={week} value={week}>
                        Week {week}{week === currentWeek ? " — Current" : ""}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <button
                type="button"
                className="periodArrow"
                aria-label="Next standings period"
                disabled={leaderboardWeek === 18}
                onClick={() => {
                  setLeaderboardWeek(
                    leaderboardWeek === null ? 1 : leaderboardWeek + 1,
                  );
                  setLeaderboardRows([]);
                }}
              >
                ›
              </button>
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
          ) : visibleLeaderboard.length && leaderboardType === "SURVIVOR" ? (
            <>
              <div className="survivorLegend" aria-label="Survivor result colours">
                <span><i className="advanced" />Advanced</span>
                <span><i className="eliminated" />Eliminated</span>
                <span><i className="pending" />Pending</span>
              </div>
              <div className="survivorGridWrap">
                <div className="survivorGrid survivorGridHeader">
                  <div className="survivorEntryHeader">
                    <b>#</b>
                    <span>Entry</span>
                  </div>
                  {Array.from({ length: 18 }, (_, index) => (
                    <div key={index}>W{index + 1}</div>
                  ))}
                </div>
                {visibleLeaderboard.map((row) => {
                  const picksByWeek = new Map(
                    (row.picks || []).map((pick) => [pick.week, pick]),
                  );
                  return (
                    <div className="survivorGrid survivorGridRow" key={row.entryId}>
                      <div className="survivorEntryCell">
                        <b>#{row.rank}</b>
                        <span>
                          <strong>{row.name}</strong>
                          <small className={row.alive ? "alive" : "out"}>
                            {row.status}
                          </small>
                        </span>
                      </div>
                      {Array.from({ length: 18 }, (_, index) => {
                        const week = index + 1;
                        const pick = picksByWeek.get(week);
                        const resultClass =
                          pick?.result === "WIN"
                            ? "advanced"
                            : pick?.result === "LOSS"
                              ? "eliminated"
                              : pick?.teamCode
                                ? "pending"
                                : "empty";
                        return (
                          <div
                            className={`survivorWeekCell ${resultClass}`}
                            key={week}
                            title={
                              pick && !pick.locked
                                ? "Pick hidden until the game locks"
                                : pick?.teamCode || `No Week ${week} pick`
                            }
                          >
                            {pick && !pick.locked ? "HIDDEN" : pick?.teamCode || "—"}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
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
                <a href="/leagues/new">Create League</a>
                <a href="/prizes?mode=commissioner">Prize Centre</a>
                <a href="/live?host=1">Go Live</a>
              </div>
              <h2>Manage Your Leagues</h2>
              {manageablePoolIds.length === 0 ? (
                <div className="wideCard poolEmptyState">
                  <strong>You have not created a league yet</strong>
                  <span>Create your first league to invite players and add prizes.</span>
                  <a className="primary" href="/leagues/new">Create League</a>
                </div>
              ) : (
                <div className="poolHubList">
                  {pools
                    .filter((pool) => manageablePoolIds.includes(pool.id))
                    .map((pool) => (
                      <article className="poolHubCard" key={pool.id}>
                        <div className="poolHubTop">
                          <div className="grow">
                            <strong>{pool.name}</strong>
                            <span>{pool.season} · {pool.type.replaceAll("_", " ")}</span>
                          </div>
                        </div>
                        <div className="poolHubActions">
                          <a className="primary" href={`/leagues/${pool.id}`}>League Settings</a>
                          <a className="secondary poolSecondary" href={`/prizes?mode=commissioner&pool=${pool.id}`}>Manage Prizes</a>
                        </div>
                      </article>
                    ))}
                </div>
              )}
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
