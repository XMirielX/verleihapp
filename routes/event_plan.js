const express = require("express");
const router = express.Router();

const { db } = require("../models/dbv");

// GET Planung eines Events
router.get("/:eventId", async (req, res) => {
    const eventId = req.params.eventId;

    try {
        const rows = await db.allAsync(
            `
            SELECT
                ep.id,
                ep.event_id,
                ep.material_id,
                ep.quantity,
                ep.comment,
                mt.name,
                mt.specification,
                c.name AS category
            FROM event_plan ep
            JOIN material_typ mt ON mt.id = ep.material_id
            LEFT JOIN categories c ON c.id = mt.category_id
            WHERE ep.event_id = ?
            ORDER BY c.name, mt.name, mt.specification
            `,
            [eventId]
        );

        res.json(rows);
    } catch (err) {
        console.error("GET EVENT PLAN ERROR:", err);
        res.status(500).json({ error: "Datenbankfehler" });
    }
});

// Planung speichern
router.post("/", async (req, res) => {
    const { event_id, items = [] } = req.body;

    if (!event_id) {
        return res.status(400).json({ error: "event_id fehlt" });
    }

    try {
        await db.runAsync(
            `
            DELETE FROM event_plan
            WHERE event_id = ?
            `,
            [event_id]
        );

        for (const item of items) {
            if (Number(item.quantity) > 0) {
                await db.runAsync(
                    `
                    INSERT INTO event_plan
                    (
                        event_id,
                        material_id,
                        quantity
                    )
                    VALUES (?, ?, ?)
                    `,
                    [
                        event_id,
                        item.material_id,
                        item.quantity
                    ]
                );
            }
        }

        res.json({
            success: true,
            message: "Planung gespeichert"
        });
    } catch (err) {
        console.error("SAVE EVENT PLAN ERROR:", err);
        res.status(500).json({ error: "Fehler beim Speichern" });
    }
});

module.exports = router;
