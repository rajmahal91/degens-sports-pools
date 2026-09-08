# NFL Degens Beta — End-to-End Test Plan

## Deployment smoke test
1. `GET /api/health` returns `ok: true` and version `0.7.0`.
2. Create a player account at `/auth/sign-up` and sign in.
3. Open `/beta` and click **Create My Beta Entries**.
4. Confirm dashboard shows Survivor, Pick'em, and Playoff Fantasy entries.

## Payment gate
1. Open the sample Survivor entry: it should begin UNPAID and reject a pick.
2. Submit an e-transfer reference or cash payment.
3. Promote your test account at `/beta` with `BETA_COMMISSIONER_CODE`.
4. Verify the pending payment in commissioner view.
5. Confirm the same entry changes to PAID and can now submit a Survivor pick.

## Picks and locks
1. Submit one Survivor team from the beta Week 1 slate.
2. Change the pick before kickoff; it should succeed.
3. Submit Pick'em choices for all sample games.
4. To test locking quickly, update one sample game's `starts_at` in Supabase to a past timestamp.
5. Confirm further changes for that game/team are rejected server-side.

## Playoff Fantasy
1. Sync real NFL players or use demo provider.
2. Fill QB / RB / RB / WR / WR / TE.
3. Submit the lineup.
4. Attempt to reuse the same athlete in another playoff round; database should reject it.
5. Run grading and confirm fantasy points appear in the leaderboard.

## Prize Centre + Live Draw
1. Verify at least one entry is PAID.
2. Open Prize Centre and confirm eligible-entry count reflects paid entries.
3. Open `/live` as commissioner.
4. Run the sample Beta Signed Jersey draw.
5. Record draw ID and verification hash.
6. Call `/api/draws/verify?id=<DRAW_ID>` and confirm verification succeeds.
7. Join `/live` from a second normal player account and confirm it receives viewer-only permissions.

## Brackets
1. Create NHL/NBA bracket topology with commissioner endpoint.
2. Submit player picks.
3. Record a completed series result.
4. Confirm points are awarded and actual winner advances into the next matchup.

## Release gate
Do not invite real paid users until all items above pass and production privacy/rules/payment-compliance documents are published.
