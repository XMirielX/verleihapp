const express = require("express");
const router = express.Router();
const { db } = require("../models/dbv");

// GET /api/events
router.get("/", async (req, res) => {
    try {
        const rows = await db.allAsync("SELECT * FROM event ORDER BY start DESC");
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// GET /api/events/active
router.get("/active", async (req, res) => {
    try {
        const rows = await db.allAsync("SELECT * FROM event WHERE stat = '10'");
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// POST /api/events
router.post("/", async (req, res) => {
    const { name, stat, costumer, start, ende } = req.body;
    try {
        const result = await db.getAsync(
            `INSERT INTO event (name, stat, costumer, start, ende)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [name, stat, costumer, start, ende]
        );
        res.json({ id: result.id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Insert failed" });
    }
});

// DELETE /api/events/:id
router.delete("/:id", async (req, res) => {
    const id = req.params.id;
    try {
        const rent = await db.getAsync(
            "SELECT id FROM rental WHERE event_id = $1 LIMIT 1",
            [id]
        );
        if (rent) {
            return res.json({ message: "Kann nicht gelöscht werden, schon verwendet" });
        }
        await db.runAsync("DELETE FROM event WHERE id = $1", [id]);
        res.json({ message: "Event gelöscht" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Delete failed" });
    }
});

// PUT /api/events/:id/close
router.put("/:id/close", async (req, res) => {
    const event_id = req.params.id;
    try {
        await db.runAsync("UPDATE event SET stat = 90 WHERE id = $1", [event_id]);
        await db.runAsync("UPDATE rental SET stat = 20 WHERE event_id = $1 AND stat = 10", [event_id]);
        res.json({ message: "Event erfolgreich abgeschlossen" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Event konnte nicht abgeschlossen werden" });
    }
});

// GET /api/events/:id/export
router.get("/:id/export", async (req, res) => {
    const event_id = req.params.id;
    try {
        const event = await db.getAsync("SELECT name, start, ende FROM event WHERE id = $1", [event_id]);
        if (!event) return res.status(404).json({ error: "Event nicht gefunden" });

        const allRows = await db.allAsync(`
            SELECT c.name AS category, p.name AS product, p.spezification, COUNT(*) AS amount
            FROM rental r
            JOIN products p ON r.product_id = p.id
            JOIN categories c ON p.category_id = c.id
            WHERE r.event_id = $1
            GROUP BY c.name, p.name, p.spezification
            ORDER BY c.name, p.name, p.spezification
        `, [event_id]);

        const missingRows = await db.allAsync(`
            SELECT c.name AS category, p.name AS product, p.spezification, COUNT(*) AS amount
            FROM rental r
            JOIN products p ON r.product_id = p.id
            JOIN categories c ON p.category_id = c.id
            WHERE r.event_id = $1 AND r.stat = 20
            GROUP BY c.name, p.name, p.spezification
            ORDER BY c.name, p.name, p.spezification
        `, [event_id]);

        const csvLines = [];
        csvLines.push(`Event: ${event.name}, Start: ${event.start}, Ende: ${event.ende}`);
        csvLines.push("");
        csvLines.push("Alle Artikel");
        csvLines.push("Kategorie,Produkt,Spezifikation,Menge");
        allRows.forEach(r => csvLines.push(`${r.category},${r.product},${r.spezification || "-"},${r.amount}`));
        if (missingRows.length > 0) {
            csvLines.push("");
            csvLines.push("Fehlende Artikel");
            csvLines.push("Kategorie,Produkt,Spezifikation,Menge");
            missingRows.forEach(r => csvLines.push(`${r.category},${r.product},${r.spezification || "-"},${r.amount}`));
        }

        const csv = csvLines.join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=event_${event_id}.csv`);
        res.send(csv);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "CSV Export fehlgeschlagen" });
    }
});

module.exports = router;