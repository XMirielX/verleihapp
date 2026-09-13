const express = require("express");
const router = express.Router();
const { db } = require("../models/dbv");
const productDetailCache = {};

// POST /api/rentals
// Body: { event_id: 1, Codes: [123, 456] }

// POST /api/rentals
// Body: { event_id: 1, Codes: [123, 456] }
router.post("/", async (req, res) => {
  const { event_id, Codes } = req.body;

  if (!event_id || !Codes || !Codes.length) {
    return res.status(400).json({ error: "Missing data" });
  }

  console.log("Aktive Events:", event_id);

  const results = [];

  try {
    for (const rawCode of Codes) {
      const Code = parseInt(rawCode);

      // Produkt suchen
      const product = await db.getAsync(
        "SELECT id, name FROM products WHERE Code = ?",
        [Code],
      );

      if (!product) {
        results.push({
          Code,
          status: "nicht gefunden",
        });
        continue;
      }

      // Gibt es für dieses Event bereits einen Rental-Eintrag?
      const existingRental = await db.getAsync(
        `
          SELECT rowid as id, stat
          FROM rental
          WHERE product_id = ?
            AND event_id = ?
        `,
        [product.id, event_id],
      );

      // Bereits für dieses Event ausgeliehen
      if (existingRental && Number(existingRental.stat) === 10) {
        results.push({
          Code,
          product: product.name,
          status: "bereits verliehen",
        });
        continue;
      }

      // Für dieses Event bereits zurückgegeben:
      // denselben Rental-Eintrag wieder auf "ausgeliehen" setzen
      if (existingRental && Number(existingRental.stat) === 90) {
        await db.runAsync("UPDATE rental SET stat = 10 WHERE rowid = ?", [
          existingRental.id,
        ]);

        await db.runAsync("UPDATE products SET stat = 90 WHERE id = ?", [
          product.id,
        ]);

        await db.runAsync(
          "UPDATE event SET stat = 20 WHERE id = ? AND stat = 10",
          [event_id],
        );

        results.push({
          Code,
          product: product.name,
          status: "wird erneut ausgeliehen",
        });

        continue;
      }

      // Prüfen, ob das Produkt aktuell in einem anderen Event ausgeliehen ist
      const activeRental = await db.getAsync(
        `
          SELECT rowid as id, event_id
          FROM rental
          WHERE product_id = ?
            AND stat = 10
        `,
        [product.id],
      );

      if (activeRental) {
        results.push({
          Code,
          product: product.name,
          status: "bereits verliehen",
        });
        continue;
      }

      // Noch kein Rental für dieses Event vorhanden → neu anlegen
      await db.runAsync(
        "INSERT INTO rental(event_id, product_id, stat) VALUES (?, ?, ?)",
        [event_id, product.id, 10],
      );

      // Produkt als verliehen markieren
      await db.runAsync("UPDATE products SET stat = 90 WHERE id = ?", [
        product.id,
      ]);

      // Event auf "gestartet" setzen
      await db.runAsync(
        "UPDATE event SET stat = 20 WHERE id = ? AND stat = 10",
        [event_id],
      );

      results.push({
        Code,
        product: product.name,
        status: "wird ausgeliehen",
      });
    }

    res.json({
      message: "Fertig",
      results,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Insert failed",
    });
  }
});

