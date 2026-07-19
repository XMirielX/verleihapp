const express = require("express");
const router = express.Router();

const { db } = require("../models/dbv");

//
// GET all material types
//
router.get("/", async (req, res) => {
    try {
        const rows = await db.allAsync(`
            SELECT mt.*, c.name as category_name
            FROM material_typ mt
            JOIN categories c ON c.id = mt.category_id
            ORDER BY mt.id DESC
        `);

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Fehler beim Laden der Materialtypen" });
    }
});

//
// CREATE material type
//
router.post("/", async (req, res) => {
    try {
        const { name, specification, description, category_id } = req.body;

        if (!name || !category_id) {
            return res.status(400).json({
                error: "Name und Kategorie sind erforderlich"
            });
        }

        const existing = await db.getAsync(
            `SELECT id FROM material_typ
             WHERE name = ? AND specification = ? AND category_id = ?`,
            [name, specification || null, category_id]
        );

        if (existing) {
            return res.status(409).json({
                error: "Material existiert bereits"
            });
        }

        const result = await db.runAsync(`
            INSERT INTO material_typ (name, specification, description, category_id)
            VALUES (?, ?, ?, ?)
        `, [
            name,
            specification || null,
            description || null,
            category_id
        ]);

        return res.status(200).json({
            ok: true,
            id: result.lastID,
            message: "Materialtyp erstellt"
        });

    } catch (err) {
        console.error("POST MATERIAL ERROR:", err);

        return res.status(500).json({
            error: "Serverfehler beim Erstellen"
        });
    }
});

//
// DELETE material type
//
router.delete("/:id", async (req, res) => {
    try {
        const id = req.params.id;

        await db.runAsync(`
            DELETE FROM material_typ WHERE id = ?
        `, [id]);

        res.json({ message: "Gelöscht" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Fehler beim Löschen" });
    }
});

//
// UPDATE material type (optional aber sinnvoll)
//
router.put("/:id", async (req, res) => {
    const id = req.params.id;
    const { name, specification, description, category_id, active } = req.body;

    try {
        const material = await db.getAsync(
            "SELECT * FROM material_typ WHERE id = ?",
            [id]
        );

        if (!material) {
            return res.status(404).json({
                error: "Materialtyp nicht gefunden"
            });
        }

        const existing = await db.getAsync(
            `SELECT id FROM material_typ
             WHERE name = ? AND specification = ? AND category_id = ?
             AND id <> ?`,
            [name, specification || null, category_id, id]
        );

        if (existing) {
            return res.status(400).json({
                error: "Materialtyp bereits vorhanden"
            });
        }

        await db.runAsync(`
            UPDATE material_typ
            SET name = ?,
                specification = ?,
                description = ?,
                category_id = ?,
                active = ?
            WHERE id = ?
        `, [
            name,
            specification || null,
            description || null,
            category_id,
            active ?? 1,
            id
        ]);

        return res.json({
            message: `Materialtyp "${name}" aktualisiert`
        });

    } catch (err) {
        console.error("MATERIAL PUT ERROR:", err);

        return res.status(500).json({
            error: "Update fehlgeschlagen"
        });
    }
});

module.exports = router;