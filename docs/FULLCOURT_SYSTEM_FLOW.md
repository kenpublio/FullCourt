# FullCourt Complete Three-User System Flow

## User scope

FullCourt has three authenticated user types: Administrator, Coach, and Staff Admin. Players are roster records managed by a Coach and do not create accounts. Visitors and players use the public Game Center and Schedule without signing in.

## 1. Administrator setup

1. Sign in through the Admin portal.
2. Create the tournament, divisions, registration rules, dates, and roster deadline.
3. Add the playable venue and Main Court using the map-assisted venue form.
4. Create or approve teams and associate each team with its Coach.
5. Review tournament readiness, staff coverage, eligibility decisions, and audit history from the dashboard.

## 2. Coach roster preparation

1. Sign in as Coach and open My Team & Roster.
2. Add up to 15 player records. No player login is created.
3. Record each player's birth date, guardian details, jersey number, and position.
4. Upload the Birth Certificate/PSA and Parent Permit.
5. Correct any birth-date mismatch or rejected document shown by the eligibility review.
6. Monitor the published schedule and acknowledge changes.

## 3. Administrator eligibility and competition setup

1. Review submitted documents without editing Coach-owned roster data.
2. Verify or reject eligibility with a reason.
3. Generate the bracket once the required teams are ready.
4. Run Schedule Optimization. FullCourt blocks court overlap, team overlap, unavailable venues, insufficient rest, and excessive games per day.
5. Resolve every conflict, then publish the schedule. Coaches are notified.
6. Assign a Staff Admin to each game.

## 4. Staff Admin game-day flow

1. Accept the assigned game.
2. Confirm player presence and the starting lineups.
3. Record team score through individual +1, +2, and +3 player events.
4. Optionally record rebounds, assists, steals, blocks, turnovers, and fouls.
5. Use Undo for an incorrect latest action. Every event remains attributable in the audit trail.
6. If disconnected, pause scoring and keep the official paper score sheet until the connection returns.
7. Review the final totals and submit the result to Admin. Scoring locks while awaiting confirmation.

## 5. Administrator final-result flow

1. Open the final-score review queue.
2. Compare the submitted score with the official score sheet.
3. Confirm the winner. Ties and stale score snapshots are rejected.
4. FullCourt publishes the result, updates standings, advances the bracket winner, and notifies both Coaches.
5. Reopen or correct a completed result only through authorized Admin procedures with an audit reason.

## 6. Public flow

1. Open Game Center or the public Schedule without an account.
2. View upcoming, live, and completed games.
3. Open tournament details for bracket and standings.
4. Open a game for live score, lineup, box score, venue, and Player of the Game data when available.

## 7. Operational safety

- Run `tools/check_fullcourt_readiness.ps1` before game day.
- Create and verify a fresh backup from Admin Settings.
- Keep the XAMPP fallback machine, paper score sheets, and a second backup copy ready.
- Use Game-Day Control for readiness checks, postponements, cancellations, and incident records.
- Keep PSA, parent permits, exact birth dates, and private contacts off public pages.
- Review audit history after roster changes, score corrections, schedule changes, and final approvals.

## Responsibility boundary

| Area | Administrator | Coach | Staff Admin | Public/player |
|---|---|---|---|---|
| Tournament, bracket, schedule | Manage | View | View assigned games | View published data |
| Team and roster | Team oversight | Add/manage up to 15 players | Lineup use only | No account |
| Eligibility documents | Review/decide | Upload/correct | No access | No access |
| Live scoring | Monitor/final approval | View | Record score and stats | View published/live data |
| Venue/time changes | Manage | Receive notice | See assignment update | View published update |
| Backup/audit | Manage/review | No system backup | No system backup | No access |
