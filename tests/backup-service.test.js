const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createBackupService, WEEK_MS } = require("../services/backup_service");

async function fixture(t, overrides = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "verleih-backup-test-"));
  t.after(async () => {
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(path.join(os.tmpdir(), "verleih-backup-test-")));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  let timestamp = Date.parse("2026-10-11T12:00:00Z");
  let count = 0;
  const uploads = [];
  const options = {
    directory,
    remote: "dropbox_nicole:verleihapp-backups",
    now: () => timestamp,
    logger: { log() {}, error() {} },
    createBackup: async () => {
      const filename = `backup-${++count}.db`;
      const backupPath = path.join(directory, filename);
      await fs.writeFile(backupPath, "test backup");
      return { filename, path: backupPath };
    },
    execute: async (...args) => uploads.push(args),
    ...overrides,
  };
  return {
    options,
    service: createBackupService(options),
    uploads,
    count: () => count,
    advance: ms => { timestamp += ms; },
  };
}

test("creates a backup, uploads the single file and persists the weekly schedule", async t => {
  const f = await fixture(t);
  const result = await f.service.runBackup({ scheduled: true });
  assert.equal(result.dropboxUploaded, true);
  const [executable, args, settings] = f.uploads[0];
  assert.equal(executable, "rclone");
  assert.deepEqual(args, ["copyto", path.join(f.options.directory, "backup-1.db"), "dropbox_nicole:verleihapp-backups/backup-1.db"]);
  assert.equal(settings.windowsHide, true);
  assert.equal(settings.timeout, 300000);
  const restarted = createBackupService(f.options);
  f.advance(WEEK_MS - 1);
  assert.equal((await restarted.runBackup({ scheduled: true })).skipped, true);
  f.advance(1);
  assert.equal((await restarted.runBackup({ scheduled: true })).dropboxUploaded, true);
  assert.equal(f.count(), 2);
});

test("failed Dropbox uploads keep the local backup and retry it after restart", async t => {
  let fail = true;
  const f = await fixture(t, {
    execute: async () => {
      if (fail) throw Object.assign(new Error("rclone missing"), { code: "ENOENT" });
    },
  });
  const result = await f.service.runBackup({ scheduled: true });
  assert.equal(result.success, true);
  assert.equal(result.dropboxUploaded, false);
  assert.match(result.warning, /rclone/);
  await fs.access(path.join(f.options.directory, result.filename));
  fail = false;
  const restarted = createBackupService(f.options);
  assert.equal((await restarted.runBackup({ scheduled: true })).dropboxUploaded, true);
  assert.equal(f.count(), 1);
});

test("manual backups run even when the next weekly backup is not due", async t => {
  const f = await fixture(t);
  await f.service.runBackup({ scheduled: true });
  await f.service.runBackup();
  assert.equal(f.count(), 2);
});

test("concurrent manual and automatic requests share one backup", async t => {
  const f = await fixture(t);
  await Promise.all([f.service.runBackup({ scheduled: true }), f.service.runBackup()]);
  assert.equal(f.count(), 1);
  assert.equal(f.uploads.length, 1);
});

test("missing databases fail without calling the upload command", async t => {
  const f = await fixture(t, { createBackup: async () => false });
  await assert.rejects(f.service.runBackup(), /Datenbank nicht gefunden/);
  assert.equal(f.uploads.length, 0);
});

test("scheduler checks on startup and automatically runs a due weekly backup", async t => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const f = await fixture(t);
  t.after(() => f.service.stop());
  f.service.start();
  await f.service.runBackup({ scheduled: true });
  assert.equal(f.count(), 1);
  t.mock.timers.tick(60 * 60 * 1000);
  await f.service.runBackup({ scheduled: true });
  assert.equal(f.count(), 1);
  f.advance(WEEK_MS);
  t.mock.timers.tick(60 * 60 * 1000);
  await f.service.runBackup({ scheduled: true });
  assert.equal(f.count(), 2);
});
