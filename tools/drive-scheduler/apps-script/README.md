# Option A — Google Apps Script

Runs in your **personal** Google account. The destination folder lives in your work account but is shared back to personal with Editor access, so the script writes into it as the personal user.

## Two ways to install

- **Path 1 — `clasp` from your PC** (recommended): push these files directly from this repo to a new Apps Script project. Closer to "real code".
- **Path 2 — Browser copy-paste**: open script.google.com, paste each file's contents. Use this if you don't want to install Node.js / clasp.

Both paths share steps 1–3 below (the Drive folder side of the setup).

## Steps 1–3: Drive side (do these first, both paths)

1. **Test that you can share a work folder with personal**
   In your work Drive, right-click any folder → Share → paste your personal Gmail → Editor. If you see "Sharing outside your organization is disabled", stop here and use Option C instead.

2. **Share the real destination folder** (work → personal, Editor access). Note its ID — the part of the URL after `/folders/`.

3. **Find the source folder ID** in your personal Drive. Same trick: copy the part of the URL after `/folders/`.

## Path 1 — `clasp` from your PC

Prereqs: **Node.js ≥ 18**. Check with `node --version`. Install from <https://nodejs.org> if missing.

```bash
# 1. Install clasp globally
npm install -g @google/clasp

# 2. Sign in with your personal Google account (opens a browser)
clasp login

# 3. Enable the Apps Script API for your account (one-time)
#    Visit https://script.google.com/home/usersettings and toggle "Apps Script API" ON.

# 4. From this directory:
cd tools/drive-scheduler/apps-script

# 5. Create a new standalone Apps Script project
clasp create --type standalone --title "Drive Scheduler" --rootDir .
#    This writes .clasp.json (gitignored) with the new script's ID.

# 6. Push the files from this folder
clasp push -f

# 7. Open the project in your browser
clasp open
```

In the browser tab that opens:

- Editor sidebar → **Services** (+) → add **Drive API** (matches the manifest)
- Edit `Config.gs` → fill in `PAIRS` with the IDs from steps 2–3 → save
- Run `clasp push -f` again locally if you edited `Config.gs` on your PC
- Function dropdown → **`syncAllNow`** → **Run** → approve the OAuth scopes → check the **Executions** tab for `copied=… skipped=…`
- Function dropdown → **`installTriggers`** → **Run** → the **Triggers** tab now shows the daily/weekly/monthly schedules

Iterating later: edit `Code.gs` / `Config.gs` locally, `clasp push -f`, re-run.

## Path 2 — Browser copy-paste

4. **Create the Apps Script project**
   - <https://script.google.com> (signed into personal) → **New project**
   - Delete the boilerplate `Code.gs`
   - Create three files matching this directory: `Code.gs`, `Config.gs`, and (gear icon → "Show appsscript.json manifest file") replace `appsscript.json`

5. **Enable the Drive Advanced Service**
   - Editor sidebar → **Services** (+) → **Drive API** → Add

6. **Edit `Config.gs`** — fill in `PAIRS`, adjust `WEEKLY_DAY`, `MONTHLY_DAY`, `TRIGGER_HOUR` and the `timeZone` in `appsscript.json`.

7. **Authorize and test** — run `syncAllNow`, approve scopes, watch Executions.

8. **Install schedules** — run `installTriggers`. Confirm in the Triggers tab.

## What it does

For each pair, walks the source folder recursively. For every file:

- **Doesn't exist in destination** → copy it
- **Exists, same `md5Checksum`** → skip
- **Exists, source `modifiedTime` newer** → rename the old destination copy to `<name>.bak-YYYYMMDD-HHMMSS` and copy a fresh version (append-only — nothing is deleted)
- **Otherwise** → skip

Subfolders are mirrored by name. Google-native files (Docs, Sheets, Slides) have no md5, so they're compared by `modifiedTime` only.

## Common gotchas

- **6-minute execution limit.** Consumer accounts get 6 minutes per run. If a sync exceeds that, the run fails and the next trigger picks up where it left off (because `indexChildren_` re-checks what's already there). For folders with thousands of files you may want to split them across multiple pairs.
- **"File not found" on destination folder.** Means the work folder hasn't been shared back to personal with Editor access, or sharing was revoked.
- **Quota errors.** Google Drive has per-user query rate limits. The script paginates 1000-at-a-time which is usually fine; if you hit `userRateLimitExceeded`, raise frequency to weekly or split pairs.
- **`.bak-` files pile up.** By design — append-only never deletes. Sweep them manually every few months if needed.

## Removing it

Run `removeTriggers` from the editor. Optionally delete the script project.
