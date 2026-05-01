#!/usr/bin/env bash
# ============================================================
# Push the Architect's AI Quest site to GitHub.
# Repo:    https://github.com/hipcommuter/architect-ai-quest
# Author:  Woratat Saruno <woratat.tect9@gmail.com>
#
# BEFORE RUNNING:
#   1. Go to https://github.com/new
#   2. Repository name: architect-ai-quest
#   3. Visibility:      Public
#   4. DO NOT check "Add a README" (we already have one)
#   5. Click "Create repository"
#   6. Then run:  bash push-to-github.sh
# ============================================================
set -e

cd "$(dirname "$0")"

echo
echo "=== Step 1: git init ==="
git init -b main

echo
echo "=== Step 2: git identity (local to this repo) ==="
git config user.name "Woratat Saruno"
git config user.email "woratat.tect9@gmail.com"

echo
echo "=== Step 3: stage everything ==="
git add .

echo
echo "=== Step 4: first commit ==="
git commit -m "Initial commit: Architect's AI Quest pixel-art site"

echo
echo "=== Step 5: add GitHub remote ==="
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/hipcommuter/architect-ai-quest.git

echo
echo "=== Step 6: push to GitHub ==="
echo "(you may be prompted to sign in via browser the first time)"
git push -u origin main

cat <<EOF

============================================================
 DONE! Your site is now at:
   https://github.com/hipcommuter/architect-ai-quest

 TO ENABLE GITHUB PAGES (free hosting):
   1. Visit: https://github.com/hipcommuter/architect-ai-quest/settings/pages
   2. Source: "Deploy from a branch"
   3. Branch: "main" / folder: "/ (root)"
   4. Save. Wait ~60 seconds.
   5. Your live URL:
      https://hipcommuter.github.io/architect-ai-quest/
============================================================
EOF
