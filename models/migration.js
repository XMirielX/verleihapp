
const { db, initDB } = require("./dbv");

const migrations = [
    {
        name: "001_create_material_typ",
        sql: `
            CREATE TABLE IF NOT EXISTS material_typ (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                specification TEXT,
                description TEXT,
                category_id INTEGER NOT NULL,
                active INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (category_id) REFERENCES categories(id),
                UNIQUE(name, specification, category_id)
            );
        `
    },

    {
        name: "003_create_event_plan",
        sql: `
            CREATE TABLE IF NOT EXISTS event_plan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL,
                material_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1,
                comment TEXT,
                FOREIGN KEY (event_id) REFERENCES event(id),
                FOREIGN KEY (material_id) REFERENCES material_typ(id)
            );
        `
    },
    {
        name: "004_add_material_typ_to_products",
        sql: `
            ALTER TABLE products
            ADD COLUMN material_typ_id INTEGER;
        `,
        ignoreError: "duplicate column name"
    },

   {
    name: "006_create_distribution_items",
    sql: `
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
        );
    `
},
{
    name: "007_create_distribution_plan",
    sql: `
        CREATE TABLE IF NOT EXISTS distribution_plan (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            event_id INTEGER NOT NULL,
            distribution_item_id INTEGER NOT NULL,

            location TEXT,
            planned INTEGER NOT NULL DEFAULT 0,

            FOREIGN KEY (event_id) REFERENCES event(id),
            FOREIGN KEY (distribution_item_id) REFERENCES distribution_items(id),

            UNIQUE(event_id, distribution_item_id)
        );
    `
},
{
    name: "008_create_distribution_images",
    sql: `
        CREATE TABLE IF NOT EXISTS distribution_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            distribution_item_id INTEGER NOT NULL,

            filename TEXT NOT NULL,

            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (distribution_item_id)
                REFERENCES distribution_items(id)
                ON DELETE CASCADE
        );
    `
},
];

async function initMigrationTable() {
    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

async function runMigrations() {

    await initMigrationTable();

    for (const migration of migrations) {

        const exists = await db.getAsync(
            "SELECT 1 FROM schema_migrations WHERE name = ?",
            [migration.name]
        );

        if (exists) {
            continue;
        }

        console.log(`Starte Migration: ${migration.name}`);

        try {

            await db.runAsync(migration.sql);

        } catch (err) {

            if (
                migration.ignoreError &&
                err.message.includes(migration.ignoreError)
            ) {
                console.log(`   ↳ Übersprungen (${err.message})`);
            } else {
                throw err;
            }
        }

        await db.runAsync(
            "INSERT INTO schema_migrations(name) VALUES(?)",
            [migration.name]
        );

        console.log(`Migration abgeschlossen: ${migration.name}`);
    }

    console.log("Alle Migrationen ausgeführt.");
}

module.exports = {
    runMigrations
};

