#!/usr/bin/env bash
# Build aaziko-next for the /live sub-path and deploy it to aaziko.com/live/
# (nginx static host on 72.61.233.113, docroot /var/www/aaziko.com/live).
#
# Prerequisite: SSH key access to root@72.61.233.113
# Usage:  bash scripts/deploy-live.sh
set -euo pipefail
cd "$(dirname "$0")/.."

BASE=/live
SERVER=root@72.61.233.113
echo "==> Building static export with basePath=$BASE"
rm -rf out .next
AAZIKO_BASE_PATH="$BASE" npm run build

echo "==> Rewriting raw root-relative links to ${BASE}/ (body HTML + one JS nav link)"
# basePath only rewrites /_next and Next <Link>; the site renders body HTML via
# dangerouslySetInnerHTML, so its raw nav links / <img src> must be prefixed here.
find out -name '*.html' -print0 | xargs -0 perl -i -pe 's{(href|src)="/(?!live/)(?!/)}{$1="/live/}g'
find out/_next -name '*.js' -print0 | xargs -0 perl -i -pe 's{href="/order-assurance/}{href="/live/order-assurance/}g'

# Fail loudly if any root-relative link slipped through.
LEAK=$(grep -rhoE '(href|src)="/[^"]*"' out --include=*.html | grep -vE '="/live/' | grep -vE '="//' || true)
[ -z "$LEAK" ] || { echo "ERROR: unprefixed root-relative links remain:"; echo "$LEAK"; exit 1; }

echo "==> Packaging"
( cd out && tar -czf /tmp/aaziko-live.tar.gz . )

echo "==> Uploading + extracting to /var/www/aaziko.com/live"
# Stage the tarball in a persistent dir (NOT /tmp — sshd PrivateTmp can give the
# upload session and the extract session different /tmp namespaces, which once
# left the upload invisible to the extract and wiped the live dir).
scp /tmp/aaziko-live.tar.gz "$SERVER:/var/www/aaziko.com/.deploy-live.tar.gz"
ssh "$SERVER" '
set -e
STAGE=/var/www/aaziko.com/.deploy-live.tar.gz
# Verify the upload arrived AND is a readable archive BEFORE touching the live dir,
# so a failed/partial upload can never leave the site empty.
test -s "$STAGE"
tar -tzf "$STAGE" >/dev/null
mkdir -p /var/www/aaziko.com/live
rm -rf /var/www/aaziko.com/live/*
tar -xzf "$STAGE" -C /var/www/aaziko.com/live
chown -R www-data:www-data /var/www/aaziko.com/live
find /var/www/aaziko.com/live -type d -exec chmod 755 {} \;
find /var/www/aaziko.com/live -type f -exec chmod 644 {} \;
rm -f "$STAGE"
echo "deployed: $(find /var/www/aaziko.com/live -type f | wc -l) files"
'
echo "==> Done: https://aaziko.com/live/"
