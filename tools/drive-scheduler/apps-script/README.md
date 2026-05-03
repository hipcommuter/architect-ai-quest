# Option A — Google Apps Script

Runs in your **personal** Google account. The destination folder lives in your work account but is shared back to personal with Editor access, so the script writes into it as the personal user.

## One-time setup (~5 min)

1. **Test that you can share a work folder with personal**
   In your work Drive, right-click any folder → Share → paste your personal Gmail → Editor. If you see "Sharing outside your organization is disabled", stop here and use Option C instead.

2. **Share the real destination folder** (work → personal, Editor access). Note its ID — the part of the URL after `/folders/`.

3. **Find the source folder ID** in your personal Drive. Same trick: copy the part of the URL after `/folders/`.

4. **Create the Apps Script project**
   - Go to <https://script.google.com> while logged in as your personal account
   - Click **New project**
   - Delete the boilerplate `Code.gs`
   - Create three files matching this directory: `Code.gs`, `Config.gs`, and (via the gear icon → "Show appsscript.json manifest file") replace `appsscript.json` with the one in this folder

5. **Enable the Drive Advanced Service**
   - Editor sidebar → **Services** (+) → **Drive API** → Add (it should already be referenced by the manifest, but click Add to confirm authorization)

6. **Edit `Config.gs`**
   - Fill in `PAIRS` with one entry per folder you want to sync
   - Adjust `WEEKLY_DAY`, `MONTHLY_DAY`, `TRIGGER_HOUR`, and `timeZone` in `appsscript.json` to your liking

7. **Authorize and test**
   - Select `syncAllNow` from the function dropdown → **Run**
   - Approve the OAuth scopes (Drive read/write, trigger management)
   - Watch **Executions** tab — you should see counts of copied/skipped/replaced

8. **Install the schedules**
   - Select `installTriggers` → **Run**
   - Triggers tab should now show daily / weekly / monthly entries (only the ones you actually use, based on the `frequency` values in `PAIRS`)

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
