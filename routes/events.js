const express = require("express");
const router = express.Router();
const { db } = require("../models/dbv");

// =====================================================
// GET /api/events
// =====================================================
router.get("/", async (req, res) => {
  try {
    const rows = await db.allAsync(`
            SELECT
                event.*,
                customers.name AS customer_name
            FROM event
            LEFT JOIN customers
                ON event.customer_id = customers.id
        `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// =====================================================
// GET /api/events/active
// =====================================================
router.get("/active", async (req, res) => {
  try {
    const rows = await db.allAsync(`
            SELECT
                event.*,
                customers.name AS customer_name
            FROM event
            LEFT JOIN customers
                ON event.customer_id = customers.id
            WHERE event.stat = '10'
        `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// =====================================================
// POST /api/events
// =====================================================
router.post("/", async (req, res) => {
  const { name, stat, customer_id, start, ende } = req.body;

  // Leerer Wert wird zu NULL
  const customerId = customer_id ? Number(customer_id) : null;

  // eigene runAsync-Funktion für INSERT,
  // damit lastID funktioniert
  const runAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            lastID: this.lastID,
          });
        }
      });
    });
  };

  console.log(req.body);

  try {
    const result = await runAsync(
      `
            INSERT INTO event (
                name,
                stat,
                customer_id,
                start,
                ende
            )
            VALUES (?, ?, ?, ?, ?)
            `,
      [name, stat, customerId, start, ende],
    );

    res.json({
      id: result.lastID,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Insert failed",
    });
  }
});

// =====================================================
// DELETE /api/events/:id
// =====================================================
router.delete("/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const event = await db.getAsync("SELECT id, stat FROM event WHERE id = ?", [
      id,
    ]);

    if (!event) {
      return res.status(404).json({
        error: "Event nicht gefunden",
      });
    }

    if (Number(event.stat) !== 10) {
      return res.status(400).json({
        error:
          "Das Event kann nicht gelöscht werden, da es bereits gestartet oder abgeschlossen ist.",
      });
    }

    await db.runAsync("DELETE FROM event WHERE id = ?", [id]);

    res.json({
      message: "Event gelöscht",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Delete failed",
    });
  }
});
// =====================================================
// GET /api/events/products
// =====================================================
router.get("/products", async (req, res) => {
  try {
    const products = await db.allAsync("SELECT * FROM products");

    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Database error",
    });
  }
});

// =====================================================
// GET /api/events/:id
// =====================================================
router.get("/:id", async (req, res) => {
  try {
    const event = await db.getAsync(
      `
            SELECT
                event.*,
                customers.name AS customer_name
            FROM event
            LEFT JOIN customers
                ON event.customer_id = customers.id
            WHERE event.id = ?
            `,
      [req.params.id],
    );

    if (!event) {
      return res.status(404).json({
        error: "Event nicht gefunden",
      });
    }

    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Database error",
    });
  }
});


// =====================================================
// PUT /api/events/:id
router.put("/:id", async (req, res) => {
  const id = req.params.id;
  const { name, customer_id, start, ende } = req.body;

  try {
    // Event prüfen
    const event = await db.getAsync("SELECT id, stat FROM event WHERE id = ?", [
      id,
    ]);

    if (!event) {
      return res.status(404).json({
        error: "Event nicht gefunden",
      });
    }

    // Kunde darf leer sein
    const customerId = customer_id || null;

    // Event aktualisieren
    // WICHTIG:
    // stat wird absichtlich NICHT geändert.
    await db.runAsync(
      `
      UPDATE event
      SET
        name = ?,
        customer_id = ?,
        start = ?,
        ende = ?
      WHERE id = ?
      `,
      [name, customerId, start, ende, id],
    );

    // Aktualisiertes Event zurückgeben
    const updatedEvent = await db.getAsync(
      `
      SELECT
        event.*,
        customers.name AS customer_name
      FROM event
      LEFT JOIN customers
        ON event.customer_id = customers.id
      WHERE event.id = ?
      `,
      [id],
    );

    res.json({
      message: "Event erfolgreich aktualisiert",
      event: updatedEvent,
    });
  } catch (err) {
    console.error("Fehler beim Bearbeiten des Events:", err);

    res.status(500).json({
      error: "Event konnte nicht aktualisiert werden",
    });
  }
});

