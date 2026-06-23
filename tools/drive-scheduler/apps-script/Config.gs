/**
 * Drive Scheduler — Config
 *
 * Edit this file to declare which folders sync, how often, and where to.
 *
 * Folder IDs come from the URL: https://drive.google.com/drive/folders/<THIS_PART>
 *
 * - sourceFolderId: in the account that runs this script (personal)
 * - destFolderId:   in the destination account (work). The destination folder
 *                   must be shared back to the personal account with EDITOR
 *                   access, otherwise the script can't write into it.
 *
 * frequency: "daily" | "weekly" | "monthly"
 */
const PAIRS = [
  // {
  //   name: "Project archive",
  //   sourceFolderId: "1AbCdEfGhIjKlMnOpQrStUvWxYz_personal",
  //   destFolderId:   "1ZyXwVuTsRqPoNmLkJiHgFeDcBa_work",
  //   frequency: "daily"
  // },
  // {
  //   name: "Construction data weekly",
  //   sourceFolderId: "...",
  //   destFolderId:   "...",
  //   frequency: "weekly"
  // },
];

/** Day-of-week for "weekly" jobs. 1=Mon … 7=Sun. */
const WEEKLY_DAY = 1;

/** Day-of-month for "monthly" jobs. 1–28 (avoid 29–31 to be safe). */
const MONTHLY_DAY = 1;

/** Hour of day for triggers, 0–23, in the timeZone from appsscript.json. */
const TRIGGER_HOUR = 3;
