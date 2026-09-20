# AGENTS.md — EVSU SportSync (Thesis)

## Project
FullCourt: a basketball operations and tournament management system (PHP 8.5 backend + Vite/React frontend) with one consolidated SQL import in the repo root.

## Stack & tooling
- **Backend (PHP 8.5):** no Composer autoloader (manual `require_once` across `backend/models|controllers|middleware|utils|config`). PDO → MySQL (`sportsync_db`).
- **Static analysis:** PHPStan 2.x as a standalone PHAR (PHP here lacks openssl, so Composer couldn't install it). Path: `vendor/bin/phpstan.phar`. Config: `phpstan.neon` (level 5, scans `backend/`).
- **Tests:** PHPUnit 11 as a standalone PHAR: `vendor/bin/phpunit.phar`. Config: `phpunit.xml` + `tests/bootstrap.php`. ⚠️ PHPUnit cannot run in this sandbox (PHP lacks `mbstring`/`dom`/`xmlwriter`); the test suite runs in any normal PHP env. `tests/RouteDefinitionTest.php` is dependency-free.
- **Frontend:** Vite + React 19 + Bootstrap 5, oxlint via `npm run lint`, build via `npm run build`.
- **Database import:** import `FullCourt_Database.sql` in phpMyAdmin or MySQL.
- **Local email (MailHog):** SMTP on `127.0.0.1:1025`, web UI on `http://127.0.0.1:8025`. Binary at `C:\Tools\mailhog\MailHog.exe`. Backend uses `backend/utils/Mailer.php` (fsockopen to MailHog) instead of PHP `mail()`.

## Verification commands
```bash
# Backend: lint then static analysis
php -l backend/models/X.php            # quick syntax check
php vendor/bin/phpstan.phar analyse backend --level=5 --memory-limit=1G   # 0 errors

# Tests (requires mbstring/dom/xmlwriter extensions; not available in this sandbox)
php vendor/bin/phpunit.phar

# Frontend
cd frontend
npm install
npm run lint        # oxlint — 0 errors
npm run build       # exit 0
```

## Database
`FullCourt_Database.sql` is the single complete import. It creates `fullcourt_database` and contains the current schema, indexes, basketball modules, QR access fields, and demo data.

## Module map (what was built)
| Module | Backend | Frontend |
|---|---|---|
| Scorekeeper Portal | `models/Scorekeeper.php`, `controllers/ScorekeeperController.php` | `pages/ScorekeeperPortal.jsx`, `services/scorekeeperService.js` |
| Smart Scheduling | `models/Schedule.php` (conflict-aware), `controllers/ScheduleController.php` | `pages/ScheduleOptimizerView.jsx` (conflicts + drag-reschedule), `services/scheduleService.js` |
| Dynamic Bracketing | `models/Bracket.php`, `controllers/BracketController.php` | `pages/BracketEngineView.jsx` |
| Public Live Hub | `controllers/PublicController.php` (public endpoints) | `pages/PublicSportsPortal.jsx` |
| Analytics & Reports | `controllers/ReportController.php`, `models/MatchScore.php` (standings) | `pages/ReportsAnalyticsView.jsx`, `services/reportService.js` |

## Player portal
| Feature | Backend | Frontend |
|---|---|---|
| Sports News + Announcements | `controllers/NewsController.php`, `controllers/AnnouncementController.php`, `models/News.php` | `pages/Home.jsx` feed + `services/contentService.js` |
| Event categories per sport | `controllers/EventCategoryController.php`, `models/EventCategory.php` | `pages/SportsCategories.jsx` (public) + category select in `components/PlayerSportsApplications.jsx` |
| Player sports history | `controllers/PlayerHistoryController.php`, `models/PlayerHistory.php` (`GET /players/history`) | `pages/SportsHistory.jsx` |
| Player payments | existing `Payment::getForUser` | `pages/PlayerPayments.jsx` (receipt upload, `/my-payments`) |
| Profile photo + selected sport | `UserController::uploadPhoto` (`POST /users/profile/photo`) + `User::updateAvatar` | `pages/Profile.jsx` (avatar upload, Selected Sport card, account status) |
| Organizer self sign-up | `AuthController` now allows `tournament_organizer` | `Register.jsx` 3-option role grid |

## Architecture notes
- **Role-based access:** JWT payload (`users.role`) gates coarse routes; scorekeeper actions additionally verify the user is an assigned `scorekeeper` for the match via `match_officials` (no new user role required).
- **Real-time:** frontend polls the scoreboard every 5s (socket-ready); the backend returns full live state in one call.
- **Protect completed records:** `MatchScore::finalizeMatch` and `ScheduleController::updateMatchSlot` reject completed/cancelled matches; the Scorekeeper frontend disables controls when the match is completed.
- **Winner auto-advance:** `MatchScore::finalizeMatch` computes `nextRound = round+1`, `nextPos = ceil(pos/2)` and fills the winner into the next bracket node's team1/team2 slot; `Bracket` uses seeded mirror pairing (1 vs N) so higher seeds avoid each other early.

## Conventions to follow
- PHP: PSR-12 layout, 4-space indent, `phpstan.neon` clean. Always `$stmt->execute([...])` with named params; never interpolate into SQL.
- Frontend: oxlint-clean, `var(--evsu-primary)` theme tokens, Bootstrap 5 utilities, `card-custom` card class.
- SQL: `CREATE TABLE IF NOT EXISTS`, FKs to existing tables, indexes on match/event lookup columns.

## Running locally (full stack)

### 1. Database
```powershell
mysql -u root -p < FullCourt_Database.sql
```

### 2. Start MailHog (captures email locally)
```powershell
& "C:\Tools\mailhog\MailHog.exe"
```
Keep running — open `http://127.0.0.1:8025` to see captured emails.

### 3. Start PHP backend
```powershell
cd C:\Pictures\SportSync
php -S 127.0.0.1:8767 -t backend
```
Keep running — API at `http://127.0.0.1:8767`

### 4. Start frontend
```powershell
cd C:\Pictures\SportSync\frontend
npm install
npm run dev
```
Open the Vite URL (usually `http://localhost:5173`) in browser.

### 5. Test auth flow
- Request a verification/reset code → code lands in MailHog web UI (`http://127.0.0.1:8025`)
- No more "Local test code" on the page (unless MailHog is down)

## Production deployment (VPS with PHP 8.5+ & OpenSSL)

### Server requirements
- PHP 8.5+ with: `pdo_mysql`, `openssl`, `mbstring`, `dom`, `xmlwriter`
- MySQL/MariaDB
- Nginx/Apache + PHP-FPM (or use PHP built-in server for low traffic)

### 1. Copy project to server
```bash
git clone <repo> /var/www/sportsync
cd /var/www/sportsync
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with production values:
# MAIL_DRIVER=gmail
# MAIL_HOST=smtp.gmail.com
# MAIL_PORT=587
# MAIL_USERNAME=fullcourt2026@gmail.com
# MAIL_PASSWORD=your-16-char-app-password
# DB_HOST=127.0.0.1
# DB_NAME=sportsync_db
# DB_USER=your_db_user
# DB_PASS=your_db_pass
# APP_ENV=production
```

### 3. Import database
```bash
mysql -u root -p < FullCourt_Database.sql
```

### 4. Build frontend
```bash
cd frontend
npm install
npm run build
# Copy dist/ to web root or configure Nginx to serve it
```

### 5. Configure web server (Nginx example)
```nginx
server {
    listen 80;
    server_name sportsync.evsu.edu.ph;
    root /var/www/sportsync/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8767;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 6. Run PHP backend (with process manager)
```bash
# Option A: PHP-FPM (recommended)
# Option B: systemd service running: php -S 127.0.0.1:8767 -t /var/www/sportsync/backend
```

### 7. Verify email works
- Request a reset code on production site → arrives at student's EVSU inbox
- Sender: `fullcourt2026@gmail.com` (Gmail rewrites From header)
