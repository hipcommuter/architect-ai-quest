// Drive Scheduler — GitHub Actions runner
//
// Cross-account folder sync, personal → work, via the Drive API.
//
// Reads:
//   - drive-pairs.json (folder pairs + frequency)
//   - env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (one OAuth client used for both accounts)
//   - env: PERSONAL_REFRESH_TOKEN (source account)
//   - env: WORK_REFRESH_TOKEN     (destination account)
//
// Usage:
//   node sync.js --frequency daily
//   node sync.js --frequency weekly
//   node sync.js --frequency monthly
//   node sync.js --frequency all      # run every pair regardless of frequency

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = parseArgs(process.argv.slice(2));
const frequency = args.frequency || "all";

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "drive-pairs.json"), "utf8"));
if (config.mode && config.mode !== "incremental-append") {
  console.warn(`Config mode "${config.mode}" not implemented; falling back to incremental-append.`);
}

const pairs = config.pairs.filter(p => frequency === "all" || p.frequency === frequency);
console.log(`Drive Scheduler: ${pairs.length} pair(s) to run (frequency=${frequency})`);

const personal = makeDrive(requireEnv("PERSONAL_REFRESH_TOKEN"));
const work     = makeDrive(requireEnv("WORK_REFRESH_TOKEN"));

let exitCode = 0;
for (const pair of pairs) {
  const t0 = Date.now();
  console.log(`\n[${pair.name}] start`);
  try {
    const stats = await syncFolder(personal, work, pair.sourceFolderId, pair.destFolderId);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(
      `[${pair.name}] done in ${elapsed}s — copied=${stats.copied} skipped=${stats.skipped} replaced=${stats.replaced} folders=${stats.folders}`
    );
  } catch (err) {
    console.error(`[${pair.name}] FAILED:`, err.stack || err.message);
    exitCode = 1;
  }
}

process.exit(exitCode);

/* ------------------------- core ------------------------- */

async function syncFolder(srcDrive, dstDrive, srcId, dstId) {
  const stats = { copied: 0, skipped: 0, replaced: 0, folders: 0 };
  await walk(srcDrive, dstDrive, srcId, dstId, stats);
  return stats;
}

async function walk(srcDrive, dstDrive, srcId, dstId, stats) {
  const dstIndex = await indexChildren(dstDrive, dstId);

  for await (const f of listChildren(srcDrive, srcId)) {
    if (f.mimeType === "application/vnd.google-apps.folder") {
      const subDstId = await ensureSubfolder(dstDrive, dstId, f.name, dstIndex);
      stats.folders += 1;
      await walk(srcDrive, dstDrive, f.id, subDstId, stats);
    } else {
      await copyFileIfNewer(srcDrive, dstDrive, f, dstId, dstIndex, stats);
    }
  }
}

async function* listChildren(drive, parentId) {
  let pageToken;
  do {
    const resp = await drive.files.list({
      q: `'${parentId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime, md5Checksum, size)",
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of resp.data.files || []) yield f;
    pageToken = resp.data.nextPageToken;
  } while (pageToken);
}

async function indexChildren(drive, folderId) {
  const map = new Map();
  for await (const f of listChildren(drive, folderId)) {
    if (!map.has(f.name)) map.set(f.name, []);
    map.get(f.name).push(f);
  }
  return map;
}

async function ensureSubfolder(dstDrive, parentId, name, parentIndex) {
  const existing = (parentIndex.get(name) || [])
    .find(f => f.mimeType === "application/vnd.google-apps.folder");
  if (existing) return existing.id;

  const resp = await dstDrive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id, name, mimeType",
    supportsAllDrives: true,
  });
  if (!parentIndex.has(name)) parentIndex.set(name, []);
  parentIndex.get(name).push(resp.data);
  return resp.data.id;
}

async function copyFileIfNewer(srcDrive, dstDrive, srcFile, dstFolderId, dstIndex, stats) {
  const candidates = (dstIndex.get(srcFile.name) || [])
    .filter(f => f.mimeType !== "application/vnd.google-apps.folder");

  if (candidates.length === 0) {
    await crossAccountCopy(srcDrive, dstDrive, srcFile, dstFolderId, dstIndex);
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

  const ts = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  await dstDrive.files.update({
    fileId: dst.id,
    requestBody: { name: `${dst.name}.bak-${ts}` },
    supportsAllDrives: true,
  });

  await crossAccountCopy(srcDrive, dstDrive, srcFile, dstFolderId, dstIndex);
  stats.replaced += 1;
}

/**
 * Drive's native files.copy() does not work across accounts — the source ID
 * is invisible to the destination account's token. So we download the bytes
 * via the source token and upload them via the destination token.
 *
 * Google-native types (Docs/Sheets/Slides) are exported to their Office
 * equivalents on the way out, then uploaded as that format. Drive does not
 * re-import them as native Docs automatically; this is a known limitation
 * of cross-account copy. Files stored as native types stay as Office files
 * on the destination side.
 */
async function crossAccountCopy(srcDrive, dstDrive, srcFile, dstFolderId, dstIndex) {
  const isNative = srcFile.mimeType.startsWith("application/vnd.google-apps.");
  const exportMap = {
    "application/vnd.google-apps.document":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.google-apps.spreadsheet":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.google-apps.presentation":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.google-apps.drawing": "image/png",
  };

  let body, uploadMime, uploadName;

  if (isNative) {
    const mime = exportMap[srcFile.mimeType];
    if (!mime) {
      console.warn(`  skip (unsupported native type ${srcFile.mimeType}): ${srcFile.name}`);
      return;
    }
    const resp = await srcDrive.files.export(
      { fileId: srcFile.id, mimeType: mime },
      { responseType: "arraybuffer" }
    );
    body = Buffer.from(resp.data);
    uploadMime = mime;
    const ext = mime.endsWith("wordprocessingml.document") ? ".docx"
              : mime.endsWith("spreadsheetml.sheet") ? ".xlsx"
              : mime.endsWith("presentationml.presentation") ? ".pptx"
              : mime === "image/png" ? ".png"
              : "";
    uploadName = srcFile.name.endsWith(ext) ? srcFile.name : srcFile.name + ext;
  } else {
    const resp = await srcDrive.files.get(
      { fileId: srcFile.id, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" }
    );
    body = Buffer.from(resp.data);
    uploadMime = srcFile.mimeType;
    uploadName = srcFile.name;
  }

  // Streaming upload: write to a temp file, then hand a read stream to googleapis.
  const tmp = path.join(os.tmpdir(), `drive-sync-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(tmp, body);

  try {
    const created = await dstDrive.files.create({
      requestBody: {
        name: uploadName,
        parents: [dstFolderId],
        mimeType: uploadMime,
      },
      media: {
        mimeType: uploadMime,
        body: fs.createReadStream(tmp),
      },
      fields: "id, name, mimeType, modifiedTime, md5Checksum",
      supportsAllDrives: true,
    });
    if (!dstIndex.has(uploadName)) dstIndex.set(uploadName, []);
    dstIndex.get(uploadName).push(created.data);
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

/* ------------------------- helpers ------------------------- */

function makeDrive(refreshToken) {
  const oauth2 = new google.auth.OAuth2(
    requireEnv("GOOGLE_CLIENT_ID"),
    requireEnv("GOOGLE_CLIENT_SECRET")
  );
  oauth2.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: "v3", auth: oauth2 });
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(2);
  }
  return v;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const k = argv[i].slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[k] = v;
    }
  }
  return out;
}
