// models/dbv.js

const sqlite3 = require("sqlite3").verbose();
const { promisify } = require("util");
const path = require("path");
const fs = require("fs");

// erkennt automatisch Render vs lokal


// Basisordner: Render vs lokal
const BASE_DIR = process.env.RENDER
  ? "/opt/render/data"     // Render: persistenter Speicher
  : path.join(__dirname, "..", "data"); // lokal: Projekt-Root/data

const DB_PATH = path.join(BASE_DIR, "verleih.db");

console.log("📦 DB Pfad:", DB_PATH);

// DB verbinden
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error("❌ Fehler beim Öffnen der DB:", err);
    } else {
        console.log("✅ DB verbunden");
    }
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