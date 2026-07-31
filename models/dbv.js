// models/dbv.js

const sqlite3 = require("sqlite3").verbose();
const { promisify } = require("util");
const path = require("path");
const fs = require("fs");

// erkennt automatisch Render vs lokal
// models/dbv.js

// Basisordner: Render vs lokal
const BASE_DIR = process.env.DB_DIR || path.join(__dirname, "..", "data");

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


// Promisify Methoden für async/await
db.runAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                reject(err);
                return;
            }

            resolve({
                lastID: this.lastID,
                changes: this.changes
            });
        });
    });
};
db.allAsync = promisify(db.all.bind(db));
db.getAsync = promisify(db.get.bind(db));

async function ensureOptionalTables() {
    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS distribution_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL UNIQUE,
            input TEXT,
            cable TEXT,
            schuko INTEGER NOT NULL DEFAULT 0,
            cee16 INTEGER NOT NULL DEFAULT 0,
            cee32 INTEGER NOT NULL DEFAULT 0,
            cee63 INTEGER NOT NULL DEFAULT 0,
            cee125 INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,

            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    `);

    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS distribution_plan (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            distribution_item_id INTEGER NOT NULL,
            location TEXT,
            planned INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (event_id) REFERENCES event(id),
            FOREIGN KEY (distribution_item_id) REFERENCES distribution_items(id),
            UNIQUE(event_id, distribution_item_id)
        )
    `);
}

module.exports = { db, initDB, ensureOptionalTables };

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
await db.runAsync(`CREATE TABLE IF NOT EXISTS event_plan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    location TEXT,
    comment TEXT,
    FOREIGN KEY (event_id) REFERENCES event(id)
)`);
}



Stack:
Node.js + Express + SQLite

Tabellen:
categories
products
material_typ
event
rental
event_plan
distribution_items
distribution_plan
distribution_images
users
schema_migrations

Wichtige Beziehungen:
products.category_id -> categories.id
products.material_typ_id -> material_typ.id
rental.event_id -> event.id
rental.product_id -> products.id
event_plan.event_id -> event.id
event_plan.material_id -> material_typ.id
distribution_items.product_id -> products.id
distribution_plan.event_id -> event.id
distribution_plan.distribution_item_id -> distribution_items.id
distribution_images.distribution_item_id -> distribution_items.id
