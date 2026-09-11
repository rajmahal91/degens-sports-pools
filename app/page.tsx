"use client";

import { useEffect, useMemo, useState } from "react";
import {
  demoPayments,
  entries as seedEntries,
  leaderboard,
  pools as seedPools,
  week1Games as seedWeek1Games,
} from "@/lib/mock";
import type {
  Entry,
  FantasySlot,
  PaymentMethod,
  PaymentRecord,
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
const money = (cents: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(
    cents / 100,
  );
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

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
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [signedOut, setSignedOut] = useState(false);
  const [entries, setEntries] = useState<Entry[]>(
    supabaseConfigured ? [] : seedEntries,
  );
  const [payments, setPayments] = useState<PaymentRecord[]>(
    supabaseConfigured ? [] : demoPayments,
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
  const [paymentPool, setPaymentPool] = useState<Pool | null>(null);
  const [paymentEntry, setPaymentEntry] = useState<Entry | null>(null);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("ETRANSFER");
  const [reference, setReference] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
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
          setPayments([]);
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
          entryFeeCents: p.entry_fee_cents,
          registrationClosesAt: p.registration_closes_at || undefined,
        }));
        const mappedEntries: Entry[] = (b.entries || []).map((e: any) => ({
          id: e.id,
          poolId: e.pool_id,
          userId: e.user_id,
          entryName: e.entry_name,
          status: e.status || e.entry_status,
          paymentStatus: e.payment_status,
        }));
        const poolNames = new Map(mappedPools.map((p) => [p.id, p.name]));
        const entryNames = new Map(
          mappedEntries.map((e) => [e.id, e.entryName]),
        );
        const mappedPayments: PaymentRecord[] = (b.payments || []).map(
          (p: any) => {
            const poolId =
              p.pool_id ||
              mappedEntries.find((e) => e.id === p.entry_id)?.poolId ||
              "";
            return {
              id: p.id,
              poolId,
              poolName: poolNames.get(poolId) || "Pool",
              entryId: p.entry_id || undefined,
              entryName: entryNames.get(p.entry_id) || undefined,
              amountCents: p.amount_cents,
              method: p.method,
              status: p.status,
              reference: p.payer_reference || p.reference || undefined,
              createdAt: p.created_at || p.submitted_at,
            };
          },
        );
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
        setPayments(mappedPayments);
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
        setPayments([]);
        setAccount(null);
        setNotice(
          "Your pool data could not be loaded. Please refresh the page.",
        );
      })
      .finally(() => setLoading(false));
  }, [supabaseConfigured]);

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
  const pendingPayments = payments.filter((p) => p.status === "PENDING");
  const paidTotal = payments
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + p.amountCents, 0);
  const outstanding = entries.filter(
    (e) =>
      e.paymentStatus === "UNPAID" &&
      pools.find((p) => p.id === e.poolId)?.entryFeeCents,
  ).length;
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
  const visibleLeaderboard = supabaseConfigured ? [] : leaderboard;

  function poolStatus(pool: Pool) {
    const mine = entries.filter((e) => e.poolId === pool.id);
    if (pool.entryFeeCents === 0) return "PAID";
    if (mine.some((e) => e.paymentStatus === "PAID")) return "PAID";
    if (mine.some((e) => e.paymentStatus === "PENDING")) return "PENDING";
    return "UNPAID";
  }
  function selectSurvivor(gameId: string, teamCode: string, teamName: string) {
    if (!activeSurvivor || activeSurvivor.paymentStatus !== "PAID") return;
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
  function openPayment(pool: Pool, entry?: Entry) {
    setPaymentPool(pool);
    setPaymentEntry(entry || entries.find((e) => e.poolId === pool.id) || null);
    setPaymentMethod("ETRANSFER");
    setReference("");
    setNotice(null);
  }
  async function submitPayment() {
    if (!paymentPool || !paymentEntry) return;
    if (paymentMethod === "CARD") {
      setNotice(
        "Card checkout remains disabled until a processor explicitly approves this pool model.",
      );
      return;
    }
    if (paymentMethod === "ETRANSFER" && reference.trim().length < 3) {
      setNotice("Enter the e-transfer confirmation/reference.");
      return;
    }
    let persistedPaymentId: string | undefined;
    if (connected) {
      const r = await fetch("/api/payments/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          poolId: paymentPool.id,
          entryId: paymentEntry.id,
          method: paymentMethod,
          reference: reference.trim(),
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setNotice(j.error || "Payment submission failed");
        return;
      }
      persistedPaymentId = j.payment?.id;
    }
    const rec: PaymentRecord = {
      id: persistedPaymentId || crypto.randomUUID(),
      poolId: paymentPool.id,
      poolName: paymentPool.name,
      entryId: paymentEntry.id,
      entryName: paymentEntry.entryName,
      amountCents: paymentPool.entryFeeCents,
      method: paymentMethod,
      status: "PENDING",
      reference: reference.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    setPayments((prev) => [rec, ...prev]);
    setEntries((prev) =>
      prev.map((e) =>
        e.id === paymentEntry.id ? { ...e, paymentStatus: "PENDING" } : e,
      ),
    );
    setNotice("Payment submitted. Commissioner verification is now pending.");
  }
  async function verifyPayment(id: string) {
    const p = payments.find((x) => x.id === id);
    if (!p) return;
    if (connected) {
      const r = await fetch("/api/admin/payments/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentId: id }),
      });
      if (!r.ok) {
        const j = await r.json();
        setNotice(j.error || "Verification failed");
        return;
      }
    }
    setPayments((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status: "PAID" } : x)),
    );
    if (p.entryId)
      setEntries((prev) =>
        prev.map((e) =>
          e.id === p.entryId ? { ...e, paymentStatus: "PAID" } : e,
        ),
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
          <button
            className="roleToggle"
            onClick={() =>
              setRole(role === "PLAYER" ? "COMMISSIONER" : "PLAYER")
            }
          >
            {role === "PLAYER" ? "Commissioner" : "Player View"}
          </button>
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
                ? "Payments, entries, picks, deadlines and prize draws."
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
                  <b>{outstanding}</b>
                  <span>Fees due</span>
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
                <b>{pendingPayments.length}</b>
                <span>Payments pending</span>
              </div>
              <div>
                <b>{money(paidTotal)}</b>
                <span>Verified</span>
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
            Choose a pool to make picks, manage your entries, or check payment
            status.
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
                const firstUnpaid = poolEntries.find(
                  (entry) => entry.paymentStatus === "UNPAID",
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
                      {poolEntries.length > 0 && (
                        <span
                          className={`pill ${poolStatus(pool).toLowerCase()}`}
                        >
                          {poolStatus(pool)}
                        </span>
                      )}
                    </div>
                    <div className="poolHubMeta">
                      <div>
                        <span>Entries</span>
                        <b>{poolEntries.length}</b>
                      </div>
                      <div>
                        <span>Entry fee</span>
                        <b>
                          {pool.entryFeeCents
                            ? money(pool.entryFeeCents)
                            : "Free"}
                        </b>
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
                      {firstUnpaid && pool.entryFeeCents > 0 && (
                        <button
                          className="secondary poolSecondary"
                          onClick={() => openPayment(pool, firstUnpaid)}
                        >
                          Pay Entry Fee
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
                    {poolEntries.some(
                      (entry) => entry.paymentStatus === "PENDING",
                    ) && (
                      <div className="pendingNote">
                        Payment submitted — awaiting commissioner verification.
                      </div>
                    )}
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
                    <small>{e.paymentStatus}</small>
                  </button>
                ))}
              </div>
              {activeSurvivor?.paymentStatus !== "PAID" && (
                <div className="warning">
                  This entry must be paid before a pick can be submitted.
                </div>
              )}
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
                  <div className="gameTime">{when(g.kickoff)}</div>
                  <div className="matchup">
                    <button
                      disabled={
                        activeSurvivor?.paymentStatus !== "PAID" ||
                        usedSurvivorTeams.has(g.awayCode)
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
                    </button>
                    <span className="at">@</span>
                    <button
                      disabled={
                        activeSurvivor?.paymentStatus !== "PAID" ||
                        usedSurvivorTeams.has(g.homeCode)
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
            <button className="selected">Survivor</button>
            <button>Pick’em</button>
            <button>Fantasy</button>
          </div>
          {visibleLeaderboard.length ? (
            visibleLeaderboard.map((row) => (
              <div className="leaderRow" key={row.name}>
                <b>#{row.rank}</b>
                <div>
                  <strong>{row.name}</strong>
                  <span>{row.alive ? "Alive" : "Eliminated"}</span>
                </div>
                <span className="alive">●</span>
              </div>
            ))
          ) : (
            <div className="wideCard">
              <span>Select one of your leagues to view its standings.</span>
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
                  <b>{pendingPayments.length}</b>
                  <span>Pending</span>
                </div>
                <div>
                  <b>{money(paidTotal)}</b>
                  <span>Collected</span>
                </div>
              </div>
              <h2>Payment Verification</h2>
              {pendingPayments.length === 0 ? (
                <div className="wideCard">
                  <span>No payments awaiting verification.</span>
                </div>
              ) : (
                pendingPayments.map((p) => (
                  <div className="adminPayment" key={p.id}>
                    <div>
                      <strong>{p.entryName}</strong>
                      <span>
                        {p.poolName} · {p.method}
                      </span>
                      <small>Ref: {p.reference || "—"}</small>
                    </div>
                    <div>
                      <b>{money(p.amountCents)}</b>
                      <button
                        className="verify"
                        onClick={() => verifyPayment(p.id)}
                      >
                        Verify Paid
                      </button>
                    </div>
                  </div>
                ))
              )}
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

      {paymentPool && paymentEntry && (
        <div className="sheet">
          <div className="sheetInner paymentSheet">
            <div className="grabber" />
            <div className="sectionHeader">
              <div>
                <span className="eyebrow">ENTRY PAYMENT</span>
                <h2>{paymentEntry.entryName}</h2>
              </div>
              <button className="close" onClick={() => setPaymentPool(null)}>
                ×
              </button>
            </div>
            <div className="paymentTotal">
              <span>{paymentPool.name}</span>
              <strong>{money(paymentPool.entryFeeCents)}</strong>
            </div>
            <label className="fieldLabel">Payment method</label>
            <div className="methodGrid">
              {(["ETRANSFER", "CARD", "CASH"] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  className={
                    paymentMethod === m ? "method activeMethod" : "method"
                  }
                  onClick={() => {
                    setPaymentMethod(m);
                    setNotice(null);
                  }}
                >
                  <b>
                    {m === "ETRANSFER"
                      ? "Interac e-Transfer"
                      : m === "CARD"
                        ? "Credit / Debit Card"
                        : "Cash"}
                  </b>
                </button>
              ))}
            </div>
            {paymentMethod === "ETRANSFER" && (
              <div className="methodPanel">
                <strong>
                  Send your e-transfer, then enter the confirmation
                </strong>
                <input
                  className="textInput"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Confirmation number"
                />
              </div>
            )}
            {paymentMethod === "CARD" && (
              <div className="methodPanel">
                <strong>Hosted checkout adapter</strong>
                <p>Enabled only after an approved processor is configured.</p>
              </div>
            )}
            {notice && <div className="notice">{notice}</div>}
            <button className="primary" onClick={submitPayment}>
              {paymentMethod === "CARD"
                ? "Continue to Checkout"
                : "Submit Payment"}
            </button>
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
