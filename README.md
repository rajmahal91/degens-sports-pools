# Degens Sports Pools v0.7

A mobile-first multi-sport pool platform for NFL Survivor, NFL Pick'em, NFL Playoff Fantasy, NHL/NBA playoff brackets, entry-fee tracking, prizes, verified random draws, and in-app live broadcasts.

## v0.7 beta launch additions

- `/beta` launchpad provisions sample Survivor, Pick’em, and NFL Playoff Fantasy entries for the signed-in tester.
- Paid sample contests intentionally begin **UNPAID** so the full e-transfer/cash submission -> commissioner verification -> pick eligibility flow can be tested.
- Optional `BETA_COMMISSIONER_CODE` promotes only the authenticated tester who knows the server-side code.
- `/api/health` provides a simple deployment/health check.
- `supabase/beta_seed.sql` adds a safe sample NFL slate, NHL/NBA bracket pools, and a sample prize draw.
- `vercel.json` is included for one-click Vercel framework detection.
- `npm run typecheck` and `npm run check` scripts are included for deployment validation.

### Fast beta launch

1. Create Supabase and run `supabase/schema.sql`, `supabase/seed.sql`, then `supabase/beta_seed.sql`.
2. Copy `.env.example` values into Vercel Project Settings -> Environment Variables.
3. Set a private `BETA_COMMISSIONER_CODE` known only to you.
4. Deploy to Vercel.
5. Visit `/api/health` and confirm `ok: true`.
6. Create your account at `/auth/sign-up`, sign in, then visit `/beta`.
7. Click **Create My Beta Entries**.
8. Enter your commissioner code and click **Enable Commissioner Access**.
9. Test an unpaid entry: submit payment -> verify as commissioner -> make a pick.
10. Test Prize Centre -> Live Draw, then verify the persisted draw record.


## v0.6 foundation carried forward

- **NFL Playoff Fantasy picker** at `/fantasy`
  - QB / RB / RB / WR / WR / TE each playoff round
  - one-use-per-player enforced at the database level for each entry
  - eligible roster filtered to teams playing in the selected postseason round
  - SportsDataIO roster sync endpoint plus demo roster fallback
  - half-PPR scoring updated automatically by the NFL grader
- **NHL + NBA four-round bracket engine** at `/brackets`
  - 8 first-round series -> 4 second-round -> 2 conference finals -> championship
  - predicted winners automatically populate the player's next round
  - commissioner bracket-result endpoint advances the actual winner and grades picks
  - default scoring: 1 / 2 / 4 / 8 by round + 1 bonus for exact series length
- **Prize eligibility from real entries**
  - default eligibility is PAID entries from the prize's pool
  - optional `prizes.eligibility.entry_status` can require ACTIVE entries when desired
  - Prize Centre shows each user's eligible entries without exposing other players' private payment data
- **Persisted verified prize draws**
  - cryptographic 32-byte randomness
  - immutable eligible-entry snapshot
  - winner entry, random value, draw timestamp, and SHA-256 verification hash saved to Supabase
  - public verification endpoint: `/api/draws/verify?id=<DRAW_ID>`
- **LiveKit broadcast wiring**
  - in-app camera, microphone, screen sharing, chat, and viewer room
  - only commissioner accounts can receive a publish token
  - normal players receive subscribe-only tokens
- **Provider-agnostic architecture** remains intact
  - SportsDataIO + demo NFL adapters
  - LiveKit is optional; app still runs without credentials

## Stack

- Next.js 16 / React 19
- Supabase Auth + Postgres + RLS
- SportsDataIO NFL provider adapter
- LiveKit React Components + server SDK
- server-side CSPRNG draw engine

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Run `supabase/seed.sql` for the starter NFL pools/rounds.
4. Copy `.env.example` to `.env.local`.
5. Fill in Supabase credentials.
6. Keep `SPORTS_PROVIDER=demo` until a SportsDataIO key is available, or switch to `sportsdataio`.
7. Add a long random `CRON_SECRET`.
8. For live broadcasting, create a LiveKit project and set `LIVEKIT_URL`, `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`.
9. Install dependencies: `npm install`.
10. Run `npm run build`, then `npm run dev` or deploy to Vercel.

## NFL sync + grading

All admin automation calls use:

`Authorization: Bearer <CRON_SECRET>`

### Sync NFL games

`POST /api/admin/sync-nfl`

```json
{ "season": "2026", "week": 1, "seasonType": "REG" }
```

For playoff rounds use `seasonType: "POST"` and weeks 1-4.

### Sync NFL player roster

`POST /api/admin/sync-nfl-players`

The SportsDataIO adapter defaults to `/scores/json/Players`. Override with `SPORTSDATAIO_PLAYERS_PATH` if your subscription exposes a different player-profile resource.

### Grade NFL contests

`POST /api/admin/grade-nfl`

```json
{ "season": "2026", "week": 1, "seasonType": "POST" }
```

This updates final game scores, Pick'em correctness, Survivor eliminations, and playoff-fantasy points.

## Bracket administration

### Create a 16-team bracket topology

`POST /api/admin/brackets/create`

Commissioner-authenticated request body:

```json
{
  "poolId": "<BRACKET_POOL_UUID>",
  "sport": "NHL",
  "teams": [
    {"code":"TEAM1","seed":1,"conference":"West"},
    {"code":"TEAM2","seed":8,"conference":"West"}
  ]
}
```

Supply exactly 16 teams in first-round matchup order. The endpoint creates all 15 linked matchups.

### Record/grade a completed series

`POST /api/admin/brackets/results`

```json
{ "matchupId": "<MATCHUP_ID>", "winnerCode": "TEAM1", "seriesGames": 6 }
```

The endpoint grades every pick for that matchup and automatically moves the real winner into its next-round slot.

## Prize eligibility and draws

A prize normally uses:

```json
{ "payment_status": "PAID" }
```

in `prizes.eligibility`. To restrict a specific draw to currently alive/active entries:

```json
{ "payment_status": "PAID", "entry_status": "ACTIVE" }
```

The commissioner draw room is `/live`. In connected mode, selecting a prize causes the server to calculate eligible entries itself; the client cannot inject or alter the connected eligible list.

## LiveKit permissions

`POST /api/livekit/token` issues a room token. The API ignores client trust for publishing: `asHost=true` requires a real commissioner account. Viewers can join and subscribe but cannot publish camera/mic/data.

## Payment note

The app tracks Interac e-Transfer and cash submissions and commissioner verification. The card checkout layer intentionally remains provider-agnostic because many mainstream processors restrict paid fantasy pools/contests with prizes. Use only a processor that has explicitly approved your exact contest model. Never store raw card numbers, CVV, or banking credentials.

## Production checklist

- Run a real `npm install && npm run build` in the deployment environment.
- Configure Supabase backups and production RLS review.
- Add rate limiting to auth, picks, payments, draw, sync, and grading endpoints.
- Schedule NFL sync/grading through a trusted cron service.
- Add idempotency keys/job logs for cron retries.
- Configure actual NHL/NBA bracket pools and team fields before opening registration.
- Test LiveKit host/viewer behavior on desktop and mobile.
- Add privacy policy, contest rules, refund terms, and jurisdiction/payment compliance review before accepting public paid entries.
