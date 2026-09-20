# FullCourt

FullCourt is a basketball operations and tournament management platform for leagues, barangays, schools, and community organizations. It supports isolated organization workspaces, tournament setup, team and player eligibility, officials, schedules, live statistics, score corrections, standings, awards, public portals, analytics, notifications, and PDF reports.

## Main roles

- Platform administrator: reviews organizations and monitors the platform.
- Organization administrator: manages one organization's tournaments and staff.
- Coach or team manager: manages rosters, eligibility, and five-player lineups.
- Official or statistician: accepts assignments and records game activity.
- Player: manages profile documents and views personal analytics.

## Local setup

1. Open phpMyAdmin at `http://localhost/phpmyadmin`.
2. Import `FullCourt_Database.sql`. The file creates and selects the `fullcourt_database` database automatically.
3. Configure database and mail values in `.env`.
4. Start the API with `php -S 127.0.0.1:8767 -t backend`.
5. In `frontend`, run `npm install`, then `npm run dev`.
6. Open the Vite address shown in the terminal. MailHog is available at `http://127.0.0.1:8025` when enabled.

The frontend API default is `http://127.0.0.1:8767/api`; override it with `VITE_API_URL` when needed.

## Verification

```powershell
php vendor/bin/phpstan.phar analyse backend --level=5 --memory-limit=1G
php vendor/bin/phpunit.phar
cd frontend
npm run lint
npm run build
```

Back up an existing database before importing if it contains data you still need.
# Production readiness

Before deployment, set `APP_ENV=production`, a public HTTPS `APP_URL`, a unique
`JWT_SECRET` of at least 32 random characters, and the exact public origin in
`CORS_ALLOWED_ORIGINS`. Never commit the real `.env` file.

Run the 30-minute email reminder dispatcher every five minutes:

```text
php backend/cli/dispatch_game_reminders.php
```

The dispatcher is idempotent: reminders already recorded as sent are skipped.
