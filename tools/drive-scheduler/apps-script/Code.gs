/**
 * Drive Scheduler — main copy logic.
 *
 * Entry points (run from the Apps Script editor or via triggers):
 *   - syncDaily()        copy all PAIRS with frequency "daily"
 *   - syncWeekly()       copy all PAIRS with frequency "weekly"
 *   - syncMonthly()      copy all PAIRS with frequency "monthly"
 *   - syncAllNow()       copy every pair regardless of frequency (manual run)
 *
 * Trigger setup (run once each, from the editor):
 *   - installTriggers()  install daily/weekly/monthly triggers per Config
 *   - removeTriggers()   delete every trigger this script owns
 */

const MODE = "incremental-append";

function syncDaily()   { runPairs_("daily"); }
function syncWeekly()  { runPairs_("weekly"); }
function syncMonthly() { runPairs_("monthly"); }
function syncAllNow()  { runPairs_(null); }

function runPairs_(frequencyFilter) {
  const started = new Date();
  const matching = PAIRS.filter(p => !frequencyFilter || p.frequency === frequencyFilter);
  console.log("Drive Scheduler: %s pair(s) to run (filter=%s)", matching.length, frequencyFilter || "ALL");

  for (const pair of matching) {
    try {
      console.log("[%s] start", pair.name);
      const stats = syncFolder_(pair.sourceFolderId, pair.destFolderId);
      console.log("[%s] done copied=%s skipped=%s replaced=%s folders=%s",
        pair.name, stats.copied, stats.skipped, stats.replaced, stats.folders);
    } catch (e) {
      console.error("[%s] FAILED: %s", pair.name, e.stack || e);
    }
  }

  console.log("Drive Scheduler: total elapsed = %s s", (new Date() - started) / 1000);
}

/**
 * Recursively syncs sourceFolderId → destFolderId.
 * Returns {copied, skipped, replaced, folders}.
 */
function syncFolder_(sourceFolderId, destFolderId) {
  const stats = { copied: 0, skipped: 0, replaced: 0, folders: 0 };
  walk_(sourceFolderId, destFolderId, stats);
  return stats;
}

function walk_(srcFolderId, dstFolderId, stats) {
  const dstChildren = indexChildren_(dstFolderId);

  let pageToken = null;
  do {
    const resp = Drive.Files.list({
      q: `'${srcFolderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime, md5Checksum, size)",
      pageSize: 1000,
      pageToken: pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    pageToken = resp.nextPageToken;

    for (const f of (resp.files || [])) {
      if (f.mimeType === "application/vnd.google-apps.folder") {
        const dstSubId = ensureSubfolder_(dstFolderId, f.name, dstChildren);
        stats.folders += 1;
        walk_(f.id, dstSubId, stats);
      } else {
        copyFileIfNewer_(f, dstFolderId, dstChildren, stats);
      }
    }
  } while (pageToken);
}

/**
 * Look up children of a folder by name. Returns Map<name, fileMeta[]>.
 * Used for fast existence checks during the walk.
 */
function indexChildren_(folderId) {
  const map = new Map();
  let pageToken = null;
  do {
    const resp = Drive.Files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime, md5Checksum)",
      pageSize: 1000,
      pageToken: pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    pageToken = resp.nextPageToken;
    for (const f of (resp.files || [])) {
      if (!map.has(f.name)) map.set(f.name, []);
      map.get(f.name).push(f);
    }
  } while (pageToken);
  return map;
}

function ensureSubfolder_(parentId, name, parentIndex) {
  const existing = (parentIndex.get(name) || [])
    .find(f => f.mimeType === "application/vnd.google-apps.folder");
  if (existing) return existing.id;

  const created = Drive.Files.create({
    name: name,
    mimeType: "application/vnd.google-apps.folder",
    parents: [parentId],
  }, null, { supportsAllDrives: true });

  if (!parentIndex.has(name)) parentIndex.set(name, []);
  parentIndex.get(name).push({
    id: created.id, name: name, mimeType: "application/vnd.google-apps.folder",
  });
  return created.id;
}

function copyFileIfNewer_(srcFile, dstFolderId, dstIndex, stats) {
  const candidates = (dstIndex.get(srcFile.name) || [])
    .filter(f => f.mimeType !== "application/vnd.google-apps.folder");

  if (candidates.length === 0) {
    copyOne_(srcFile, dstFolderId, dstIndex);
    stats.copied += 1;
    return;
  }

  const dst = candidates[0];

  if (srcFile.md5Checksum && dst.md5Checksum && srcFile.md5Checksum === dst.md5Checksum) {
    stats.skipped += 1;
    return;
  }

  if (new Date(srcFile.modifiedTime) <= new Date(dst.modifiedTime)) {
    stats.skipped += 1;
    return;
  }

  // Append-only: rename the old destination file rather than overwriting/deleting.
  const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss");
  Drive.Files.update({ name: `${dst.name}.bak-${ts}` }, dst.id, null, { supportsAllDrives: true });

  copyOne_(srcFile, dstFolderId, dstIndex);
  stats.replaced += 1;
}

function copyOne_(srcFile, dstFolderId, dstIndex) {
  const copied = Drive.Files.copy(
    { name: srcFile.name, parents: [dstFolderId] },
    srcFile.id,
    { supportsAllDrives: true }
  );
  if (!dstIndex.has(srcFile.name)) dstIndex.set(srcFile.name, []);
  dstIndex.get(srcFile.name).push({
    id: copied.id,
    name: srcFile.name,
    mimeType: srcFile.mimeType,
    modifiedTime: copied.modifiedTime,
    md5Checksum: srcFile.md5Checksum,
  });
}

/* -------------------- Trigger management -------------------- */

function installTriggers() {
  removeTriggers();

  const tz = Session.getScriptTimeZone();
  const hasDaily   = PAIRS.some(p => p.frequency === "daily");
  const hasWeekly  = PAIRS.some(p => p.frequency === "weekly");
  const hasMonthly = PAIRS.some(p => p.frequency === "monthly");

  if (hasDaily) {
    ScriptApp.newTrigger("syncDaily").timeBased()
      .atHour(TRIGGER_HOUR).everyDays(1).inTimezone(tz).create();
    console.log("Installed daily trigger at %s:00 %s", TRIGGER_HOUR, tz);
  }
  if (hasWeekly) {
    const wd = [
      ScriptApp.WeekDay.MONDAY, ScriptApp.WeekDay.TUESDAY, ScriptApp.WeekDay.WEDNESDAY,
      ScriptApp.WeekDay.THURSDAY, ScriptApp.WeekDay.FRIDAY, ScriptApp.WeekDay.SATURDAY,
      ScriptApp.WeekDay.SUNDAY,
    ][Math.max(0, Math.min(6, WEEKLY_DAY - 1))];
    ScriptApp.newTrigger("syncWeekly").timeBased()
      .onWeekDay(wd).atHour(TRIGGER_HOUR).inTimezone(tz).create();
    console.log("Installed weekly trigger on weekday %s at %s:00 %s", WEEKLY_DAY, TRIGGER_HOUR, tz);
  }
  if (hasMonthly) {
    ScriptApp.newTrigger("syncMonthly").timeBased()
      .onMonthDay(MONTHLY_DAY).atHour(TRIGGER_HOUR).inTimezone(tz).create();
    console.log("Installed monthly trigger on day %s at %s:00 %s", MONTHLY_DAY, TRIGGER_HOUR, tz);
  }
}

function removeTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    ScriptApp.deleteTrigger(t);
  }
  console.log("Removed %s trigger(s)", triggers.length);
}
