// backup_persistent.js
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'verleih.db'); // Haupt-DB im Projekt
const PERSISTENT_DIR = '/opt/render/data';
//const PERSISTENT_DIR = path.join(__dirname, 'test_data');
const BACKUP_PATH = path.join(PERSISTENT_DIR, 'verleihapp_backup.db'); // Persistentes Backup

// Backup erstellen: kopiert Haupt-DB ins persistente Verzeichnis
function backupDB() {
  if (fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, BACKUP_PATH);
    console.log('Datenbank persistent gesichert ✅');
  } else {
    console.log('Keine Haupt-DB gefunden, Backup übersprungen.');
  }
}

// Wiederherstellen: kopiert persistentes Backup zurück ins Projekt, falls Haupt-DB fehlt
function restoreDB() {
  if (!fs.existsSync(DB_PATH) && fs.existsSync(BACKUP_PATH)) {
    fs.copyFileSync(BACKUP_PATH, DB_PATH);
    console.log('Datenbank aus persistentem Backup wiederhergestellt 🔄');
  }
}

// Automatisch beim Start ausführen
restoreDB();
backupDB();

module.exports = { backupDB, restoreDB };