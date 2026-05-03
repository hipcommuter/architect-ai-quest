# Drive Scheduler

Two implementations of the same idea: copy folders from one Google Drive account to another on a daily / weekly / monthly schedule.

- **Source**: personal Google account
- **Destination**: work Google account
- **Sync mode**: incremental (copies new files and files whose `modifiedTime` is newer than the destination's), append-only (does not delete from destination when source files are removed)

Pick one of the two flavors below. Both read the same conceptual config: a list of `{ name, sourceFolderId, destFolderId, frequency }` pairs.

## Option A — Google Apps Script

`apps-script/`

Runs inside your personal Google account. Triggers (daily / weekly / monthly) are installed by running a one-line setup function from the Apps Script editor. Cross-account works by **sharing the destination folder from work → personal with Editor access**, then the script writes into it as the personal account.

Best when:
- Your work Workspace allows external sharing (test by sharing a throwaway work folder with your personal Gmail)
- You want zero infra and the easiest setup to share with friends
- Folders are small enough to copy in under 6 minutes per pair

## Option C — GitHub Actions

`github-actions/` + `.github/workflows/drive-sync-{daily,weekly,monthly}.yml`

Runs on GitHub's runners. Holds two refresh tokens (personal + work) as repository secrets. Cross-account works via the Drive API — files are downloaded from the personal account and uploaded to the work account.

Best when:
- Your work admin blocks external folder sharing (forces you to use OAuth refresh tokens anyway)
- You want full logs, re-run buttons, and the schedule in source control
- Folders are large (up to 6 hours per run)

## Picking between them

Run the **30-second compatibility test** first:

> Pick a throwaway folder in your work Drive, right-click → Share, paste your personal Gmail. If it succeeds without an admin warning, **Option A** works. If you see "Sharing outside your organization is disabled" or similar, use **Option C**.

## Config shape (both options)

Each sync pair is described by:

| Field | Meaning |
|---|---|
| `name` | Human-readable label, e.g. `"Project archive"` |
| `sourceFolderId` | Drive folder ID from the personal account (the part after `/folders/` in the URL) |
| `destFolderId` | Drive folder ID from the work account |
| `frequency` | One of `"daily"`, `"weekly"`, `"monthly"` |

Configs live at:

- Apps Script: `apps-script/Config.gs`
- GitHub Actions: `github-actions/drive-pairs.json`

## Sync behavior (both options)

Per pair, recursively:

1. List children in the source folder.
2. For each **subfolder**: find a destination subfolder with the same name (create one if missing), then recurse.
3. For each **file**:
   - If no file with the same name exists in the destination folder, copy it.
   - If a file with the same name exists and the source's `modifiedTime` is newer, copy a fresh version (the script renames the old one with a `.bak-<timestamp>` suffix rather than deleting it — append-only).
   - Otherwise, skip.

Google-native files (Docs, Sheets, Slides) don't expose an `md5Checksum`, so they're compared by `modifiedTime` only.

## Changing the defaults

To switch to **mirror deletions** (true mirror, not append-only) or **always full recopy**, see the `MODE` constant at the top of `apps-script/Code.gs` or the `mode` field in `github-actions/drive-pairs.json`. Currently only `"incremental-append"` is implemented; the others are intentional TODOs to keep v1 small.
