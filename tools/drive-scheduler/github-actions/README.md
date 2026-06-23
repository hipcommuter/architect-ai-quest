# Option C — GitHub Actions

Runs on GitHub's runners, on a cron schedule. Holds two OAuth refresh tokens (one per account) as repository secrets. Cross-account copy goes through download-then-upload over the Drive API.

## One-time setup (~15 min)

### 1. Create an OAuth client in Google Cloud

- <https://console.cloud.google.com> → create or pick a project
- **APIs & Services → Library** → enable **Google Drive API**
- **APIs & Services → OAuth consent screen**
  - User type: **External**
  - Add scope: `https://www.googleapis.com/auth/drive`
  - Add **Test users**: your personal Gmail **and** your work email
  - Publishing status can stay **Testing** — refresh tokens for test users don't expire as long as the app is in Testing and the user remains a test user
- **APIs & Services → Credentials → Create Credentials → OAuth client ID**
  - Type: **Desktop app**
  - Save the **client ID** and **client secret**

> If your work admin blocks third-party OAuth grants, the work-account consent step in the next section will fail. At that point, neither A nor C is viable without an admin-approved internal OAuth client.

### 2. Get refresh tokens locally

In this directory:

```bash
npm install
GOOGLE_CLIENT_ID=<id> GOOGLE_CLIENT_SECRET=<secret> npm run get-token
```

Open the printed URL in a browser **logged into your personal account**, approve, copy the printed refresh token. Then run the same command again, this time signed into your **work account**, and copy that refresh token too.

If the second run prints "No refresh_token returned": go to <https://myaccount.google.com/permissions>, revoke this OAuth app, and run again — Google only returns a refresh token on first consent.

### 3. Add repository secrets

In the GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | from step 1 |
| `GOOGLE_CLIENT_SECRET` | from step 1 |
| `PERSONAL_REFRESH_TOKEN` | personal account token from step 2 |
| `WORK_REFRESH_TOKEN` | work account token from step 2 |

### 4. Configure folder pairs

Edit `drive-pairs.json`:

```json
{
  "mode": "incremental-append",
  "pairs": [
    {
      "name": "Project archive",
      "sourceFolderId": "1AbCdEfGhIjK_personal",
      "destFolderId":   "1ZyXwVuTsRq_work",
      "frequency": "daily"
    }
  ]
}
```

Folder IDs come from the URL: `https://drive.google.com/drive/folders/<ID>`.

### 5. Test before scheduling

In GitHub → **Actions** → **Drive sync (daily)** → **Run workflow** (workflow_dispatch button). Watch the logs. You should see counts of copied/skipped/replaced.

### 6. Adjust schedule

Edit the `cron:` lines in `.github/workflows/drive-sync-{daily,weekly,monthly}.yml`. Times are UTC. Defaults:

- daily: 19:00 UTC (02:00 Asia/Bangkok)
- weekly: Sun 19:00 UTC (Mon 02:00 Asia/Bangkok)
- monthly: 1st of month 19:00 UTC

## What it does

Same logic as Option A:

- Walk source folder recursively
- Mirror subfolder structure by name
- For each file: copy if missing in destination, copy if source `modifiedTime` is newer (with the old destination file renamed to `<name>.bak-YYYYMMDDHHMMSS`), skip otherwise
- Append-only — never deletes

## Cross-account caveat for Google-native files

Drive's `files.copy` doesn't work across accounts (the source ID isn't visible to the destination's token). The script downloads bytes from the source and uploads them to the destination. For Google-native files (Docs, Sheets, Slides, Drawings) that means **exporting them as Office formats** (`.docx`, `.xlsx`, `.pptx`, `.png`) on the way out — they'll appear on the destination as Office files, not native Docs.

If you need them to land as native Docs on the destination, the workaround is:
1. Sync to destination as `.docx` etc. (this script's default)
2. In a follow-up Apps Script running **inside the destination account**, batch-convert `.docx`/`.xlsx`/`.pptx` back to native Docs. (Not implemented here — flag if you want it.)

## Common gotchas

- **Refresh token expired.** Tokens for OAuth apps in **Testing** mode last as long as you remain a Test user. If you remove yourself, or publish/unpublish the app, tokens may be invalidated. Re-run `get-refresh-token.js` to mint a new one.
- **Quota / rate limits.** The Drive API allows ~1,000 requests per 100s per user. Big folders with many small files can hit this. The script doesn't currently back off — if you see `userRateLimitExceeded` consistently, split the pair into multiple smaller pairs at different frequencies.
- **Concurrent runs overlap.** All three workflows share `concurrency.group: drive-sync` so they queue rather than overlap. If a daily run is mid-flight when weekly fires, weekly waits.
- **First run is the slow one.** Subsequent runs only copy diffs.

## Removing it

- Disable the workflows in **Actions → ... → Disable workflow**
- Delete the four secrets
- Optional: revoke the OAuth client in Google Cloud Console
