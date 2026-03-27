// init_admin.js
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const DB_PATH = './verleih.db'; // Pfad zur SQLite DB
const INITIAL_ADMIN = { username: 'admin', password: 'thwsteinau', role: 'admin' };

const db = new sqlite3.Database(DB_PATH);

async function createAdminIfEmpty() {
  db.get('SELECT COUNT(*) AS count FROM users', async (err, row) => {
    if (err) {
      console.error('Fehler beim Prüfen der Users-Tabelle:', err.message);
      db.close();
      return;
    }

    console.log('Prüfung Users-Tabelle erfolgreich');

    if (row.count === 0) {
      console.log('Tabelle leer – lege Admin an...');
      try {
        const hash = await bcrypt.hash(INITIAL_ADMIN.password, 10);
        db.run(
          "INSERT INTO users (username, password_hash, role, first_login) VALUES (?, ?, ?, 1)",
          [INITIAL_ADMIN.username, hash, INITIAL_ADMIN.role],
          function (err) {
            if (err) console.error('Fehler beim Anlegen des Admins:', err.message);
            else console.log(`Initialer Admin "${INITIAL_ADMIN.username}" wurde angelegt ✅`);
            db.close();
          }
        );
      } catch (hashErr) {
        console.error('Fehler beim Hashing:', hashErr.message);
        db.close();
      }
    } else {
      console.log('Users-Tabelle enthält bereits Einträge – nichts zu tun');
      db.close();
    }
  });
}

createAdminIfEmpty();

module.exports = { createAdminIfEmpty };