const express = require("express");
const router = express.Router();
const { db } = require("../models/dbv");

router.get("/", async (req, res) => {
    try {
        const rows = await db.allAsync("SELECT * FROM products ORDER BY name");
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});
router.post("/", async (req, res) => {
    const { name, bez, Code, category_id, spezification, check_date } = req.body;

    if (!Code || isNaN(Code)) {
        return res.json({ message: `Barcode fehlt oder ungültig` });
    }

    try {
        // Prüfen, ob Barcode schon existiert
        const existing = await db.getAsync("SELECT id FROM products WHERE code = $1", [Code]);
        if (existing) {
            return res.json({ message: `Barcode bereits vergeben` });
        }

        // INSERT mit RETURNING id, um die neue ID zurückzubekommen
        const result = await db.runAsync(
            `INSERT INTO products (name, stat, bez, code, category_id, spezification, check_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [name, 10, bez, Code, category_id, spezification, check_date]
        );

        res.json({
            message: `Produkt "${name}" erfolgreich angelegt`,
            id: result.rows[0].id
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Insert failed" });
    }
});
router.delete("/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10); // <- WICHTIG: String → Zahl
    if (isNaN(id)) return res.status(400).json({ error: "Ungültige ID" });

    try {
        // Prüfen, ob Produkt verliehen ist
        const rent = await db.getAsync(
            "SELECT id FROM products WHERE id = $1 AND stat = $2",
            [id,"90"]
        );

        if (rent) {
            return res.json({ message: "Kann nicht gelöscht werden, Produkt verliehen" });
        }

        // Wenn nicht verliehen, löschen
        await db.runAsync("DELETE FROM products WHERE id = $1", [id]);
        res.json({ message: "Produkt gelöscht" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Delete failed" });
    }
});

router.put("/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10); // <- WICHTIG: String → Zahl
    const { check_date } = req.body;

    try {
        // Prüfen, ob das Produkt verliehen ist (stat = 90)
        const rent = await db.getAsync(
            "SELECT id FROM products WHERE id = $1 AND stat = $2",
            [id,"90"]
        );

        if (rent) {
            return res.json({ message: "Kann nicht geprüft werden, Produkt verliehen" });
        }

        // Wenn nicht verliehen, Check Date aktualisieren
        await db.runAsync(
            "UPDATE products SET check_date = $1 WHERE id = $2",
            [check_date, id]
        );

        res.json({ message: "Check Date aktualisiert" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Update failed" });
    }
});
module.exports = router;