router.post("/return", async (req, res) => {
  const { event_id, Codes } = req.body;

  if (!event_id || !Codes || !Codes.length) {
    return res.status(400).json({ error: "Missing data" });
  }
  const results = [];
  try {
    for (const rawCode of Codes) {
      //  Produkt suchen
      const Code = parseInt(rawCode);
      const product = await db.getAsync(
        "SELECT id, name FROM products WHERE Code = ?",
        [Code],
      );
      if (!product) {
        results.push({ Code, status: "Produkt nicht gefunden" });
        continue;
      }
      const rental = await db.getAsync(
        "SELECT rowid as id, * FROM rental WHERE product_id = ? AND event_id = ? AND stat = 10",
        [product.id, event_id],
      );
      if (!rental) {
        results.push({
          Code,
          product: product.name,
          status: "nicht verliehen",
        });
        continue;
      }
      // zurückgeben
      await db.runAsync("UPDATE rental SET stat = 90 WHERE rowid = ?", [
        rental.id,
      ]);
      // 🔓 Produkt wieder freigeben
      await db.runAsync("UPDATE products SET stat = 10 WHERE id = ?", [
        product.id,
      ]);
      results.push({ Code, product: product.name, status: "zurückgegeben" });
    }
    res.json({ message: "Fertig", results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Update failed" });
  }
});

router.post("/storno", async (req, res) => {
  const { event_id, Codes } = req.body;

  if (!event_id || !Codes || !Codes.length) {
    return res.status(400).json({ error: "Missing data" });
  }

  const results = [];

  try {
    for (const rawCode of Codes) {
      const Code = parseInt(rawCode);

      const product = await db.getAsync(
        "SELECT id, name FROM products WHERE Code = ?",
        [Code],
      );

      if (!product) {
        results.push({
          Code,
          status: "Produkt nicht gefunden",
        });
        continue;
      }

      const rental = await db.getAsync(
        `
          SELECT rowid as id
          FROM rental
          WHERE product_id = ?
            AND event_id = ?
      `,
        [product.id, event_id],
      );

      if (!rental) {
        results.push({
          Code,
          product: product.name,
          status: "nicht verliehen",
        });
        continue;
      }

      // Rental löschen
      await db.runAsync("DELETE FROM rental WHERE rowid = ?", [rental.id]);

      // Produkt wieder freigeben
      await db.runAsync("UPDATE products SET stat = 10 WHERE id = ?", [
        product.id,
      ]);

      results.push({
        Code,
        product: product.name,
        status: "storniert",
      });
    }

    // Nach ALLEN Stornos prüfen:
    const remainingRental = await db.getAsync(
      `
        SELECT rowid
        FROM rental
        WHERE event_id = ?
          AND stat = 10
        LIMIT 1
      `,
      [event_id],
    );

    // Keine offenen Rentals mehr → Event wieder aktiv
    if (!remainingRental) {
      await db.runAsync("UPDATE event SET stat = 10 WHERE id = ?", [event_id]);
    }

    res.json({
      message: "Storno abgeschlossen",
      results,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Update failed",
    });
  }
});
router.get("/:event_id", async (req, res) => {
  const event_id = parseInt(req.params.event_id, 10);

  try {
    const products = await db.allAsync(
      `
        SELECT
          mt.id as material_id,
          mt.name as pname,
          mt.specification as spezification,
          COUNT(DISTINCT p.id) as available,
          COALESCE(plan.planned, 0) as planned,

          COUNT(DISTINCT CASE
            WHEN r.stat = 10 THEN r.id
          END) as scanned,

          COUNT(DISTINCT CASE
            WHEN r.stat = 90 THEN r.id
          END) as returned

        FROM material_typ mt

        LEFT JOIN products p
          ON p.material_typ_id = mt.id

        LEFT JOIN (
          SELECT
            material_id,
            SUM(quantity) as planned
          FROM event_plan
          WHERE event_id = ?
          GROUP BY material_id
        ) plan
          ON plan.material_id = mt.id

        LEFT JOIN rental r
          ON r.product_id = p.id
          AND r.event_id = ?

        GROUP BY mt.id

        HAVING planned > 0
          OR scanned > 0
          OR returned > 0

        ORDER BY mt.category_id, mt.name
      `,
      [event_id, event_id],
    );

    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Datenbankfehler",
    });
  }
});

router.get("/:event_id/material/:material_id/products", async (req, res) => {
  const event_id = parseInt(req.params.event_id, 10);
  const material_id = parseInt(req.params.material_id, 10);

  try {
    const products = await db.allAsync(
      `
            SELECT
                p.id,
                p.bez as name,
                p.Code,
                r.stat as rental_stat
            FROM products p

            INNER JOIN rental r
                ON r.product_id = p.id
                AND r.event_id = ?

            WHERE p.material_typ_id = ?

            ORDER BY p.Code
        `,
      [event_id, material_id],
    );

    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Datenbankfehler",
    });
  }
});
module.exports = router;
