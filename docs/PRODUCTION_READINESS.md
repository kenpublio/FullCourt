# FullCourt production readiness

Use this checklist before placing real tournament or participant data in the deployed system. Keep the local XAMPP database for rehearsals and use a separate, empty production database.

## 1. Required production environment

Set these values only in the hosting provider's private environment settings:

- `APP_ENV=production`
- `APP_URL=https://your-domain.example`
- `JWT_SECRET=` a unique random value with at least 32 characters
- `CORS_ALLOWED_ORIGINS=https://your-domain.example`
- `DB_DRIVER`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASS`
- `RESEND_API_KEY`
- `RESEND_FROM=FullCourt <verify@your-verified-domain.example>`

Never commit `.env` or production credentials to GitHub.

Run the deployment gate:

```text
php backend/cli/production_readiness.php
```

Deployment is ready only when every required check reports `ready`. Warnings about demo accounts mean the deployment is connected to the rehearsal database and must not go live.

## 2. Email verification

1. Verify the sender domain in Resend.
2. Configure `RESEND_API_KEY` and `RESEND_FROM`.
3. Register a temporary Coach account using a real inbox.
4. Confirm the registration code arrives and expires correctly.
5. Run Forgot Password and confirm the reset code arrives.
6. Confirm production responses never expose `development_code`.

## 3. Backups and recovery

Create a verified backup before every tournament day and at least once daily:

```text
php backend/cli/backup_database.php
```

Backups are written to `output/backups`, verified after creation, and retained for the latest 30 snapshots. Copy them to storage outside the application server.

Restore only during an approved maintenance window:

```text
php backend/cli/restore_database.php fullcourt-backup-YYYYMMDD-HHMMSS.json.gz --confirm
```

The restore command validates the filename and backup format, then creates a new safety backup before changing any database record.

## 4. Game-day reliability rehearsal

- Admin creates the tournament and assigns a Staff Admin.
- Coach completes a roster and uploads one PSA and Parent Waiver.
- Admin or assigned Staff Admin opens each protected file and records a decision.
- Admin completes the tournament readiness gate before publishing.
- Staff Admin generates a secure scoring link and activates it using its PIN.
- Record every scoring control, pause/resume the clock, undo one action, and verify quarter totals.
- Disconnect the scoring device, record queued actions, reconnect, and sync.
- Submit the final score, confirm it as Admin, and verify the public result and standings.
- Change one schedule time or venue and verify Coach notification/acknowledgement tracking.
- Generate and scan a team QR pass.
- Create a backup after the rehearsal and verify it appears in Admin Settings.

## 5. Stakeholder acceptance

The Kadayo representative should sign off on:

- Admin workflow and permissions
- Staff Admin tournament scope and scoring workflow
- Coach and Assistant Coach mobile experience
- Registration, verification, and password recovery emails
- Roster limit, eligibility requirements, and privacy handling
- Bracket formats and schedule output
- Public tournament, roster, schedule, standings, and game pages
- Offline scoring recovery and printed fallback procedure
- Incident handling, audit trail, backups, and restoration procedure

Record the acceptance date, stakeholder name, remaining issues, and go-live decision outside the application repository.
