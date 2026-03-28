const fs = require('fs');
const path = require('path');

const BASE_DIR = process.env.RENDER
  ? "/opt/render/data"
  : path.join(__dirname, "data");

const DB_PATH = path.join(BASE_DIR, 'verleih.db');
const BACKUP_DIR = path.join(BASE_DIR, 'backups');

// Ordner sicherstellen
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Backup erstellen
function backupDB() {
  console.log("DB_PATH:", DB_PATH);
console.log("DB exists:", fs.existsSync(DB_PATH));
  if (!fs.existsSync(DB_PATH)) {
    console.log("Keine DB gefunden ❌");
    return false;
  }

  const safeDate = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `backup-${safeDate}.db`;
  const backupPath = path.join(BACKUP_DIR, fileName);

  fs.copyFileSync(DB_PATH, backupPath);
  console.log("Backup erstellt ✅:", fileName);

  return true;
}
// Restore (optional manuell triggern)
function restoreDB() {
 if (!fs.existsSync(BACKUP_DIR)) return false;

    const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith(".db"))
        .sort() // älteste → neueste
        .reverse(); // neueste zuerst

    if (files.length === 0) return false;

    const latest = path.join(BACKUP_DIR, files[0]);

    console.log("♻️ Letztes Backup gefunden:", latest);

    fs.copyFileSync(latest, DB_PATH);
    console.log("🔄 DB aus Backup wiederhergestellt");

    return true;
}
  const { db } = require('./models/dbv');

// Funktion prüfen, ob DB leer ist
function isDBEmpty(callback) {
    db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
        if (err) {
            console.log("⚠️ Tabelle fehlt → DB leer");
            return callback(null, true); // Tabelle existiert nicht = leer
        }

        console.log("🔍 Anzahl Produkte:", row.count);
        callback(null, row.count === 0);
    });
}
// Automatisch beim Start ausführen
isDBEmpty((err, empty) => {
    if (err) {
        console.error("Fehler beim Prüfen der DB:", err);
        return;
    }

    if (empty) {
        console.log("⚠️ DB ist leer, versuche letztes Backup wiederherzustellen...");
        const restored = restoreDB();
        if (!restored) console.log("❌ Kein Backup gefunden, DB bleibt leer");
    }
});
module.exports = { backupDB, restoreDB };