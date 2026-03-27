const express = require("express");
const router = express.Router();
const { db } = require("../models/dbv");

// POST /api/rentals
router.post("/", async (req, res) => {
    const { event_id, codes } = req.body;
    if (!event_id || !codes?.length) return res.status(400).json({ error: "Missing data" });

    const results = [];
    try {
        for (const code of codes) {
            const product = await db.getAsync(
                "SELECT id, name FROM products WHERE code = $1",
                [code]
            );
            if (!product) {
                results.push({ code, status: "nicht gefunden" });
                continue;
            }

            const double = await db.getAsync(
                "SELECT id FROM rental WHERE product_id = $1 AND stat = 10",
                [product.id]
            );
            if (double) {
                results.push({ code, product: product.name, status: "bereits verliehen" });
                continue;
            }

            await db.runAsync(
                "INSERT INTO rental(event_id, product_id, stat) VALUES ($1, $2, $3)",
                [event_id, product.id, 10]
            );

            await db.runAsync(
                "UPDATE products SET stat = 90 WHERE id = $1",
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

// POST /api/rentals/return
router.post("/return", async (req, res) => {
    const { event_id, codes } = req.body;
    if (!event_id || !codes?.length) return res.status(400).json({ error: "Missing data" });

    const results = [];
    try {
        for (const code of codes) {
            const product = await db.getAsync("SELECT id, name FROM products WHERE code = $1", [code]);
            if (!product) {
                results.push({ code, status: "Produkt nicht gefunden" });
                continue;
            }

            const rental = await db.getAsync(
                "SELECT id FROM rental WHERE product_id = $1 AND event_id = $2 AND stat = 10",
                [product.id, event_id]
            );
            if (!rental) {
                results.push({ code, product: product.name, status: "nicht verliehen" });
                continue;
            }

            await db.runAsync("UPDATE rental SET stat = 90 WHERE id = $1", [rental.id]);
            await db.runAsync("UPDATE products SET stat = 10 WHERE id = $1", [product.id]);
            results.push({ code, product: product.name, status: "zurückgegeben" });
        }
        res.json({ message: "Fertig", results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Update failed" });
    }
});

// POST /api/rentals/storno
router.post("/storno", async (req, res) => {
    const { event_id, codes } = req.body;
    if (!event_id || !codes?.length) return res.status(400).json({ error: "Missing data" });

    const results = [];
    try {
        for (const code of codes) {
            const product = await db.getAsync("SELECT id, name FROM products WHERE code = $1", [code]);
            if (!product) {
                results.push({ code, status: "Produkt nicht gefunden" });
                continue;
            }

            const rental = await db.getAsync(
                "SELECT id FROM rental WHERE product_id = $1 AND event_id = $2 AND stat = 10",
                [product.id, event_id]
            );
            if (!rental) {
                results.push({ code, product: product.name, status: "nicht verliehen" });
                continue;
            }

            await db.runAsync("DELETE FROM rental WHERE id = $1", [rental.id]);
            await db.runAsync("UPDATE products SET stat = 10 WHERE id = $1", [product.id]);
            results.push({ code, product: product.name, status: "storniert" });
        }
        res.json({ message: "Storno abgeschlossen", results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Update failed" });
    }
});

// GET /api/rentals/:event_id
router.get("/:event_id", async (req, res) => {
    const event_id = parseInt(req.params.event_id, 10);
    try {
        const products = await db.allAsync(`
            SELECT p.name as pname, p.spezification, c.name as cname, r.stat, p.code
            FROM products p
            JOIN rental r ON p.id = r.product_id
            JOIN categories c ON c.id = p.category_id
            WHERE r.event_id = $1
        `, [event_id]);
        res.json(products);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Datenbankfehler" });
    }
});

module.exports = router;