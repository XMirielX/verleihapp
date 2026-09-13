const express = require("express");
const router = express.Router();

const { db } = require("../models/dbv");


// =====================================================
// PREISKATEGORIEN LADEN
// GET /api/prices
// =====================================================

router.get("/", async (req, res) => {

    try {

        const priceCategories = await db.allAsync(`
            SELECT
                id,
                name,
                stat
            FROM price_categories
            ORDER BY name COLLATE NOCASE
        `);

        res.json(priceCategories);

    } catch (err) {

        console.error(
            "Fehler beim Laden der Preiskategorien:",
            err
        );

        res.status(500).json({
            error: "Preiskategorien konnten nicht geladen werden"
        });
    }
});


// =====================================================
// MATERIALPREISE LADEN
// GET /api/prices/material/:materialId
// =====================================================

router.get("/material/:materialId", async (req, res) => {

    const materialId = Number(req.params.materialId);

    if (!Number.isInteger(materialId)) {
        return res.status(400).json({
            error: "Ungültige Material-ID"
        });
    }

    try {

        const prices = await db.allAsync(`
            SELECT
                mp.id,
                mp.material_id,
                mp.price_category_id,
                pc.name AS price_category_name,
                mp.price
            FROM material_prices mp

            LEFT JOIN price_categories pc
                ON pc.id = mp.price_category_id

            WHERE mp.material_id = ?

            ORDER BY
                CASE
                    WHEN mp.price_category_id IS NULL THEN 0
                    ELSE 1
                END,
                pc.name COLLATE NOCASE
        `, [materialId]);

        res.json(prices);

    } catch (err) {

        console.error(
            "Fehler beim Laden der Materialpreise:",
            err
        );

        res.status(500).json({
            error: "Materialpreise konnten nicht geladen werden"
        });
    }
});


// =====================================================
// MATERIALPREISE SPEICHERN
// PUT /api/prices/material/:materialId
// =====================================================

router.put("/material/:materialId", async (req, res) => {

    const materialId = Number(req.params.materialId);
    const prices = req.body.prices;

    if (!Number.isInteger(materialId)) {
        return res.status(400).json({
            error: "Ungültige Material-ID"
        });
    }

    if (!Array.isArray(prices)) {
        return res.status(400).json({
            error: "Preise müssen als Array übergeben werden"
        });
    }

    try {

        // Prüfen, ob Material existiert
        const material = await db.getAsync(`
            SELECT id
            FROM material_typ
            WHERE id = ?
        `, [materialId]);

        if (!material) {
            return res.status(404).json({
                error: "Materialtyp nicht gefunden"
            });
        }


        // -------------------------------------------------
        // Transaktion
        // -------------------------------------------------

        await db.runAsync("BEGIN TRANSACTION");

        try {

            // Bestehende Preise dieses Materials löschen
            await db.runAsync(`
                DELETE FROM material_prices
                WHERE material_id = ?
            `, [materialId]);


            // Neue Preise speichern
            for (const item of prices) {

                const priceCategoryId =
                    item.price_category_id === null ||
                    item.price_category_id === "" ||
                    item.price_category_id === undefined
                        ? null
                        : Number(item.price_category_id);

                const price = Number(item.price);


                if (!Number.isFinite(price)) {
                    throw new Error(
                        `Ungültiger Preis für Preiskategorie ${priceCategoryId}`
                    );
                }


                if (
                    priceCategoryId !== null &&
                    !Number.isInteger(priceCategoryId)
                ) {
                    throw new Error(
                        `Ungültige Preiskategorie: ${priceCategoryId}`
                    );
                }


                await db.runAsync(`
                    INSERT INTO material_prices (
                        material_id,
                        price_category_id,
                        price
                    )
                    VALUES (?, ?, ?)
                `, [
                    materialId,
                    priceCategoryId,
                    price
                ]);
            }


            await db.runAsync("COMMIT");

            res.json({
                success: true,
                message: "Materialpreise gespeichert"
            });

        } catch (err) {

            await db.runAsync("ROLLBACK");

            throw err;
        }

    } catch (err) {

        console.error(
            "Fehler beim Speichern der Materialpreise:",
            err
        );

        res.status(500).json({
            error: "Materialpreise konnten nicht gespeichert werden"
        });
    }
});


module.exports = router;