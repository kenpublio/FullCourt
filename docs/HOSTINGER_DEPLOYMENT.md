# FullCourt deployment on Hostinger VPS

This guide deploys the React/Vite frontend, PHP API, MySQL database, uploads, email, and scheduled reminders on one HTTPS domain.

## 1. Choose the correct Hostinger product

Use a **Hostinger VPS**, preferably Ubuntu 24.04 with at least 2 vCPU and 4 GB RAM for a live tournament. FullCourt is not only a static React page: it also needs a PHP API, writable private uploads, MySQL, scheduled reminders, backups, and full server configuration.

Do not use a Website Builder or WordPress-only plan. A Business/Cloud web plan can host Vite/Node websites, but the VPS route is the least ambiguous fit for the complete PHP + MySQL FullCourt stack.

## 2. Information to prepare

Never send the Hostinger, GitHub, database, or email password in chat. Prepare these values yourself:

- Domain, for example `fullcourt.example.com`
- VPS public IP address
- GitHub repository access
- Strong MySQL database password
- Random JWT secret of at least 64 characters
- Resend API key and verified sender domain
- One administrator email and recovery contact

## 3. Create the VPS

In Hostinger hPanel:

1. Buy or open the VPS plan.
2. Select **Ubuntu 24.04**.
3. Save the VPS IP and root/SSH access safely.
4. In the firewall, allow SSH (22), HTTP (80), and HTTPS (443).

Connect from Windows PowerShell:

```powershell
ssh root@YOUR_VPS_IP
```

## 4. Install the server packages

Run on the VPS:

```bash
apt update && apt upgrade -y
apt install -y nginx mariadb-server git curl unzip certbot python3-certbot-nginx \
  php-fpm php-cli php-mysql php-curl php-mbstring php-xml php-zip

curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

node --version
npm --version
php --version
mysql --version
```

FullCourt requires PHP 8.2 or newer.

## 5. Create a protected database account

```bash
mysql -u root
```

Inside MariaDB, replace the password first:

```sql
CREATE DATABASE IF NOT EXISTS fullcourt_database
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'fullcourt_app'@'localhost'
  IDENTIFIED BY 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD';
GRANT ALL PRIVILEGES ON fullcourt_database.* TO 'fullcourt_app'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 6. Download FullCourt from GitHub

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/kenpublio/FullCourt.git fullcourt
cd /var/www/fullcourt
```

For a private repository, use a GitHub deploy key or a fine-grained read-only token. Do not save a personal password in the repository.

## 7. Import the database

For the stakeholder/rehearsal deployment, import the supplied rehearsal database:

```bash
mysql -u fullcourt_app -p fullcourt_database < FullCourt_Database.sql
```

The supplied SQL contains rehearsal accounts and tournament data. Before accepting real player documents or payments, use a separate clean production database and do not mix it with the rehearsal database.

## 8. Create the production environment

```bash
cp .env.example .env
nano .env
```

Use values similar to these:

```dotenv
DB_DRIVER=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=fullcourt_database
DB_USER=fullcourt_app
DB_PASS=REPLACE_WITH_DATABASE_PASSWORD

APP_ENV=production
APP_URL=https://YOUR_DOMAIN
JWT_SECRET=REPLACE_WITH_AT_LEAST_64_RANDOM_CHARACTERS
CORS_ALLOWED_ORIGINS=https://YOUR_DOMAIN,https://www.YOUR_DOMAIN

RESEND_API_KEY=re_REPLACE_ME
RESEND_FROM=FullCourt <notifications@YOUR_DOMAIN>
```

Generate a JWT secret on the VPS:

```bash
openssl rand -hex 48
```

Protect the environment and uploads:

```bash
chown root:www-data .env
chmod 640 .env
mkdir -p backend/uploads backend/storage/backups
chown -R www-data:www-data backend/uploads backend/storage
chmod -R 750 backend/uploads backend/storage
```

## 9. Build the frontend

