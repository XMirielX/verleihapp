const express = require("express");
const router = express.Router();

const { db } = require("../models/dbv");
const { createInvoicePdf } = require("../services/invoicePdf");

// =====================================================
// PUT /api/invoices/:invoiceId/items/save
// Alle Rechnungspositionen gesammelt speichern
// =====================================================

router.put("/:invoiceId/items/save", async (req, res) => {
  const invoiceId = Number(req.params.invoiceId);
  const { items = [], deletedItemIds = [] } = req.body;

  if (!Number.isInteger(invoiceId)) {
    return res.status(400).json({ error: "Ungültige Rechnungs-ID." });
  }

  try {
    const invoice = await db.getAsync("SELECT id FROM invoices WHERE id = ?", [
      invoiceId,
    ]);

    if (!invoice) {
      return res.status(404).json({ error: "Rechnung nicht gefunden." });
    }

    await db.runAsync("BEGIN TRANSACTION");

    for (const itemId of deletedItemIds) {
      const id = Number(itemId);
      if (Number.isInteger(id)) {
        await db.runAsync(
          "DELETE FROM invoice_items WHERE id = ? AND invoice_id = ?",
          [id, invoiceId],
        );
      }
    }

    let sortOrder = 0;
    for (const item of items) {
      const description = String(item.description || "").trim();
      if (!description) continue;

      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const total = quantity * unitPrice;

      if (item.id) {
        await db.runAsync(
          `UPDATE invoice_items
           SET description = ?, quantity = ?, unit_price = ?, total = ?, sort_order = ?
           WHERE id = ? AND invoice_id = ?`,
          [
            description,
            quantity,
            unitPrice,
            total,
            sortOrder,
            Number(item.id),
            invoiceId,
          ],
        );
      } else {
        await db.runAsync(
          `INSERT INTO invoice_items
             (invoice_id, material_id, description, quantity, unit, unit_price, total, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invoiceId,
            item.material_id || null,
            description,
            quantity,
            item.unit || "Stück",
            unitPrice,
            total,
            sortOrder,
          ],
        );
      }

      sortOrder++;
    }

    await recalculateInvoice(invoiceId);
    await db.runAsync("COMMIT");

    res.json({ message: "Rechnungspositionen gespeichert." });
  } catch (err) {
    try {
      await db.runAsync("ROLLBACK");
    } catch (_) {}

    console.error("Fehler beim Speichern der Rechnungspositionen:", err);
    res
      .status(500)
      .json({ error: "Rechnungspositionen konnten nicht gespeichert werden." });
  }
});

// =====================================================
// GET /api/invoices/:invoiceId/pdf
// Rechnung als PDF erzeugen
// =====================================================

router.get("/:invoiceId/pdf", async (req, res) => {
  const invoiceId = Number(req.params.invoiceId);

  if (!Number.isInteger(invoiceId)) {
    return res.status(400).json({
      error: "Ungültige Rechnungs-ID.",
    });
  }

  try {
    // -------------------------------------------------
    // Rechnung laden
    // -------------------------------------------------

    const invoice = await db.getAsync(
      `
        SELECT *
        FROM invoices
        WHERE id = ?
        LIMIT 1
      `,
      [invoiceId],
    );

    if (!invoice) {
      return res.status(404).json({
        error: "Rechnung nicht gefunden.",
      });
    }

    // -------------------------------------------------
    // Positionen laden
    // -------------------------------------------------

    const items = await db.allAsync(
      `
        SELECT *
        FROM invoice_items
        WHERE invoice_id = ?
        ORDER BY sort_order ASC, id ASC
      `,
      [invoiceId],
    );

    // -------------------------------------------------
    // PDF erzeugen
    // -------------------------------------------------

    const pdf = await createInvoicePdf(invoice, items);

    const filename =
      `Rechnung-${invoice.invoice_number || invoice.id}.pdf`.replace(
        /[^a-zA-Z0-9._-]/g,
        "_",
      );

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    res.setHeader("Content-Length", pdf.length);

    res.send(pdf);
  } catch (err) {
    console.error("Fehler beim Erzeugen der Rechnungs-PDF:", err);

    res.status(500).json({
      error: "PDF konnte nicht erstellt werden.",
    });
  }
});
// =====================================================
// GET /api/invoices/event/:eventId
// Rechnung eines Events laden
// =====================================================

router.get("/event/:eventId", async (req, res) => {
  const eventId = Number(req.params.eventId);

  try {
    const invoice = await db.getAsync(
      `
            SELECT *
            FROM invoices
            WHERE event_id = ?
            LIMIT 1
            `,
      [eventId],
    );

    if (!invoice) {
      return res.json({
        invoice: null,
        items: [],
      });
    }

    const items = await db.allAsync(
      `
            SELECT *
            FROM invoice_items
            WHERE invoice_id = ?
            ORDER BY sort_order ASC, id ASC
            `,
      [invoice.id],
    );

    // Ein leerer Entwurf kann von einem früher abgebrochenen
    // Erstellungsvorgang stammen und wird erneut erzeugt.
    if (invoice.status === "draft" && items.length === 0) {
      return res.json({
        invoice: null,
        items: [],
      });
    }

    res.json({
      invoice,
      items,
    });
  } catch (err) {
    console.error("Fehler beim Laden der Rechnung:", err);

    res.status(500).json({
      error: "Rechnung konnte nicht geladen werden.",
    });
  }
});

// =====================================================
// POST /api/invoices/event/:eventId/create
// Rechnung aus Event erstellen
// =====================================================

router.post("/event/:eventId/create", async (req, res) => {
  const eventId = Number(req.params.eventId);

  try {
    // -------------------------------------------------
    // Prüfen, ob bereits eine Rechnung existiert
    // -------------------------------------------------

    const existingInvoice = await db.getAsync(
      `
        SELECT
          invoices.id,
          invoices.status,
          COUNT(invoice_items.id) AS item_count
        FROM invoices
        LEFT JOIN invoice_items
          ON invoice_items.invoice_id = invoices.id
        WHERE invoices.event_id = ?
        GROUP BY invoices.id
        LIMIT 1
      `,
      [eventId],
    );

    const incompleteInvoice =
      existingInvoice &&
      existingInvoice.status === "draft" &&
      Number(existingInvoice.item_count) === 0;

    if (existingInvoice && !incompleteInvoice) {
      return res.status(409).json({
        error: "Für dieses Event existiert bereits eine Rechnung.",
        invoice_id: existingInvoice.id,
      });
    }

    // -------------------------------------------------
    // Event + Kunde laden
    // -------------------------------------------------

    const event = await db.getAsync(
      `
        SELECT
          e.id,
          e.name,
          e.customer_id,
          e.start,
          e.ende,
          e.stat,

          c.name AS customer_name,
          c.street AS customer_address,
          c.plz AS customer_zip,
          c.city AS customer_city,
          c.email AS customer_email,
          c.price_category_id,
          c.knz_privat

        FROM event e

        LEFT JOIN customers c
          ON c.id = e.customer_id

        WHERE e.id = ?
      `,
      [eventId],
    );

    if (!event) {
      return res.status(404).json({
        error: "Event nicht gefunden.",
      });
    }

    if (!event.customer_id) {
      return res.status(400).json({
        error:
          "Für dieses Event ist kein Kunde hinterlegt. Bitte zuerst dem Event einen Kunden zuweisen.",
      });
    }

    if (Number(event.stat) !== 90) {
      return res.status(400).json({
        error:
          "Für dieses Event kann noch keine Rechnung erstellt werden. Das Event muss zuerst abgeschlossen werden.",
      });
    }

    // -------------------------------------------------
    // Rechnungsnummer
    // -------------------------------------------------

    const invoiceNumber = await generateInvoiceNumber();
    const today = new Date().toISOString().split("T")[0];

    // -------------------------------------------------
    // Kunden-Preiskategorie
    // -------------------------------------------------

    const priceCategoryId = event.price_category_id || null;
    const isPrivateCustomer = Number(event.knz_privat) === 1;

    // -------------------------------------------------
    // Transaktion starten
    // -------------------------------------------------

    await db.runAsync("BEGIN TRANSACTION");

    // -------------------------------------------------
    // Alten leeren Entwurf löschen
    // -------------------------------------------------

    if (incompleteInvoice) {
      await db.runAsync("DELETE FROM invoices WHERE id = ?", [
        existingInvoice.id,
      ]);
    }

    // -------------------------------------------------
    // Rechnungskopf erstellen
    // -------------------------------------------------

    const invoiceResult = await runAsync(
      `
        INSERT INTO invoices (
          invoice_number,
          customer_id,
          event_id,
          invoice_date,
          status,

          customer_name,
          customer_address,
          customer_zip,
          customer_city,
          customer_email,

          event_name,
          total,
          notes
        )
        VALUES (
          ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?, ?,
          ?,
          0,
          ?
        )
      `,
      [
        invoiceNumber,
        event.customer_id || null,
        eventId,

        today,
        "draft",

        event.customer_name || null,
        event.customer_address || null,
        event.customer_zip || null,
        event.customer_city || null,
        event.customer_email || null,

        event.name || "",

        null,
      ],
    );

    const invoiceId = invoiceResult.lastID;

    // -------------------------------------------------
    // Rentals des Events
    //
    // Produkte werden auf Materialebene zusammengefasst.
    //
    // Preislogik:
    //
    // 1. Standardpreis (price_category_id IS NULL)
    // 2. Falls kein Standardpreis vorhanden:
    //    Preis der Kunden-Preiskategorie
    // -------------------------------------------------

    const items = await db.allAsync(
      `
        SELECT
          mt.id AS material_id,
          mt.name AS material_name,

          COUNT(r.rowid) AS quantity,

COALESCE(
  (
    SELECT mp.price
    FROM material_prices mp
    WHERE
      mp.material_id = mt.id
      AND mp.price_category_id IS NULL
      AND mp.price > 0
    LIMIT 1
  ),
  (
    SELECT mp.price
    FROM material_prices mp
    WHERE
      mp.material_id = mt.id
      AND mp.price_category_id = ?
      AND mp.price > 0
    LIMIT 1
  )
) AS unit_price

        FROM rental r

        INNER JOIN products p
          ON p.id = r.product_id

        INNER JOIN material_typ mt
          ON mt.id = p.material_typ_id

        WHERE r.event_id = ?

        GROUP BY
          mt.id,
          mt.name

        ORDER BY
          mt.name
      `,
      [priceCategoryId, eventId],
    );

    // -------------------------------------------------
    // Rechnungspositionen erstellen
    // -------------------------------------------------

    let sortOrder = 0;

    for (const item of items) {
      const quantity = Number(item.quantity) || 0;

      const unitPrice = item.unit_price !== null ? Number(item.unit_price) : 0;

      const total = quantity * unitPrice;

      await db.runAsync(
        `
          INSERT INTO invoice_items (
            invoice_id,
            material_id,
            description,
            quantity,
            unit,
            unit_price,
            total,
            sort_order
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          invoiceId,
          item.material_id,
          item.material_name,
          quantity,
          "Stück",
          unitPrice,
          total,
          sortOrder,
        ],
      );

      sortOrder++;
    }

    // -------------------------------------------------
    // Privatkunden-Rabatt
    // -------------------------------------------------

    if (isPrivateCustomer) {
      await db.runAsync(
        `
          INSERT INTO invoice_items (
            invoice_id,
            material_id,
            description,
            quantity,
            unit,
            unit_price,
            total,
            sort_order
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [invoiceId, null, "Privatrabatt", 1, "Stück", -100, -100, sortOrder],
      );
    }

    // -------------------------------------------------
    // Rechnung neu berechnen
    // -------------------------------------------------

    // -------------------------------------------------
    // Event als "Rechnung vorhanden" markieren
    // -------------------------------------------------

    await db.runAsync(
      `
    UPDATE event
    SET stat = 95
    WHERE id = ?
  `,
      [eventId],
    );

    await recalculateInvoice(invoiceId);

    await db.runAsync("COMMIT");

    // Rechnung und Positionen direkt nach dem Erstellen laden
    const createdInvoice = await db.getAsync(
      `
    SELECT *
    FROM invoices
    WHERE id = ?
    LIMIT 1
  `,
      [invoiceId],
    );

    const createdItems = await db.allAsync(
      `
    SELECT *
    FROM invoice_items
    WHERE invoice_id = ?
    ORDER BY sort_order ASC, id ASC
  `,
      [invoiceId],
    );

    res.status(201).json({
      invoice_id: invoiceId,
      invoice: createdInvoice,
      items: createdItems,
    });
  } catch (err) {
    try {
      await db.runAsync("ROLLBACK");
    } catch (_) {
      // Es war noch keine Transaktion geöffnet.
    }

    console.error("Fehler beim Erstellen der Rechnung:", err);

    res.status(500).json({
      error: "Rechnung konnte nicht erstellt werden.",
    });
  }
});
// =====================================================
// PUT /api/invoices/:invoiceId/finalize
// Rechnung abschließen
// =====================================================

router.put("/:invoiceId/finalize", async (req, res) => {
  const invoiceId = Number(req.params.invoiceId);

  if (!Number.isInteger(invoiceId)) {
    return res.status(400).json({
      error: "Ungültige Rechnungs-ID.",
    });
  }

  try {
    const invoice = await db.getAsync(
      `SELECT id, status FROM invoices WHERE id = ?`,
      [invoiceId],
    );

    if (!invoice) {
      return res.status(404).json({
        error: "Rechnung nicht gefunden.",
      });
    }

    if (invoice.status === "final") {
      return res.json({
        message: "Rechnung ist bereits abgeschlossen.",
      });
    }

    await db.runAsync(
      `UPDATE invoices SET status = 'final', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [invoiceId],
    );

    res.json({
      message: "Rechnung abgeschlossen.",
    });
  } catch (err) {
    console.error("Fehler beim Abschließen der Rechnung:", err);

    res.status(500).json({
      error: "Rechnung konnte nicht abgeschlossen werden.",
    });
  }
});

// =====================================================
// RECHNUNGSDATEN ÄNDERN
// =====================================================

router.put("/:invoiceId", (req, res) => {
  const invoiceId = req.params.invoiceId;

  const {
    invoice_number,
    invoice_date,

    customer_name,
    customer_address,
    customer_zip,
    customer_city,
    customer_email,

    notes,
  } = req.body;

  if (!invoice_number || !invoice_date) {
    return res.status(400).json({
      error: "Rechnungsnummer und Rechnungsdatum sind erforderlich.",
    });
  }

  const sql = `
        UPDATE invoices

        SET
            invoice_number = ?,
            invoice_date = ?,

            customer_name = ?,
            customer_address = ?,
            customer_zip = ?,
            customer_city = ?,
            customer_email = ?,

            notes = ?,

            updated_at = CURRENT_TIMESTAMP

        WHERE id = ?
    `;

  db.run(
    sql,
    [
      invoice_number.trim(),
      invoice_date,

      customer_name || null,
      customer_address || null,
      customer_zip || null,
      customer_city || null,
      customer_email || null,

      notes || null,

      invoiceId,
    ],
    function (err) {
      if (err) {
        console.error("Fehler beim Ändern der Rechnung:", err);

        if (err.code === "SQLITE_CONSTRAINT") {
          return res.status(409).json({
            error: "Diese Rechnungsnummer existiert bereits.",
          });
        }

        return res.status(500).json({
          error: "Rechnung konnte nicht geändert werden.",
        });
      }

      if (!this.changes) {
        return res.status(404).json({
          error: "Rechnung nicht gefunden.",
        });
      }

      res.json({
        message: "Rechnung aktualisiert.",
      });
    },
  );
});
// =====================================================
// POST /api/invoices/:invoiceId/items
// Position hinzufügen
// =====================================================

router.post("/:invoiceId/items", async (req, res) => {
  const invoiceId = Number(req.params.invoiceId);

  const { material_id, description, quantity, unit_price } = req.body;

  if (!description || !description.trim()) {
    return res.status(400).json({
      error: "Beschreibung fehlt.",
    });
  }

  try {
    const invoice = await db.getAsync(
      `
                SELECT id
                FROM invoices
                WHERE id = ?
                `,
      [invoiceId],
    );

    if (!invoice) {
      return res.status(404).json({
        error: "Rechnung nicht gefunden.",
      });
    }

    const qty = Number(quantity) || 1;

    const price = Number(unit_price) || 0;

    const total = qty * price;

    const result = await runAsync(
      `
                INSERT INTO invoice_items (

                    invoice_id,
                    material_id,

                    description,

                    quantity,

                    unit_price,
                    total,

                    sort_order

                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
      [
        invoiceId,

        material_id || null,

        description.trim(),

        qty,

        price,

        total,

        999999,
      ],
    );

    await recalculateInvoice(invoiceId);

    res.status(201).json({
      id: result.lastID,
    });
  } catch (err) {
    console.error("Fehler beim Hinzufügen der Position:", err);

    res.status(500).json({
      error: "Position konnte nicht hinzugefügt werden.",
    });
  }
});

// =====================================================
// PUT /api/invoices/items/:itemId
// Position ändern
// =====================================================

router.put("/items/:itemId", async (req, res) => {
  const itemId = Number(req.params.itemId);

  const { description, quantity, unit_price } = req.body;

  if (!description || !description.trim()) {
    return res.status(400).json({
      error: "Beschreibung fehlt.",
    });
  }

  try {
    const item = await db.getAsync(
      `
                SELECT invoice_id
                FROM invoice_items
                WHERE id = ?
                `,
      [itemId],
    );

    if (!item) {
      return res.status(404).json({
        error: "Position nicht gefunden.",
      });
    }

    const qty = Number(quantity) || 0;

    const price = Number(unit_price) || 0;

    const total = qty * price;

    await db.runAsync(
      `
            UPDATE invoice_items

            SET

                description = ?,
                quantity = ?,
                unit_price = ?,
                total = ?

            WHERE id = ?
            `,
      [description.trim(), qty, price, total, itemId],
    );

    await recalculateInvoice(item.invoice_id);

    res.json({
      message: "Position geändert.",
    });
  } catch (err) {
    console.error("Fehler beim Ändern der Position:", err);

    res.status(500).json({
      error: "Position konnte nicht geändert werden.",
    });
  }
});

// =====================================================
// DELETE /api/invoices/items/:itemId
// Position löschen
// =====================================================

router.delete("/items/:itemId", async (req, res) => {
  const itemId = Number(req.params.itemId);

  try {
    const item = await db.getAsync(
      `
                SELECT invoice_id
                FROM invoice_items
                WHERE id = ?
                `,
      [itemId],
    );

    if (!item) {
      return res.status(404).json({
        error: "Position nicht gefunden.",
      });
    }

    await db.runAsync(
      `
            DELETE FROM invoice_items
            WHERE id = ?
            `,
      [itemId],
    );

    await recalculateInvoice(item.invoice_id);

    res.json({
      message: "Position gelöscht.",
    });
  } catch (err) {
    console.error("Fehler beim Löschen der Position:", err);

    res.status(500).json({
      error: "Position konnte nicht gelöscht werden.",
    });
  }
});

// =====================================================
// RECHNUNG NEU BERECHNEN
// =====================================================

async function recalculateInvoice(invoiceId) {
  const result = await db.getAsync(
    `
        SELECT
            COALESCE(SUM(total), 0) AS subtotal
        FROM invoice_items
        WHERE invoice_id = ?
        `,
    [invoiceId],
  );

  const subtotal = Number(result.subtotal) || 0;

  await db.runAsync(
    `
        UPDATE invoices

        SET
            total = ?,
            updated_at = CURRENT_TIMESTAMP

        WHERE id = ?
        `,
    [subtotal, invoiceId],
  );
}

// =====================================================
// HILFSFUNKTION FÜR INSERTS
// =====================================================

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
        return;
      }

      resolve({
        lastID: this.lastID,
        changes: this.changes,
      });
    });
  });
}

// =====================================================
// RECHNUNGSNUMMER
// =====================================================

async function generateInvoiceNumber() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const date = `${year}-${month}-${day}`;

  const invoices = await db.allAsync(
    `
        SELECT invoice_number
        FROM invoices
        WHERE invoice_number IS NOT NULL
        `,
  );

  let nextNumber = 1;

  for (const invoice of invoices) {
    const parts = invoice.invoice_number.split("-");

    if (parts.length === 4) {
      const number = parseInt(parts[0], 10);

      if (!isNaN(number) && number >= nextNumber) {
        nextNumber = number + 1;
      }
    }
  }

  return `${nextNumber}-${date}`;
}

// =====================================================
// EXPORT
// =====================================================

module.exports = router;
