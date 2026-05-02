@echo off
REM ============================================================
REM  Local backup -- Architect's AI Quest
REM  Creates a timestamped .zip of this folder in:
REM    %USERPROFILE%\Documents\architect-ai-quest-backups\
REM
REM  USE:
REM    1. Double-click this file (or run from terminal)
REM    2. A .zip will appear in your Documents folder
REM ============================================================

setlocal
cd /d "%~dp0"

REM Build a sortable timestamp via PowerShell (works on Win 10/11)
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmmss"') do set "TS=%%I"

set "BACKUP_DIR=%USERPROFILE%\Documents\architect-ai-quest-backups"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

set "ZIP_FILE=%BACKUP_DIR%\architect-ai-quest_%TS%.zip"

echo.
echo === Creating backup ===
echo  Source: %~dp0
echo  Target: %ZIP_FILE%
echo.

REM Compress everything (including hidden files like .git, .github, .gitignore)
REM Skip regenerable / bulky folders.
powershell -NoProfile -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$items = Get-ChildItem -Path '%~dp0' -Force | Where-Object { $_.Name -notin @('node_modules','.tools','.cache') };" ^
  "Compress-Archive -Path $items.FullName -DestinationPath '%ZIP_FILE%' -Force"

if exist "%ZIP_FILE%" (
  echo.
  echo  DONE! Backup saved.
  echo  Location: %ZIP_FILE%
  echo.
  echo  TIP: keep the last 5-10 backups, delete older ones to save space.
) else (
  echo.
  echo  ERROR: backup failed. Check the messages above.
)

echo.
pause
endlocal
