// init_admin.js
const bcrypt = require('bcrypt');
const { db } = require('./models/dbv'); // dein DB-Wrapper mit getAsync/runAsync

const INITIAL_ADMIN = { username: 'admin', password: 'thwsteinau', role: 'admin' };

async function createAdminIfEmpty() {

    // Prüfen, ob schon Benutzer existieren
    const row = await db.getAsync('SELECT COUNT(*) AS count FROM users');
    console.log('Prüfung Users-Tabelle erfolgreich');


    if (parseInt(row.count) === 0) {
      console.log('Tabelle leer – lege Admin an...');
      const hash = await bcrypt.hash(INITIAL_ADMIN.password, 10);

      await db.runAsync(
        'INSERT INTO users (username, password_hash, role, first_login) VALUES ($1, $2, $3, 1)',
        [INITIAL_ADMIN.username, hash, INITIAL_ADMIN.role]
      );
      console.log(`Initialer Admin "${INITIAL_ADMIN.username}" wurde angelegt ✅`);
    } else {
      console.log('Users-Tabelle enthält bereits Einträge – nichts zu tun');
    }
  } 


// Direkt aufrufen
createAdminIfEmpty();

module.exports = { createAdminIfEmpty };