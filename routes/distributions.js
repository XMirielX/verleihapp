const express = require("express");
const router = express.Router();

const { db } = require("../models/dbv");


// GET alle Distribution Items
router.get("/", async (req, res) => {
    try {
        const rows = await db.allAsync(`
            SELECT 
                distribution_items.*,
                products.name AS product_name,
                products.code AS product_code
            FROM distribution_items
            JOIN products
                ON products.id = distribution_items.product_id
            ORDER BY products.bez
        `);

        res.json(rows);

    } catch (err) {
        console.error("GET DISTRIBUTION ERROR:", err);
        res.status(500).json({
            error: "Fehler beim Laden der Distributionen"
        });
    }
});


// GET einzelne Distribution
router.get("/:id", async (req, res) => {

    try {

        const item = await db.getAsync(`
            SELECT 
                distribution_items.*,
                products.name AS product_name
            FROM distribution_items
            JOIN products
                ON products.id = distribution_items.product_id
            WHERE distribution_items.id = ?
        `, [req.params.id]);


        if (!item) {
            return res.status(404).json({
                error: "Distribution nicht gefunden"
            });
        }

        res.json(item);

    } catch (err) {
        console.error("GET DISTRIBUTION ITEM ERROR:", err);
        res.status(500).json({
            error: "Fehler beim Laden"
        });
    }

});


// POST neue Distribution anlegen
router.post("/", async (req, res) => {

    try {

        const {
            product_id,
            input,
            cable,
            schuko,
            cee16,
            cee32,
            cee63
        } = req.body;


        // Prüfen ob Produkt bereits existiert
        const existing = await db.getAsync(`
            SELECT id
            FROM distribution_items
            WHERE product_id = ?
        `, [product_id]);


        if (existing) {
            return res.status(400).json({
                error: "Dieses Produkt ist bereits als Distribution angelegt"
            });
        }


        const result = await db.runAsync(`
            INSERT INTO distribution_items
            (
                product_id,
                input,
                cable,
                schuko,
                cee16,
                cee32,
                cee63
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
            product_id,
            input,
            cable,
            schuko || 0,
            cee16 || 0,
            cee32 || 0,
            cee63 || 0
        ]);


        res.json({
            success: true,
            id: result.lastID
        });


    } catch (err) {

        console.error("POST DISTRIBUTION ERROR:", err);

        res.status(500).json({
            error: "Fehler beim Erstellen"
        });

    }

});



// PUT Distribution ändern
router.put("/:id", async (req, res) => {

    try {

        const {
            input,
            cable,
            schuko,
            cee16,
            cee32,
            cee63,
            active
        } = req.body;


        await db.runAsync(`
            UPDATE distribution_items
            SET
                input = ?,
                cable = ?,
                schuko = ?,
                cee16 = ?,
                cee32 = ?,
                cee63 = ?,
                active = ?
            WHERE id = ?
        `,
        [
            input,
            cable,
            schuko || 0,
            cee16 || 0,
            cee32 || 0,
            cee63 || 0,
            active ?? 1,
            req.params.id
        ]);


        res.json({
            success: true
        });


    } catch (err) {

        console.error("PUT DISTRIBUTION ERROR:", err);

        res.status(500).json({
            error: "Fehler beim Speichern"
        });

    }

});



// DELETE Distribution
router.delete("/:id", async (req, res) => {

    try {

        await db.runAsync(`
            DELETE FROM distribution_items
            WHERE id = ?
        `,
        [req.params.id]);


        res.json({
            success: true
        });


    } catch (err) {

        console.error("DELETE DISTRIBUTION ERROR:", err);

        res.status(500).json({
            error: "Fehler beim Löschen"
        });

    }

});


module.exports = router;