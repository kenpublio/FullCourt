# FullCourt November Game-Day Runbook

## One week before

- Confirm the Admin, every Coach, and every Staff Admin can sign in on the actual devices they will use.
- Finish team rosters, birth-record checks, parent permits, payment balances, bracket, courts, and game times.
- Export the team list, schedule, payment ledger, and eligibility status as offline copies.
- Assign one Staff Admin per active court and one backup Staff Admin.
- Prepare a laptop running XAMPP as the local fallback when internet access becomes unstable.
- In **Settings > System health & verified backup**, create a fresh verified backup and copy it to a second device.
- Run the complete Admin -> Coach -> Staff Admin -> Public rehearsal using a disposable tournament.

## Before the first game

1. Run `tools/check_fullcourt_readiness.ps1`.
2. Open the public Game Center and confirm today's schedule.
3. Open the Staff Admin scoring screen and verify both teams and player rosters.
4. Confirm the public score screen or broadcast overlay on a second device.
5. Record one test basket, verify that the score updates, then void/reset the test before tip-off.
6. Confirm that both Coaches receive a test schedule-change notification.
7. Confirm that the Staff Admin sees only assigned/accepted games and cannot access Admin controls.

## During games

- Use team score and individual player points as the required records.
- Open **More stats** only when rebounds, assists, steals, blocks, turnovers, or fouls are needed.
- When a schedule or venue changes, update it in FullCourt so affected coaches receive the notification.
- Do not share birth records, parent permits, receipts, or exact birth dates on public screens.
- If connectivity fails, keep an official paper score sheet and enter the missing events when service returns.

## After every game

- Confirm the final team score before finalizing.
- Review the points leader suggested for Player of the Game; optional stats are tie-breakers only.
- Check that the result appears in Game Center, the bracket, and standings.
- Photograph or retain the signed paper score sheet as an audit fallback.
- Confirm that both Coaches receive the official-result notification after Admin approval.

## End of day

- Export scores, schedules, standings, payments, and eligibility status.
- Copy the database backup and exports to two separate storage locations.
- Log corrections with the game, old value, new value, reason, person, and time.

## Recovery procedure

1. Stop scoring on all devices and keep the paper score sheet as the temporary source of truth.
2. Record the last confirmed event, period, clock, and team totals.
3. If only the browser lost connection, reconnect and reload the same assigned game. Do not repeatedly tap score actions while offline.
4. If the main server failed, start the prepared XAMPP/local fallback and restore the latest verified backup according to the database administrator procedure.
5. Admin compares the restored scoreboard with the signed paper sheet before reopening scoring.
6. Record the incident and every correction in Game-Day Control and the audit trail.

## Required notification checks

- Schedule publication: affected Coaches receive the published schedule.
- Time, venue, or court change: affected Coaches receive a schedule-change alert.
- Thirty-minute reminder: assigned Coaches and Staff Admin receive one deduplicated reminder.
- Eligibility review: Coach sees the current status of roster documents.
- Final result: both Coaches receive the official score after Admin confirmation.

## Responsibility guide

- **Admin:** tournaments, bracket, schedules, eligibility review, payment review, and final corrections.
- **Coach:** team registration, roster, birth record/PSA, parent permit, payment submission, and schedule awareness.
- **Staff Admin:** live team score, individual points, optional statistics, and final score confirmation.
- **Public/player:** Game Center and public Schedule only; no player account is required.
