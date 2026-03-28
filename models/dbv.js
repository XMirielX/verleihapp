// models/dbv.js

const sqlite3 = require("sqlite3").verbose();
const { promisify } = require("util");
const path = require("path");
const fs = require("fs");

// erkennt automatisch Render vs lokal
// models/dbv.js

// Basisordner: Render vs lokal
const BASE_DIR = process.env.RENDER
  ? "/opt/render/data"     // Render: persistenter Speicher
  : path.join(__dirname, "..", "data"); // lokal: Projekt-Root/data

const DB_PATH = path.join(BASE_DIR, "verleih.db");

console.log("📦 DB Pfad:", DB_PATH);

// DB richtig initialisieren
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error("Fehler beim Öffnen der DB:", err);
    } else {
        console.log("✅ DB verbunden");
    }
});


module.exports = { db, initDB }; // exportiert db und initDB


// Promisify Methoden für async/await
db.runAsync = promisify(db.run.bind(db));
db.allAsync = promisify(db.all.bind(db));
db.getAsync = promisify(db.get.bind(db));

async function initDB() {
    await db.runAsync(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT
    )`);

    await db.runAsync(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        stat TEXT,
        bez TEXT,
        Code INTEGER,
        category_id INTEGER,
        spezification TEXT,
        check_date DATE,
        FOREIGN KEY (category_id) REFERENCES categories(id)
    )`);

    await db.runAsync(`CREATE TABLE IF NOT EXISTS event (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        stat TEXT,
        costumer TEXT,
        start DATE,
        ende DATE
    )`);

    await db.runAsync(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        first_login INTEGER 
    )`);

    await db.runAsync(`CREATE TABLE IF NOT EXISTS rental (
        id INTEGER,
        event_id INTEGER,
        product_id INTEGER,
        stat INTEGER,
        PRIMARY KEY (id),
        FOREIGN KEY (event_id) REFERENCES event(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);
}

