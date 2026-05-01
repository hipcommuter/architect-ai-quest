@echo off
REM ============================================================
REM Push the Architect's AI Quest site to GitHub.
REM Repo:    https://github.com/hipcommuter/architect-ai-quest
REM Author:  Woratat Saruno <woratat.tect9@gmail.com>
REM
REM BEFORE RUNNING:
REM   1. Go to https://github.com/new
REM   2. Repository name: architect-ai-quest
REM   3. Visibility:      Public
REM   4. DO NOT check "Add a README" (we already have one)
REM   5. Click "Create repository"
REM   6. Then double-click this file (or run from terminal)
REM ============================================================

cd /d "%~dp0"

echo.
echo === Step 1: git init ===
git init -b main

echo.
echo === Step 2: git identity (local to this repo) ===
git config user.name "Woratat Saruno"
git config user.email "woratat.tect9@gmail.com"

echo.
echo === Step 3: stage everything ===
git add .

echo.
echo === Step 4: first commit ===
git commit -m "Initial commit: Architect's AI Quest pixel-art site"

echo.
echo === Step 5: add GitHub remote ===
git remote remove origin 2>nul
git remote add origin https://github.com/hipcommuter/architect-ai-quest.git

echo.
echo === Step 6: push to GitHub ===
echo (you may be prompted to sign in via browser the first time)
git push -u origin main

echo.
echo ============================================================
echo  DONE! Your site is now at:
echo    https://github.com/hipcommuter/architect-ai-quest
echo.
echo  TO ENABLE GITHUB PAGES (free hosting):
echo    1. Visit: https://github.com/hipcommuter/architect-ai-quest/settings/pages
echo    2. Source: "Deploy from a branch"
echo    3. Branch: "main" / folder: "/ (root)"
echo    4. Save. Wait ~60 seconds.
echo    5. Your live URL:
echo       https://hipcommuter.github.io/architect-ai-quest/
echo ============================================================
pause
