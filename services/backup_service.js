const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function createBackupService({
  directory = path.join(process.env.DB_DIR || path.join(__dirname, "..", "data"), "backups"),
  remote = process.env.DROPBOX_BACKUP_REMOTE || "dropbox_nicole:verleihapp-backups",
  executable = process.env.RCLONE_BIN || "rclone",
  createBackup = () => require("../backup_persistent").backupDB(),
  execute = promisify(execFile),
  now = Date.now,
  logger = console,
} = {}) {
  const statePath = path.join(directory, ".weekly-backup.json");
  let activeBackup = null;
  let timer = null;

  async function readState() {
    try {
      return JSON.parse(await fs.readFile(statePath, "utf8"));
    } catch (err) {
      if (err.code === "ENOENT") return {};
      throw err;
    }
  }

  async function writeState(state) {
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(statePath + ".tmp", JSON.stringify(state), "utf8");
    await fs.rename(statePath + ".tmp", statePath);
  }

  async function performBackup(scheduled) {
    const state = await readState();
    if (scheduled && !state.pending && state.remote === remote && state.lastSuccess && now() - state.lastSuccess < WEEK_MS) {
      return { skipped: true };
    }

    let backup;
    if (scheduled && state.pending && path.basename(state.pending) === state.pending) {
      const pendingPath = path.join(directory, state.pending);
      try {
        await fs.access(pendingPath);
        backup = { filename: state.pending, path: pendingPath };
      } catch (err) {
        if (err.code !== "ENOENT") throw err;
      }
    }
    backup ||= await createBackup();
    if (!backup) throw new Error("Datenbank nicht gefunden");
    await writeState({ ...state, pending: backup.filename });

    try {
      await execute(executable, [
        "copyto", backup.path, `${remote.replace(/\/+$/, "")}/${backup.filename}`,
      ], { timeout: 5 * 60 * 1000, windowsHide: true });
    } catch (err) {
      const warning = err.code === "ENOENT"
        ? "Lokal gesichert. Dropbox-Upload fehlt: rclone ist nicht installiert oder nicht erreichbar."
        : "Lokal gesichert. Dropbox-Upload fehlgeschlagen. Bitte die rclone-Konfiguration und Server-Logs prüfen.";
      logger.error(warning, err.message);
      return { success: true, filename: backup.filename, dropboxUploaded: false, warning };
    }

    await writeState({ lastSuccess: now(), remote });
    logger.log("Backup lokal und in Dropbox gespeichert:", backup.filename);
    return { success: true, filename: backup.filename, dropboxUploaded: true };
  }

  function runBackup({ scheduled = false } = {}) {
    if (activeBackup) {
      return activeBackup.then(result => result.skipped && !scheduled ? runBackup() : result);
    }
    if (!activeBackup) {
      activeBackup = performBackup(scheduled).finally(() => { activeBackup = null; });
    }
    return activeBackup;
  }

  function start() {
    if (timer) return;
    const check = () => runBackup({ scheduled: true }).catch(err => {
      logger.error("Automatisches Backup fehlgeschlagen:", err.message);
    });
    check();
    timer = setInterval(check, HOUR_MS);
    timer.unref?.();
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  return { runBackup, start, stop };
}

const backupService = createBackupService();
module.exports = { backupService, createBackupService, WEEK_MS };
