#!/usr/bin/env bash
# Deploy the Aaziko Live analytics collector to 72.61.233.113 (same box that serves
# aaziko.com/live). Runs under PM2 as "aaziko-live-analytics" on 127.0.0.1:3056.
#
# Prerequisite: SSH key access to root@72.61.233.113 (same as scripts/deploy-live.sh).
# Usage:  bash analytics-server/deploy.sh
#
# It preserves the server's existing data/ (the SQLite DB) and .env (credentials):
# those are excluded from the upload, so a redeploy never wipes stats or secrets.
set -euo pipefail
cd "$(dirname "$0")"

SERVER=root@72.61.233.113
DEST=/var/www/aaziko-live-analytics
APP=aaziko-live-analytics

echo "==> Packaging analytics-server (code only; data/ + .env preserved on server)"
tar --exclude=node_modules --exclude=data --exclude=.env --exclude='*.log' \
    -czf /tmp/aaziko-live-analytics.tar.gz .

echo "==> Uploading"
scp /tmp/aaziko-live-analytics.tar.gz "$SERVER:/tmp/aaziko-live-analytics.tar.gz"

echo "==> Installing + (re)starting on the server"
ssh "$SERVER" bash -s <<'REMOTE'
set -euo pipefail
DEST=/var/www/aaziko-live-analytics
APP=aaziko-live-analytics
STAGE=/tmp/aaziko-live-analytics.tar.gz

test -s "$STAGE"
tar -tzf "$STAGE" >/dev/null            # verify archive before touching DEST
mkdir -p "$DEST"
tar -xzf "$STAGE" -C "$DEST"            # excludes data/ + .env → stats & creds preserved
rm -f "$STAGE"

# First run: seed .env from the example, reuse the contact-mailer's Gmail SMTP
# credentials (same box) so the daily digest can send without new secrets.
if [ ! -f "$DEST/.env" ]; then
  cp "$DEST/.env.example" "$DEST/.env"
  CM=/var/www/aaziko-contact-mailer/.env
  if [ -f "$CM" ]; then
    SU=$(grep -iE '^(SMTP_USER|CONTACT_TO|MAIL_USER|GMAIL_USER)=' "$CM" | head -1 | cut -d= -f2- | tr -d '"'"'"' ')
    SP=$(grep -iE '^(SMTP_PASS|SMTP_PASSWORD|MAIL_PASS|GMAIL_PASS|APP_PASSWORD)=' "$CM" | head -1 | cut -d= -f2- | tr -d '"'"'"' ')
    [ -n "$SU" ] && sed -i "s|^SMTP_USER=.*|SMTP_USER=$SU|" "$DEST/.env"
    [ -n "$SP" ] && sed -i "s|^SMTP_PASS=.*|SMTP_PASS=$SP|" "$DEST/.env"
    [ -n "$SU" ] && echo "   reused SMTP account $SU from the contact-mailer for the daily digest"
  fi
  # Give the dashboard a random password if the operator didn't pre-place one.
  RP=$(head -c 12 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 14)
  sed -i "s|^ANALYTICS_PASS=.*|ANALYTICS_PASS=$RP|" "$DEST/.env"
  sed -i "s|^ANALYTICS_SALT=.*|ANALYTICS_SALT=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')|" "$DEST/.env"
  echo "!! Created $DEST/.env"
  echo "   Dashboard login → user: aaziko   password: $RP   (change any time in $DEST/.env, then pm2 restart $APP --update-env)"
  if [ ! -f "${CM:-/nonexistent}" ]; then
    echo "   NOTE: contact-mailer .env not found — set SMTP_USER/SMTP_PASS in $DEST/.env for the daily email."
  fi
fi

command -v node >/dev/null || { echo "node not found on server"; exit 1; }
command -v pm2  >/dev/null || npm install -g pm2

cd "$DEST"
# Install deps when a required module is missing. better-sqlite3 is a native addon
# (needs build tools the first time); geoip-lite ships the offline GeoLite2 data.
if ! node -e "require('better-sqlite3');require('geoip-lite')" 2>/dev/null; then
  command -v gcc >/dev/null || apt-get install -y build-essential python3 || true
  npm install --omit=dev --no-audit --no-fund
fi

if pm2 describe "$APP" >/dev/null 2>&1; then
  pm2 restart "$APP" --update-env
else
  pm2 start index.js --name "$APP"
fi
pm2 save

sleep 1
echo "== health ==" ; curl -s http://127.0.0.1:3056/healthz || true ; echo
REMOTE

cat <<'NGINX'

==> Done. Remaining ONE-TIME nginx wiring on 72.61.233.113 (live aaziko.com vhost:
    /etc/nginx/sites-available/aaziko, the certbot 443 server block). Add, just
    before "location /", the same way /api/contact is wired:

      # Analytics collector (first-party) — receives page/card events
      location = /api/track {
          proxy_pass http://127.0.0.1:3056/api/track;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      }
      # Private analytics dashboard (Basic-Auth handled by the app)
      location /live-stats {
          proxy_pass http://127.0.0.1:3056;
          proxy_set_header Host $host;
      }

    Then:  nginx -t && systemctl reload nginx
    Open:  https://aaziko.com/live-stats   (login = ANALYTICS_USER / ANALYTICS_PASS from .env)
NGINX
