const express = require("express");
const router = express.Router();
const db = require("../models/dbv");

// POST /api/rentals
// Body: { event_id: 1, codes: [123, 456] }
router.post("/", async (req, res) => {
    const { event_id, codes } = req.body;
    if (!event_id || !codes.length) return res.status(400).json({ error: "Missing data" });
    console.log("Aktive Events:", event_id); // Debug, um zu prüfe
    const results = [];
    try {
        for (const code of codes) {
            const product = await db.getAsync("SELECT id, name FROM products WHERE Code = ?", [code]);
            if (!product) {
                results.push({ code, status: "nicht gefunden" });
                continue;
            }
            const double = await db.getAsync(
                "SELECT rowid as id FROM rental WHERE product_id = ? AND stat = 10",
                [product.id]
            );
            if (double) {
                results.push({ code, product: product.name, status: "bereits verliehen" });
                continue;
            }
            // eigene runAsync-Funktion für INSERT, damit lastID funktioniert
            const runAsync = (sql, params = []) => {
                return new Promise((resolve, reject) => {
                    db.run(sql, params, function (err) {
                        if (err) reject(err);
                        else resolve({ lastID: this.lastID });
                    });
                });
            };
            await db.runAsync("INSERT INTO rental(event_id, product_id, stat) VALUES (?, ?, ?)", 
                [event_id, product.id, 10]);
            // 🔓 Produkt verleihen
            await db.runAsync(
                "UPDATE products SET stat = 90 WHERE id = ?",
                [product.id]
            );
            results.push({ code, product: product.name, status: "wird ausgeliehen" });
        }
        res.json({ message: "Fertig", results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Insert failed" });
    }
});


router.post("/return", async (req, res) => {
    const { event_id, codes } = req.body;

    if (!event_id || !codes || !codes.length) {
        return res.status(400).json({ error: "Missing data" });
    }
    const results = [];
    try {
        for (const code of codes) {
            const product = await db.getAsync("SELECT id, name FROM products WHERE Code = ?", [code]);
            if (!product) {
                results.push({ code, status: "Produkt nicht gefunden" });
                continue;
            }
            const rental = await db.getAsync(
                "SELECT rowid as id, * FROM rental WHERE product_id = ? AND event_id = ? AND stat = 10",
                [product.id, event_id]
            );
            if (!rental) {
                results.push({ code, product: product.name, status: "nicht verliehen" });
                continue;
            }
            // zurückgeben
            await db.runAsync("UPDATE rental SET stat = 90 WHERE rowid = ?", [rental.id]);
            // 🔓 Produkt wieder freigeben
            await db.runAsync(
                "UPDATE products SET stat = 10 WHERE id = ?",
                [product.id]
            );
            results.push({ code, product: product.name, status: "zurückgegeben" });
        }
        res.json({ message: "Fertig", results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Update failed" });
    }
});


router.post("/storno", async (req, res) => {
    const { event_id, codes } = req.body;
    if (!event_id || !codes || !codes.length) {
        return res.status(400).json({ error: "Missing data" });
    }
    const results = [];
    try {
        for (const code of codes) {
            //  Produkt suchen
            const product = await db.getAsync(
                "SELECT id, name FROM products WHERE Code = ?",
                [code]
            );
            if (!product) {
                results.push({ code, status: "Produkt nicht gefunden" });
                continue;
            }
            //  offene Ausleihe suchen
            const rental = await db.getAsync(
                "SELECT rowid as id FROM rental WHERE product_id = ? AND event_id = ? AND stat = 10",
                [product.id, event_id]
            );
            if (!rental) {
                results.push({ code, product: product.name, status: "nicht verliehen" });
                continue;
            }
            //  Rental löschen (STORNO)
            await db.runAsync(
                "DELETE FROM rental WHERE rowid = ?",
                [rental.id]
            );
            //  Produkt wieder freigeben
            await db.runAsync(
                "UPDATE products SET stat = 10 WHERE id = ?",
                [product.id]
            );
            results.push({
                code,
                product: product.name,
                status: "storniert"
            });
        }
        res.json({ message: "Storno abgeschlossen", results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Update failed" });
    }
});
router.get("/:event_id", async (req, res) => {
    const event_id = parseInt(req.params.event_id, 10);
    try {
        const products = await db.allAsync(`
            SELECT p.name as pname, p.spezification, c.name as cname, r.stat, p.Code
            FROM products p
            JOIN rental r ON p.id = r.product_id
            JOIN categories c ON c.id = p.category_id
            WHERE r.event_id = ?
        `, [event_id]);
        res.json(products);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Datenbankfehler" });
    }
});

module.exports = router;