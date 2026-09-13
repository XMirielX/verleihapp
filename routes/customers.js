const express = require("express");
const router = express.Router();
const { db } = require("../models/dbv");

// =====================================================
// KUNDEN – ÜBERSICHT
// =====================================================
router.get("/", async (req, res) => {

    try {

        const customers = await db.allAsync(`
            SELECT
                c.id,
                c.name,
                c.street,
                c.plz,
                c.city,
                c.email,
                c.phone,
                c.price_category_id,
                c.knz_privat,
                pc.name AS price_category,
                c.stat
            FROM customers c
            LEFT JOIN price_categories pc
                ON pc.id = c.price_category_id
            ORDER BY c.name COLLATE NOCASE
        `);

        res.json(customers);

    } catch (err) {

        console.error("Fehler beim Laden der Kunden:", err);

        res.status(500).json({
            error: "Fehler beim Laden der Kunden"
        });
    }
});

// =====================================================
// KUNDE – EINZELN LADEN
// =====================================================
router.get("/:id", async (req, res) => {

    try {

        const customer = await db.getAsync(`
            SELECT
                c.id,
                c.name,
                c.street,
                c.plz,
                c.city,
                c.email,
                c.phone,
               s c.price_category_id,
                pc.name AS price_category,
                c.stat
            FROM customers c
            LEFT JOIN price_categories pc
                ON pc.id = c.price_category_id
            WHERE c.id = ?
        `, [req.params.id]);

        if (!customer) {
            return res.status(404).json({
                error: "Kunde nicht gefunden"
            });
        }

        res.json(customer);

    } catch (err) {

        console.error("Fehler beim Laden des Kunden:", err);

        res.status(500).json({
            error: "Fehler beim Laden des Kunden"
        });
    }
});


// =====================================================
// KUNDE – ANLEGEN
// =====================================================
router.post("/", async (req, res) => {

    try {

        const {
            name,
            street,
            plz,
            city,
            email,
            phone,
            price_category_id,
            knz_privat
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                error: "Name ist erforderlich"
            });
        }

        const result = await db.runAsync(`
            INSERT INTO customers (
                name,
                street,
                plz,
                city,
                email,
                phone,
                price_category_id,
                knz_privat,
                stat
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [
            name.trim(),
            street || "",
            plz || "",
            city || "",
            email || "",
            phone || "",
            price_category_id || null,
            knz_privat || 0
        ]);

        const customer = await db.getAsync(`
            SELECT
                c.id,
                c.name,
                c.street,
                c.plz,
                c.city,
                c.email,
                c.phone,
                c.price_category_id,
                pc.name AS price_category,
                c.stat,
                c.knz_privat
            FROM customers c
            LEFT JOIN price_categories pc
                ON pc.id = c.price_category_id
            WHERE c.id = ?
        `, [result.lastID]);

        res.status(201).json(customer);

    } catch (err) {

        console.error("Fehler beim Anlegen des Kunden:", err);

        res.status(500).json({
            error: "Kunde konnte nicht angelegt werden"
        });
    }
});


// =====================================================
// KUNDE – ÄNDERN
// =====================================================

router.put("/:id", async (req, res) => {

    try {

        const {
            name,
            street,
            plz,
            city,
            email,
            phone,
            price_category_id,
            knz_privat,
            stat
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                error: "Name ist erforderlich"
            });
        }

        const existing = await db.getAsync(`
            SELECT id
            FROM customers
            WHERE id = ?
        `, [req.params.id]);

        if (!existing) {
            return res.status(404).json({
                error: "Kunde nicht gefunden"
            });
        }

        await db.runAsync(`
            UPDATE customers
            SET
                name = ?,
                street = ?,
                plz = ?,
                city = ?,
                email = ?,
                phone = ?,
                price_category_id = ?,
                knz_privat = ?,
                stat = ?
            WHERE id = ?
        `, [
            name.trim(),
            street || "",
            plz || "",
            city || "",
            email || "",
            phone || "",
            price_category_id || null,
            knz_privat || 0,
            stat === 0 ? 0 : 1,
            req.params.id
        ]);

        const customer = await db.getAsync(`
            SELECT *
            FROM customers
            WHERE id = ?
        `, [req.params.id]);

        res.json(customer);

    } catch (err) {

        console.error("Fehler beim Ändern des Kunden:", err);

        res.status(500).json({
            error: "Kunde konnte nicht geändert werden"
        });
    }
});


// =====================================================
// KUNDE – DEAKTIVIEREN
// =====================================================

router.delete("/:id", async (req, res) => {

    try {

        const existing = await db.getAsync(`
            SELECT id
            FROM customers
            WHERE id = ?
        `, [req.params.id]);

        if (!existing) {
            return res.status(404).json({
                error: "Kunde nicht gefunden"
            });
        }

        await db.runAsync(`
            UPDATE customers
            SET stat = 0
            WHERE id = ?
        `, [req.params.id]);

        res.json({
            success: true,
            message: "Kunde wurde deaktiviert"
        });

    } catch (err) {

        console.error("Fehler beim Deaktivieren des Kunden:", err);

        res.status(500).json({
            error: "Kunde konnte nicht deaktiviert werden"
        });
    }
});


module.exports = router;