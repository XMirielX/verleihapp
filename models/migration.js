
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
{
    name: "009_create_invoice_system",
    sql: `
        /* =====================================================
           KUNDEN
        ===================================================== */

        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            name TEXT NOT NULL,

            street TEXT,
            plz TEXT,
            city TEXT,

            email TEXT,
            phone TEXT,

            stat INTEGER NOT NULL DEFAULT 0
        );


        /* =====================================================
           PREISE PRO MATERIAL / PREISKLASSE
        ===================================================== */

        CREATE TABLE IF NOT EXISTS material_prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            material_id INTEGER NOT NULL,

            price_category TEXT,

            price REAL NOT NULL DEFAULT 0,

            FOREIGN KEY (material_id)
                REFERENCES material_typ(id)
                ON DELETE CASCADE,

            UNIQUE(material_id, price_category)
        );


        /* =====================================================
           RECHNUNGEN
        ===================================================== */

        CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            invoice_number TEXT NOT NULL UNIQUE,

            customer_id INTEGER,
            event_id INTEGER,

            invoice_date TEXT NOT NULL,

            status TEXT NOT NULL DEFAULT 'draft',

            customer_name TEXT,
            customer_address TEXT,
            customer_zip TEXT,
            customer_city TEXT,
            customer_email TEXT,

            event_name TEXT,

            total REAL NOT NULL DEFAULT 0,

            notes TEXT,

            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (customer_id)
                REFERENCES customers(id)
                ON DELETE SET NULL,

            FOREIGN KEY (event_id)
                REFERENCES event(id)
                ON DELETE SET NULL
        );


        /* =====================================================
           RECHNUNGSPOSITIONEN
        ===================================================== */

        CREATE TABLE IF NOT EXISTS invoice_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            invoice_id INTEGER NOT NULL,

            material_id INTEGER,

            description TEXT NOT NULL,

            quantity REAL NOT NULL DEFAULT 1,

            unit TEXT NOT NULL DEFAULT 'Stück',

            unit_price REAL NOT NULL DEFAULT 0,

            total REAL NOT NULL DEFAULT 0,

            sort_order INTEGER NOT NULL DEFAULT 0,

            FOREIGN KEY (invoice_id)
                REFERENCES invoices(id)
                ON DELETE CASCADE,

            FOREIGN KEY (material_id)
                REFERENCES material_typ(id)
                ON DELETE SET NULL
        );
    `
},

{
    name: "010_add_customer_to_event",
    sql: `
        ALTER TABLE event
        ADD COLUMN customer_id INTEGER;
    `,
    ignoreError: "duplicate column name"
},

{
    name: "011_create_price_categories",
    sql: `
        CREATE TABLE IF NOT EXISTS price_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            name TEXT NOT NULL UNIQUE,

            stat INTEGER NOT NULL DEFAULT 1
        );

        INSERT OR IGNORE INTO price_categories (name)
        VALUES
            ('Steinau Innenstadt'),
            ('Steinau Vorort'),
            ('Schlüchtern Innenstadt'),
            ('Schlüchtern Vorort'),
            ('Bad Soden-Salmünster'),
            ('Wächtersbach');
    `
},

{
    name: "012_change_customer_price_category",
    sql: `
        ALTER TABLE customers
        ADD COLUMN price_category_id INTEGER;
    `,
    ignoreError: "duplicate column name"
},


{
    name: "013_create_material_prices",
    sql: `
        CREATE TABLE IF NOT EXISTS material_prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            material_id INTEGER NOT NULL,

            price_category_id INTEGER,

            price REAL NOT NULL DEFAULT 0,

            FOREIGN KEY (material_id)
                REFERENCES material_typ(id)
                ON DELETE CASCADE,

            FOREIGN KEY (price_category_id)
                REFERENCES price_categories(id)
                ON DELETE SET NULL,

            UNIQUE(material_id, price_category_id)
        );
    `
},