// =====================================================
// PUT /api/events/:id/close
// =====================================================
router.put("/:id/close", async (req, res) => {
  const event_id = req.params.id;

  try {
    // Event prüfen
    const event = await db.getAsync("SELECT id, stat FROM event WHERE id = ?", [
      event_id,
    ]);

    if (!event) {
      return res.status(404).json({
        error: "Event nicht gefunden",
      });
    }

    // Alle noch ausgeliehenen Artikel dieses Events zurückgeben
    const openRentals = await db.allAsync(
      `
        SELECT rowid as id, product_id
        FROM rental
        WHERE event_id = ?
          AND stat = 10
      `,
      [event_id],
    );

    // Rentals auf zurückgegeben setzen
    if (openRentals.length > 0) {
       return res.status(404).json({
        error: "Noch nicht alles zurückgenommen",
      });
    }

    // Event abschließen
    await db.runAsync("UPDATE event SET stat = 90 WHERE id = ?", [event_id]);

    res.json({
      message:
        openRentals.length > 0
          ? `Event erfolgreich abgeschlossen. ${openRentals.length} Artikel wurden als zurückgegeben markiert.`
          : "Event erfolgreich abgeschlossen. Alle Artikel waren bereits zurückgegeben.",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Event konnte nicht abgeschlossen werden",
    });
  }
});

// =====================================================
// GET /api/events/:id/export
// =====================================================
router.get("/:id/export", async (req, res) => {
  const event_id = req.params.id;

  try {
    // -------------------------------------------------
    // Eventinfos
    // -------------------------------------------------
    const event = await db.getAsync(
      `
            SELECT
                event.name,
                event.start,
                event.ende,
                customers.name AS customer_name
            FROM event
            LEFT JOIN customers
                ON event.customer_id = customers.id
            WHERE event.id = ?
            `,
      [event_id],
    );

    if (!event) {
      return res.status(404).json({
        error: "Event nicht gefunden",
      });
    }

    // -------------------------------------------------
    // Alle Rentals aggregieren
    // -------------------------------------------------
    const allRows = await db.allAsync(
      `
            SELECT
                c.name AS category,
                p.name AS product,
                p.spezification,
                COUNT(*) AS amount
            FROM rental r
            JOIN products p
                ON r.product_id = p.id
            LEFT JOIN categories c
                ON p.category_id = c.id
            WHERE r.event_id = ?
            GROUP BY
                c.name,
                p.name,
                p.spezification
            ORDER BY
                c.name,
                p.name,
                p.spezification
            `,
      [event_id],
    );

    // -------------------------------------------------
    // Nur fehlende Artikel
    // -------------------------------------------------
    const missingRows = await db.allAsync(
      `
            SELECT
                c.name AS category,
                p.name AS product,
                p.spezification,
                COUNT(*) AS amount
            FROM rental r
            JOIN products p
                ON r.product_id = p.id
            LEFT JOIN categories c
                ON p.category_id = c.id
            WHERE
                r.event_id = ?
                AND r.stat = 20
            GROUP BY
                c.name,
                p.name,
                p.spezification
            ORDER BY
                c.name,
                p.name,
                p.spezification
            `,
      [event_id],
    );

    // -------------------------------------------------
    // CSV erstellen
    // -------------------------------------------------
    const csvLines = [];

    // Eventinfo
    csvLines.push(
      `Event: ${event.name}, Kunde: ${event.customer_name || "-"}, Start: ${event.start}, Ende: ${event.ende}`,
    );

    csvLines.push("");

    // Alle Artikel
    csvLines.push("Alle Artikel");
    csvLines.push("Kategorie,Produkt,Spezifikation,Menge");

    allRows.forEach((r) => {
      csvLines.push(
        `${r.category},${r.product},${r.spezification || "-"},${r.amount}`,
      );
    });

    csvLines.push("");

    // Fehlende Artikel
    if (missingRows.length > 0) {
      csvLines.push("Fehlende Artikel");

      csvLines.push("Kategorie,Produkt,Spezifikation,Menge");

      missingRows.forEach((r) => {
        csvLines.push(
          `${r.category},${r.product},${r.spezification || "-"},${r.amount}`,
        );
      });
    }

    const csv = csvLines.join("\n");

    res.setHeader("Content-Type", "text/csv");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=event_${event_id}.csv`,
    );

    res.send(csv);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "CSV Export fehlgeschlagen",
    });
  }
});

module.exports = router;
