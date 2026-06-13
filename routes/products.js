const express = require("express");
const router = express.Router();
const { db } = require("../models/dbv");

// GET /api/products
router.get("/", async (req, res) => {
    try {
        const rows = await db.allAsync("SELECT * FROM products");
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
    try {
        const row = await db.getAsync("SELECT * FROM products WHERE id = ?", [req.params.id]);
        if (!row) return res.status(404).json({ error: "Produkt nicht gefunden" });
        res.json(row);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// POST /api/products
router.post("/", async (req, res) => {
    const { name, bez, code, category_id, spezification, check_date } = req.body;

    const runAsync = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID });
            });
        });
    };

    if (!code || isNaN(code)) {
        return res.status(400).json({ error: "Ungueltiger Barcode" });
    }

    try {
        const existing = await db.getAsync("SELECT id FROM products WHERE code = ?", [code]);
        if (existing) {
            return res.status(400).json({ error: "Barcode bereits vergeben" });
        }

        const result = await runAsync(
            `INSERT INTO products (name, stat, bez, code, category_id, spezification, check_date)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, 10, bez, code, category_id, spezification, check_date]
        );

        res.json({
            message: `Produkt "${name}" erfolgreich angelegt`,
            id: result.lastID
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Insert failed" });
    }
});

// DELETE /api/products/:id
router.delete("/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const rent = await db.getAsync(
            "SELECT rowid as id FROM products WHERE id = ? and stat = '90'",
            [id]
        );
        if (rent) {
            return res.json({ message: "Kann nicht geloescht werden, Produkt verliehen" });
        }

        await db.runAsync("DELETE FROM products WHERE id = ?", [id]);
        res.json({ message: "Produkt geloescht" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Delete failed" });
    }
});

// PUT /api/products/:id
router.put("/:id", async (req, res) => {
    const id = req.params.id;
    const { name, bez, code, category_id, spezification, check_date } = req.body;

    try {
        const product = await db.getAsync("SELECT * FROM products WHERE id = ?", [id]);
        if (!product) return res.status(404).json({ error: "Produkt nicht gefunden" });

        const isCheckOnly = Object.keys(req.body).length === 1 && check_date !== undefined;

        if (isCheckOnly) {
            const rent = await db.getAsync(
                "SELECT rowid as id FROM products WHERE id = ? and stat = '90'",
                [id]
            );
            if (rent) {
                return res.json({ message: "Kann nicht geprueft werden, Produkt verliehen" });
            }

            await db.runAsync("UPDATE products SET check_date = ? WHERE id = ?", [check_date, id]);
            return res.json({ message: "Check Date aktualisiert" });
        }

        if (!code || isNaN(code)) {
            return res.status(400).json({ error: "Ungueltiger Barcode" });
        }

        const existing = await db.getAsync(
            "SELECT id FROM products WHERE code = ? AND id <> ?",
            [code, id]
        );
        if (existing) {
            return res.status(400).json({ error: "Barcode bereits vergeben" });
        }

        await db.runAsync(
            `UPDATE products
             SET name = ?, bez = ?, code = ?, category_id = ?, spezification = ?, check_date = ?
             WHERE id = ?`,
            [name, bez, code, category_id, spezification, check_date, id]
        );
        res.json({ message: `Produkt "${name}" erfolgreich aktualisiert` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Update failed" });
    }
});

module.exports = router;
