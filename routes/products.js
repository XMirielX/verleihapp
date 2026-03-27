const express = require("express");
const router = express.Router();
const db = require("../models/dbv");

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

// POST /api/products
router.post("/", async (req, res) => {
    const { name, bez, Code, category_id, spezification, check_date } = req.body;
    // eigene runAsync-Funktion für INSERT, damit lastID funktioniert
    const runAsync = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID });
            });
        });
    };
    if (!Code || isNaN(Code)) {
        res.json({ message: `Barcode bereit vergeben` });
    }
    const existing = await db.getAsync("SELECT id FROM products WHERE Code = ?", [Code]);
    if (existing) {
        res.json({ message: `Barcode bereit vergeben` });
    }
    if (Code || !existing) {
        try {
            const result = await runAsync(
                `INSERT INTO products (name, stat, bez, Code, category_id, spezification, check_date)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [name, 10, bez, Code, category_id, spezification, check_date]
            );
            res.json({
                message: `Produkt "${name}" erfolgreich angelegt`,
                id: result.lastID
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Insert failed" });
        }
    }
});

// DELETE /api/products/:id
router.delete("/:id", async (req, res) => {
    const id = req.params.id;
    const rent = await db.getAsync(
        "SELECT rowid as id FROM products WHERE id = ? and stat = '90'",
        [id]
    );
    if (rent) {
        res.json({ message: "Kann nicht gelöscht werden, Produkt verliehen" });
    }
    if (!rent) {
        try {
            await db.runAsync("DELETE FROM products WHERE id = ?", [id]);
            res.json({ message: "Produkt gelöscht" });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Delete failed" });
        }
    }
});

// PUT /api/products/:id
router.put("/:id", async (req, res) => {
    const id = req.params.id;
    const { check_date } = req.body;
    const rent = await db.getAsync(
        "SELECT rowid as id FROM products WHERE id = ? and stat = '90'",
        [id]
    );
    if (rent) {
        res.json({ message: "Kann nicht geprüft werden, Produkt verliehen" });
    }
    if (!rent) {
        try {
            await db.runAsync("UPDATE products SET check_date = ? WHERE id = ?", [check_date, id]);
            res.json({ message: "Check Date aktualisiert" });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Update failed" });
        }
    }
});
module.exports = router;