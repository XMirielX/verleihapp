const express = require("express");
const router = express.Router();
const { db } = require("../models/dbv");
const productDetailCache = {};

// POST /api/rentals
// Body: { event_id: 1, Codes: [123, 456] }
router.post("/", async (req, res) => {
    const { event_id, Codes } = req.body;
    if (!event_id || !Codes.length) return res.status(400).json({ error: "Missing data" });
    console.log("Aktive Events:", event_id); // Debug, um zu prüfe
    const results = [];
    try {
        for (const rawCode of Codes) {
            //  Produkt suchen
            const Code = parseInt(rawCode);
            const product = await db.getAsync("SELECT id, name FROM products WHERE Code = ?", [Code]);
            if (!product) {
                results.push({ Code, status: "nicht gefunden" });
                continue;
            }
            const double = await db.getAsync(
                "SELECT rowid as id FROM rental WHERE product_id = ? AND stat = 10",
                [product.id]
            );
            if (double) {
                results.push({ Code, product: product.name, status: "bereits verliehen" });
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
            results.push({ Code, product: product.name, status: "wird ausgeliehen" });
        }
        res.json({ message: "Fertig", results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Insert failed" });
    }
});


router.post("/return", async (req, res) => {
    const { event_id, Codes } = req.body;

    if (!event_id || !Codes || !Codes.length) {
        return res.status(400).json({ error: "Missing data" });
    }
    const results = [];
    try {
        for (const rawCode of Codes) {
            //  Produkt suchen
            const Code = parseInt(rawCode);
            const product = await db.getAsync("SELECT id, name FROM products WHERE Code = ?", [Code]);
            if (!product) {
                results.push({ Code, status: "Produkt nicht gefunden" });
                continue;
            }
            const rental = await db.getAsync(
                "SELECT rowid as id, * FROM rental WHERE product_id = ? AND event_id = ? AND stat = 10",
                [product.id, event_id]
            );
            if (!rental) {
                results.push({ Code, product: product.name, status: "nicht verliehen" });
                continue;
            }
            // zurückgeben
            await db.runAsync("UPDATE rental SET stat = 90 WHERE rowid = ?", [rental.id]);
            // 🔓 Produkt wieder freigeben
            await db.runAsync(
                "UPDATE products SET stat = 10 WHERE id = ?",
                [product.id]
            );
            results.push({ Code, product: product.name, status: "zurückgegeben" });
        }
        res.json({ message: "Fertig", results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Update failed" });
    }
});


router.post("/storno", async (req, res) => {
    const { event_id, Codes } = req.body;
    if (!event_id || !Codes || !Codes.length) {
        return res.status(400).json({ error: "Missing data" });
    }
    const results = [];
    try {
        for (const rawCode of Codes) {
            //  Produkt suchen
            const Code = parseInt(rawCode);
            const product = await db.getAsync(
                "SELECT id, name FROM products WHERE Code = ?",
                [Code]
            );
            if (!product) {
                results.push({ Code, status: "Produkt nicht gefunden" });
                continue;
            }
            //  offene Ausleihe suchen
            const rental = await db.getAsync(
                "SELECT rowid as id FROM rental WHERE product_id = ? AND event_id = ? AND stat = 10",
                [product.id, event_id]
            );
            if (!rental) {
                results.push({ Code, product: product.name, status: "nicht verliehen" });
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
                Code,
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
            SELECT
                mt.id as material_id,
                mt.name as pname,
                mt.specification as spezification,
                COUNT(DISTINCT p.id) as available,
                COALESCE(plan.planned, 0) as planned,
                COUNT(DISTINCT r.id) as scanned
            FROM material_typ mt

            LEFT JOIN products p
                ON p.material_typ_id = mt.id

            LEFT JOIN (
                SELECT
                    material_id,
                    SUM(quantity) as planned
                FROM event_plan
                WHERE event_id = ?
                GROUP BY material_id
            ) plan
                ON plan.material_id = mt.id

            LEFT JOIN rental r
                ON r.product_id = p.id
                AND r.event_id = ?
                AND r.stat = 10

            GROUP BY mt.id

            HAVING planned > 0 OR scanned > 0

            ORDER BY mt.category_id, mt.name

        `, [event_id, event_id]);

        res.json(products);

    } catch(err) {
        console.error(err);
        res.status(500).json({
            error:"Datenbankfehler"
        });
    }
});

router.get("/:event_id/material/:material_id/products", async (req, res) => {

    const event_id = parseInt(req.params.event_id, 10);
    const material_id = parseInt(req.params.material_id, 10);

    try {

        const products = await db.allAsync(`
            SELECT
                p.id,
                p.name,
                p.Code,
                r.stat as rental_stat
            FROM products p

            LEFT JOIN rental r
                ON r.product_id = p.id
                AND r.event_id = ?
                AND r.stat = 10

            WHERE p.material_typ_id = ?

            ORDER BY p.Code
        `, [event_id, material_id]);

        res.json(products);

    } catch(err) {

        console.error(err);
        res.status(500).json({
            error:"Datenbankfehler"
        });

    }
});
module.exports = router;
