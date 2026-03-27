// models/dbv.js
const { Pool } = require("pg");

// Verbindung zu Supabase
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // aus Supabase!
    ssl: { rejectUnauthorized: false }
});

// Kleine Helferfunktionen wie bei SQLite

async function runAsync(query, params = []) {
    const res = await pool.query(query, params);
    return res;
}

async function getAsync(query, params = []) {
    const res = await pool.query(query, params);
    return res.rows[0]; // nur ein Ergebnis
}

async function allAsync(query, params = []) {
    const res = await pool.query(query, params);
    return res.rows; // alle Ergebnisse
}

// Optional: initDB kannst du hier leer lassen oder entfernen
async function initDB() {
    console.log("📦 Supabase DB verbunden");
}

module.exports = {
    db: {
        runAsync,
        getAsync,
        allAsync
    },
    initDB
};