```bash
cd /var/www/fullcourt/frontend
npm ci
printf 'VITE_API_URL=/api\n' > .env.production
npm run lint
npm run build
```

The production code also defaults to `/api`, so public pages, images, payments, QR access, and scoring links remain on the deployed domain instead of pointing to localhost.

## 10. Configure Nginx

Create `/etc/nginx/sites-available/fullcourt`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name YOUR_DOMAIN www.YOUR_DOMAIN;

    root /var/www/fullcourt/frontend/dist;
    index index.html;
    client_max_body_size 12M;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME /var/www/fullcourt/backend/index.php;
        fastcgi_param SCRIPT_NAME /index.php;
        fastcgi_param REQUEST_URI $request_uri;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
    }

    location ^~ /uploads/eligibility/ {
        deny all;
        return 404;
    }

    location /uploads/ {
        alias /var/www/fullcourt/backend/uploads/;
        add_header X-Content-Type-Options nosniff always;
    }

    location ~ /\. {
        deny all;
    }
}
```

Confirm the installed PHP-FPM socket with `ls /run/php/`, then change `php8.3-fpm.sock` if your installed version differs.

Enable the site:

```bash
ln -s /etc/nginx/sites-available/fullcourt /etc/nginx/sites-enabled/fullcourt
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

## 11. Point the domain and enable HTTPS

In Hostinger DNS, create these records:

- `A` record: `@` → VPS IP
- `A` record: `www` → VPS IP

After DNS propagation:

```bash
certbot --nginx -d YOUR_DOMAIN -d www.YOUR_DOMAIN
certbot renew --dry-run
```

Then update `APP_URL` and `CORS_ALLOWED_ORIGINS` if the final domain differs, and reload PHP-FPM and Nginx.

## 12. Schedule reminders and backups

Open the root crontab:

```bash
crontab -e
```

Add:

```cron
*/5 * * * * cd /var/www/fullcourt && /usr/bin/php backend/cli/dispatch_game_reminders.php >> /var/log/fullcourt-reminders.log 2>&1
15 2 * * * cd /var/www/fullcourt && /usr/bin/php backend/cli/backup_database.php >> /var/log/fullcourt-backup.log 2>&1
```

Copy backups regularly to another protected location. A backup stored only on the same VPS is not sufficient disaster recovery.

## 13. Run the deployment checks

```bash
cd /var/www/fullcourt
php backend/cli/production_readiness.php
curl -I https://YOUR_DOMAIN
curl https://YOUR_DOMAIN/api/public/portal
```

Verify manually on a phone and desktop:

1. Public home, tournaments, schedule, standings, roster, and game details
2. Coach and Assistant Coach registration plus email verification
3. Admin assignment of one Staff Admin to one tournament
4. Team registration, roster upload, eligibility review, and payment receipt approval
5. Bracket generation and schedule optimization
6. QR team check-in
7. Secure scoring link, all scoring/stat buttons, undo, offline reconnect, and final-score approval
8. Public result, standings, leaders, awards, and PDF downloads
9. Injury and misconduct incident report
10. Password reset and notification delivery

Do not go live with real records while `production_readiness.php` reports missing production HTTPS, JWT, email sender, database schema, or private upload storage.

## 14. Deploy later GitHub updates

After changes are pushed to `main`:

```bash
cd /var/www/fullcourt
git pull --ff-only origin main
cd frontend
npm ci
printf 'VITE_API_URL=/api\n' > .env.production
npm run lint
npm run build
sudo systemctl reload php8.3-fpm
sudo systemctl reload nginx
```

Always create a verified database backup before a release that changes database structure.

## Rollback

If a new release fails:

```bash
cd /var/www/fullcourt
git log --oneline -5
git checkout PREVIOUS_GOOD_COMMIT
cd frontend && npm ci && npm run build
sudo systemctl reload php8.3-fpm nginx
```

Return to `main` after the incident is resolved. Do not overwrite or delete the database during a code rollback.
