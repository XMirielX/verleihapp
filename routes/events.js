const express = require("express");
const router = express.Router();
const { db } = require("../models/dbv");

// GET /api/event
router.get("/", async (req, res) => {
    try {
        const rows = await db.allAsync("SELECT * FROM event");
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

    // eigene runAsync-Funktion für INSERT, damit lastID funktioniert
    const runAsync = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID });
            });
        });
    };
    console.log(req.body)
    try {
        const result = await runAsync(
            `INSERT INTO event ( name, stat, costumer , start, ende)
                         VALUES (?, ?, ?, ?, ?)`,
            [name, stat, costumer, start, ende]
        );
        res.json({ id: result.lastID });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Insert failed" });
    }
});

// DELETE /api/events/:id
router.delete("/:id", async (req, res) => {
    const id = req.params.id;
    const rent = await db.getAsync(
        "SELECT rowid as id FROM rental WHERE event_id = ?",
        [id]
    );
    if (rent) {
        console.log("Event schon mit Verleih"); // Debug, um zu prüfe
        res.json({ message: "Kann nicht gelöscht werden, schon verwendet" });

    }
    if (!rent){
    try {
        await db.runAsync("DELETE FROM event WHERE id = ?", [id]);
        res.json({ message: "Event gelöscht" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Delete failed" });
    }}
});

// GET /api/products
router.get("/products", async (req, res) => {
    try {
        const products = await db.allAsync("SELECT * FROM products");
        res.json(products);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});
// PUT /api/events/:id/close
router.put("/:id/close", async (req, res) => {
    const event_id = req.params.id;

    try {
        // 1. Event auf abgeschlossen setzen
        await db.runAsync(
            "UPDATE event SET stat = 90 WHERE id = ?",
            [event_id]
        );

        // 2. Alle offenen Rentals auf "fehlt" setzen
        await db.runAsync(
            "UPDATE rental SET stat = 20 WHERE event_id = ? AND stat = 10",
            [event_id]
        );

        res.json({ message: "Event erfolgreich abgeschlossen" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Event konnte nicht abgeschlossen werden" });
    }
});

router.get("/:id/export", async (req, res) => {
    const event_id = req.params.id;

    try {
        // Eventinfos
        const event = await db.getAsync(`SELECT name, start, ende FROM event WHERE id = ?`, [event_id]);
        if (!event) return res.status(404).json({ error: "Event nicht gefunden" });

        // Alle Rentals aggregieren
        const allRows = await db.allAsync(`
            SELECT 
                c.name AS category,
                p.name AS product,
                p.spezification,
                COUNT(*) AS amount
            FROM rental r
            JOIN products p ON r.product_id = p.id
            JOIN category c ON p.category_id = c.id
            WHERE r.event_id = ?
            GROUP BY c.name, p.name, p.spezification
            ORDER BY c.name, p.name, p.spezification
        `, [event_id]);

        // Nur fehlende Artikel (stat = 20)
        const missingRows = await db.allAsync(`
            SELECT 
                c.name AS category,
                p.name AS product,
                p.spezification,
                COUNT(*) AS amount
            FROM rental r
            JOIN products p ON r.product_id = p.id
            JOIN category c ON p.category_id = c.id
            WHERE r.event_id = ? AND r.stat = 20
            GROUP BY c.name, p.name, p.spezification
            ORDER BY c.name, p.name, p.spezification
        `, [event_id]);

        const csvLines = [];

        // Eventinfo
        csvLines.push(`Event: ${event.name}, Start: ${event.start}, Ende: ${event.ende}`);
        csvLines.push(""); // Leerzeile

        // Alle Artikel
        csvLines.push("Alle Artikel");
        csvLines.push("Kategorie,Produkt,Spezifikation,Menge");
        allRows.forEach(r => {
            csvLines.push(`${r.category},${r.product},${r.spezification || "-"},${r.amount}`);
        });

        csvLines.push(""); // Leerzeile

        // Fehlende Artikel
        if (missingRows.length > 0) {
            csvLines.push("Fehlende Artikel");
            csvLines.push("Kategorie,Produkt,Spezifikation,Menge");
            missingRows.forEach(r => {
                csvLines.push(`${r.category},${r.product},${r.spezification || "-"},${r.amount}`);
            });
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