{
    name: "012_insert_price_category_steinau_innenstadt",
    sql: `
        INSERT OR IGNORE INTO price_categories (name)
        VALUES ('Steinau Innenstadt');
    `
},

{
    name: "013_insert_price_category_steinau_vorort",
    sql: `
        INSERT OR IGNORE INTO price_categories (name)
        VALUES ('Steinau Vorort');
    `
},

{
    name: "014_insert_price_category_schluechtern_innenstadt",
    sql: `
        INSERT OR IGNORE INTO price_categories (name)
        VALUES ('Schlüchtern Innenstadt');
    `
},

{
    name: "015_insert_price_category_schluechtern_vorort",
    sql: `
        INSERT OR IGNORE INTO price_categories (name)
        VALUES ('Schlüchtern Vorort');
    `
},

{
    name: "016_insert_price_category_bad_soden",
    sql: `
        INSERT OR IGNORE INTO price_categories (name)
        VALUES ('Bad Soden-Salmünster');
    `
},

{
    name: "017_insert_price_category_waechtersbach",
    sql: `
        INSERT OR IGNORE INTO price_categories (name)
        VALUES ('Wächtersbach');
    `
},
{    name: "019_create_invoices_items",

    sql: `

        /* =====================================================
           RECHNUNGSPOSITIONEN
        ===================================================== */

        CREATE TABLE IF NOT EXISTS invoice_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            invoice_id INTEGER NOT NULL,

            material_id INTEGER,

            description TEXT NOT NULL,

            quantity REAL NOT NULL DEFAULT 1,

            unit TEXT NOT NULL DEFAULT 'Stück',

            unit_price REAL NOT NULL DEFAULT 0,

            total REAL NOT NULL DEFAULT 0,

            sort_order INTEGER NOT NULL DEFAULT 0,

            FOREIGN KEY (invoice_id)
                REFERENCES invoices(id)
                ON DELETE CASCADE,

            FOREIGN KEY (material_id)
                REFERENCES material_typ(id)
                ON DELETE SET NULL
        );
    `
},
{    name: "020_create_invoices",

    sql: `
        /* =====================================================
           RECHNUNGEN
        ===================================================== */

        CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            invoice_number TEXT NOT NULL UNIQUE,

            customer_id INTEGER,
            event_id INTEGER,

            invoice_date TEXT NOT NULL,

            status TEXT NOT NULL DEFAULT 'draft',

            customer_name TEXT,
            customer_address TEXT,
            customer_zip TEXT,
            customer_city TEXT,
            customer_email TEXT,

            event_name TEXT,

            total REAL NOT NULL DEFAULT 0,

            notes TEXT,

            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (customer_id)
                REFERENCES customers(id)
                ON DELETE SET NULL,

            FOREIGN KEY (event_id)
                REFERENCES event(id)
                ON DELETE SET NULL
        );


        /* =====================================================
           RECHNUNGSPOSITIONEN
        ===================================================== */

        CREATE TABLE IF NOT EXISTS invoice_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            invoice_id INTEGER NOT NULL,

            material_id INTEGER,

            description TEXT NOT NULL,

            quantity REAL NOT NULL DEFAULT 1,

            unit TEXT NOT NULL DEFAULT 'Stück',

            unit_price REAL NOT NULL DEFAULT 0,

            total REAL NOT NULL DEFAULT 0,

            sort_order INTEGER NOT NULL DEFAULT 0,

            FOREIGN KEY (invoice_id)
                REFERENCES invoices(id)
                ON DELETE CASCADE,

            FOREIGN KEY (material_id)
                REFERENCES material_typ(id)
                ON DELETE SET NULL
        );
    `
},
{
    name: "012_change_customer_knz_privat",
    sql: `
        ALTER TABLE customers
        ADD COLUMN knz_privat INTEGER DEFAULT 0;
    `,
    ignoreError: "duplicate column name"
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

