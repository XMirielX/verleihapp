// =====================================================
// invoice.js
// Rechnungen direkt über Event verwalten
// =====================================================

let invoiceEvents = [];
let currentInvoice = null;
let currentInvoiceItems = [];
let deletedInvoiceItemIds = [];

// =====================================================
// INITIALISIERUNG
// =====================================================

async function initInvoicePage() {
  currentInvoice = null;
  currentInvoiceItems = [];
  deletedInvoiceItemIds = [];

  const container = document.getElementById("invoiceContainer");

  if (container) {
    container.hidden = true;
  }

  const positionsSection = document.getElementById("invoicePositionsSection");

  if (positionsSection) {
    positionsSection.hidden = false;
  }

  await loadInvoiceEvents();

  const eventSelect = document.getElementById("invoiceEventSelect");

  if (eventSelect) {
    eventSelect.addEventListener("change", handleInvoiceEventChange);
  }

  const addButton = document.getElementById("addInvoiceItemBtn");

  if (addButton) {
    addButton.addEventListener("click", addInvoiceItem);
  }

  const discountButton = document.getElementById("addInvoiceDiscountBtn");

  if (discountButton) {
    discountButton.addEventListener("click", addInvoiceDiscount);
  }

  const saveItemsButton = document.getElementById("saveInvoiceItemsBtn");

  if (saveItemsButton) {
    saveItemsButton.addEventListener("click", saveInvoiceItems);
  }
}

// =====================================================
// EVENTS LADEN
// =====================================================

async function loadInvoiceEvents() {
  try {
    const response = await fetch("/api/events");

    if (!response.ok) {
      throw new Error("Events konnten nicht geladen werden.");
    }

    invoiceEvents = await response.json();

    const select = document.getElementById("invoiceEventSelect");

    if (!select) {
      return;
    }

    select.innerHTML = `
      <option value="">
        Event auswählen
      </option>
    `;

    invoiceEvents.forEach((event) => {
      const option = document.createElement("option");

      option.value = event.id;

      option.textContent = `${event.name} – ${
        event.customer_name || "Kein Kunde"
      }`;

      select.appendChild(option);
    });
  } catch (err) {
    console.error("Fehler beim Laden der Events:", err);

    alert(err.message);
  }
}

// =====================================================
// EVENT GEÄNDERT
// =====================================================

async function handleInvoiceEventChange(event) {
  const eventId = event.target.value;

  const container = document.getElementById("invoiceContainer");

  if (!eventId) {
    currentInvoice = null;
    currentInvoiceItems = [];
    deletedInvoiceItemIds = [];

    if (container) {
      container.hidden = true;
    }

    const positionsSection = document.getElementById("invoicePositionsSection");

    if (positionsSection) {
      positionsSection.hidden = true;
    }

    return;
  }

  await loadInvoiceForEvent(eventId);
}

// =====================================================
// RECHNUNG FÜR EVENT LADEN
// =====================================================

async function loadInvoiceForEvent(eventId) {
  try {
    const response = await fetch(`/api/invoices/event/${eventId}`);

    if (!response.ok) {
      throw new Error("Rechnung konnte nicht geladen werden.");
    }

    const data = await response.json();

    // -------------------------------------------------
    // Noch keine Rechnung
    // -------------------------------------------------

    if (!data.invoice) {
      currentInvoice = null;
      currentInvoiceItems = [];
      deletedInvoiceItemIds = [];

      showCreateInvoice(eventId);

      return;
    }

    // -------------------------------------------------
    // Rechnung vorhanden
    // -------------------------------------------------

    currentInvoice = data.invoice;

    currentInvoiceItems = data.items || [];

    renderInvoice();
  } catch (err) {
    console.error("Fehler beim Laden der Rechnung:", err);

    alert(err.message);
  }
}

// =====================================================
// RECHNUNG ERSTELLEN ANZEIGEN
// =====================================================

function showCreateInvoice(eventId) {
  const container = document.getElementById("invoiceContainer");
  const header = document.getElementById("invoiceHeader");

  if (!container || !header) {
    return;
  }

  container.hidden = false;

   // Keine Positionen anzeigen, solange keine Rechnung existiert
  const positionsSection = document.getElementById("invoicePositionsSection");

  if (positionsSection) {
    positionsSection.hidden = true;
  }

  const tbody = document.querySelector("#invoiceItemsTable tbody");
  const cards = document.getElementById("invoiceItemCards");
  const totals = document.getElementById("invoiceTotals");

  if (tbody) {
    tbody.innerHTML = "";
  }

  if (cards) {
    cards.innerHTML = "";
  }

  if (totals) {
    totals.innerHTML = "";
    totals.hidden = true;
  }

  const saveItemsButton = document.getElementById("saveInvoiceItemsBtn");
  const addItemButton = document.getElementById("addInvoiceItemBtn");
  const discountButton = document.getElementById("addInvoiceDiscountBtn");

  if (saveItemsButton) {
    saveItemsButton.hidden = true;
  }

  if (addItemButton) {
    addItemButton.hidden = true;
  }

  if (discountButton) {
    discountButton.hidden = true;
  }
  // -------------------------------------------------
  // Event suchen
  // -------------------------------------------------

  const event = invoiceEvents.find(
    (item) => Number(item.id) === Number(eventId),
  );

  if (!event) {
    header.innerHTML = `
      <div class="invoice-create-box">
        <p>Event konnte nicht gefunden werden.</p>
      </div>
    `;

    return;
  }

  // -------------------------------------------------
  // Event noch nicht abgeschlossen
  // -------------------------------------------------

  if (Number(event.stat) !== 90) {
    header.innerHTML = `
      <div class="invoice-create-box">

        <p>
          Für dieses Event kann noch keine Rechnung erstellt werden.
        </p>

        <p>
          <strong>
            Das Event ist noch nicht abgeschlossen.
          </strong>
        </p>

        <p>
          Bitte schließe das Event zuerst ab.
        </p>

      </div>
    `;

    return;
  }

  // -------------------------------------------------
  // Kein Kunde
  // -------------------------------------------------

  if (!event.customer_id) {
    header.innerHTML = `
      <div class="invoice-create-box">

        <p>
          Für dieses Event kann keine Rechnung erstellt werden.
        </p>

        <p>
          <strong>
            Es ist kein Kunde hinterlegt.
          </strong>
        </p>

        <p>
          Bitte hinterlege zuerst einen Kunden beim Event.
        </p>

      </div>
    `;

    return;
  }

  // -------------------------------------------------
  // Rechnung kann erstellt werden
  // -------------------------------------------------

  header.innerHTML = `
    <div class="invoice-create-box">

      <p>
        Für dieses Event existiert noch keine Rechnung.
      </p>

      <p>
        Kunde:
        <strong>
          ${escapeHtml(event.customer_name || "")}
        </strong>
      </p>

      <button
        type="button"
        id="createInvoiceBtn">
        Rechnung aus Event erstellen
      </button>

    </div>
  `;

  const createButton = document.getElementById("createInvoiceBtn");

  if (createButton) {
    createButton.addEventListener("click", () => createInvoice(eventId));
  }
}

// =====================================================
// RECHNUNG ERSTELLEN
// =====================================================

async function createInvoice(eventId) {
  const button = document.getElementById("createInvoiceBtn");

  if (button) {
    button.disabled = true;
  }

  try {
    const response = await fetch(`/api/invoices/event/${eventId}/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const responseText = await response.text();
    let result = {};

    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch (_) {
      throw new Error(
        `Der Server hat eine ungültige Antwort geliefert (HTTP ${response.status}).`,
      );
    }

    if (!response.ok) {
      throw new Error(result.error || "Rechnung konnte nicht erstellt werden.");
    }

    currentInvoice = result.invoice;
    currentInvoiceItems = result.items || [];
    deletedInvoiceItemIds = [];

    if (!currentInvoice) {
      throw new Error("Der Rechnungskopf wurde nicht vom Server geliefert.");
    }

    // Die Antwort enthält bereits Rechnungskopf und Positionen. Dadurch kann
    // die Oberfläche ohne einen zweiten Ladezyklus sofort umgeschaltet werden.
    renderInvoice();
  } catch (err) {
    console.error("Fehler beim Erstellen der Rechnung:", err);

    alert(err.message);

    if (button) {
      button.disabled = false;
      button.textContent = "Rechnung aus Event erstellen";
    }
  }
}

// =====================================================
// RECHNUNG RENDERN
// =====================================================

function renderInvoice() {
  const container = document.getElementById("invoiceContainer");

  if (!container || !currentInvoice) {
    return;
  }

  container.hidden = false;

const positionsSection = document.getElementById("invoicePositionsSection");

if (positionsSection) {
  positionsSection.hidden = false;
}
  const totals = document.getElementById("invoiceTotals");

  if (totals) {
    totals.hidden = false;
  }

  renderInvoiceHeader();
  renderInvoiceItems();
  renderInvoiceTotals();
}

// =====================================================
// RECHNUNGSKOPF
// =====================================================

function renderInvoiceHeader() {
  const header = document.getElementById("invoiceHeader");

  if (!header || !currentInvoice) {
    return;
  }

  let status = document.getElementById("invoiceStatus");
  let invoiceFields = document.getElementById("invoiceDataFields");
  let customerFields = document.getElementById("invoiceCustomerFields");

  // Nach "Rechnung erstellen" oder einem Wechsel von einem Event
  // ohne Rechnung existiert der normale Rechnungskopf nicht mehr.
  // Deshalb hier den vollständigen Kopf wieder aufbauen.
  if (!status || !invoiceFields || !customerFields) {
    header.innerHTML = `
      <div id="invoiceStatus"></div>

      <div class="invoice-info-card">
        <div class="invoice-info-card-header">
          <h4>Rechnung</h4>
        </div>

        <div
          id="invoiceDataFields"
          class="invoice-info-fields">
        </div>
      </div>

      <div class="invoice-info-card">
        <div class="invoice-info-card-header">
          <h4>Rechnungsempfänger</h4>
        </div>

        <div
          id="invoiceCustomerFields"
          class="invoice-info-fields">
        </div>
      </div>

      <div class="invoice-header-actions">

        <button
          type="button"
          id="saveInvoiceHeaderBtn"
          aria-label="Speichern"
          title="Speichern">
          <i class="fa-solid fa-floppy-disk"></i>
          Speichern
        </button>

        <button
          type="button"
          id="finalizeInvoiceBtn"
          aria-label="Rechnung abschließen"
          title="Rechnung abschließen">
          <i class="fa-solid fa-lock"></i>
          Abschließen
        </button>

        <button
          type="button"
          id="createInvoicePdfBtn">
          PDF erstellen
        </button>

      </div>
    `;

    status = document.getElementById("invoiceStatus");
    invoiceFields = document.getElementById("invoiceDataFields");
    customerFields = document.getElementById("invoiceCustomerFields");
  }

  const isFinal = currentInvoice.status === "final";

  // -------------------------------------------------
  // Status anzeigen
  // -------------------------------------------------

  status.innerHTML = `
    ${
      isFinal
        ? `
          <div class="invoice-status invoice-status-final">
            <i class="fa-solid fa-lock"></i>
            Rechnung abgeschlossen
          </div>
        `
        : `
          <div class="invoice-status invoice-status-draft">
            <i class="fa-solid fa-pen"></i>
            Rechnung in Bearbeitung
          </div>
        `
    }
  `;

  // =====================================================
  // RECHNUNGSDATEN
  // =====================================================

  invoiceFields.innerHTML = `
    <div class="form-group">
      <label for="invoiceNumber">
        Rechnungsnummer
      </label>

      <input
        type="text"
        id="invoiceNumber"
        value="${escapeHtml(currentInvoice.invoice_number || "")}"
        ${isFinal ? "disabled" : ""}
      >
    </div>

    <div class="form-group">
      <label for="invoiceDate">
        Rechnungsdatum
      </label>

      <input
        type="date"
        id="invoiceDate"
        value="${currentInvoice.invoice_date || ""}"
        ${isFinal ? "disabled" : ""}
      >
    </div>
  `;

  // =====================================================
  // RECHNUNGSEMPFÄNGER
  // =====================================================

  customerFields.innerHTML = `
    <div class="form-group">
      <label for="invoiceCustomerName">
        Kunde
      </label>

      <input
        type="text"
        id="invoiceCustomerName"
        value="${escapeHtml(currentInvoice.customer_name || "")}"
        ${isFinal ? "disabled" : ""}
      >
    </div>

    <div class="form-group">
      <label for="invoiceCustomerAddress">
        Straße
      </label>

      <input
        type="text"
        id="invoiceCustomerAddress"
        value="${escapeHtml(currentInvoice.customer_address || "")}"
        ${isFinal ? "disabled" : ""}
      >
    </div>

    <div class="invoice-address-row">

      <div class="form-group">
        <label for="invoiceCustomerZip">
          PLZ
        </label>

        <input
          type="text"
          id="invoiceCustomerZip"
          value="${escapeHtml(currentInvoice.customer_zip || "")}"
          ${isFinal ? "disabled" : ""}
        >
      </div>

      <div class="form-group">
        <label for="invoiceCustomerCity">
          Ort
        </label>

        <input
          type="text"
          id="invoiceCustomerCity"
          value="${escapeHtml(currentInvoice.customer_city || "")}"
          ${isFinal ? "disabled" : ""}
        >
      </div>

    </div>

    <div class="form-group">
      <label for="invoiceCustomerEmail">
        E-Mail
      </label>

      <input
        type="email"
        id="invoiceCustomerEmail"
        value="${escapeHtml(currentInvoice.customer_email || "")}"
        ${isFinal ? "disabled" : ""}
      >
    </div>
  `;

  // =====================================================
  // BUTTONS
  // =====================================================

  const saveButton = document.getElementById("saveInvoiceHeaderBtn");

  if (saveButton) {
    saveButton.onclick = saveInvoiceHeader;
    saveButton.disabled = isFinal;
    saveButton.hidden = isFinal;
  }

  const saveItemsButton = document.getElementById("saveInvoiceItemsBtn");

  if (saveItemsButton) {
    saveItemsButton.disabled = isFinal;
    saveItemsButton.hidden = isFinal;
  }

  const addButton = document.getElementById("addInvoiceItemBtn");

  if (addButton) {
    addButton.disabled = isFinal;
    addButton.hidden = isFinal;
  }

  const discountButton = document.getElementById("addInvoiceDiscountBtn");

  if (discountButton) {
    discountButton.disabled = isFinal;
    discountButton.hidden = isFinal;
  }

  const pdfButton = document.getElementById("createInvoicePdfBtn");

  if (pdfButton) {
    pdfButton.onclick = createInvoicePdf;
    pdfButton.disabled = false;
    pdfButton.hidden = false;
  }

  const finalizeButton = document.getElementById("finalizeInvoiceBtn");

  if (finalizeButton) {
    finalizeButton.onclick = finalizeInvoice;
    finalizeButton.disabled = isFinal;
    finalizeButton.hidden = isFinal;
  }
}

// =====================================================
// RECHNUNG ABSCHLIESSEN
// =====================================================

async function finalizeInvoice() {
  if (!currentInvoice) {
    return;
  }

  // Bereits abgeschlossen
  if (currentInvoice.status === "final") {
    return;
  }

  const confirmed = confirm(
    "Rechnung wirklich abschließen?\n\n" +
      "Danach können Rechnungsdaten und Positionen nicht mehr geändert werden.\n\n" +
      "Bitte prüfe vorher Rechnungsnummer, Datum, Empfänger und Positionen.",
  );

  if (!confirmed) {
    return;
  }

  const button = document.getElementById("finalizeInvoiceBtn");

  if (button) {
    button.disabled = true;
    button.textContent = "Rechnung wird abgeschlossen...";
  }

  try {
    const response = await fetch(
      `/api/invoices/${currentInvoice.id}/finalize`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Rechnung konnte nicht abgeschlossen werden.",
      );
    }

    // -------------------------------------------------
    // Lokalen Status setzen
    // -------------------------------------------------

    currentInvoice.status = "final";

    // -------------------------------------------------
    // Komplett neu rendern
    // Dadurch werden alle Eingaben und Buttons gesperrt.
    // -------------------------------------------------

    renderInvoice();

    alert("Rechnung wurde abgeschlossen.");
  } catch (err) {
    console.error("Fehler beim Abschließen der Rechnung:", err);

    alert(err.message);

    if (button) {
      button.disabled = false;
      button.textContent = "Rechnung abschließen";
    }
  }
}

// =====================================================
// RECHNUNGSKOPF SPEICHERN
// =====================================================

async function saveInvoiceHeader() {
  if (!currentInvoice) {
    return;
  }

  // Sicherheitsprüfung
  if (currentInvoice.status === "final") {
    alert(
      "Diese Rechnung ist bereits abgeschlossen und kann nicht mehr geändert werden.",
    );
    return;
  }

  const invoiceNumberInput = document.getElementById("invoiceNumber");
  const invoiceDateInput = document.getElementById("invoiceDate");
  const customerNameInput = document.getElementById("invoiceCustomerName");
  const customerAddressInput = document.getElementById(
    "invoiceCustomerAddress",
  );
  const customerZipInput = document.getElementById("invoiceCustomerZip");
  const customerCityInput = document.getElementById("invoiceCustomerCity");
  const customerEmailInput = document.getElementById("invoiceCustomerEmail");

  if (
    !invoiceNumberInput ||
    !invoiceDateInput ||
    !customerNameInput ||
    !customerAddressInput ||
    !customerZipInput ||
    !customerCityInput ||
    !customerEmailInput
  ) {
    return;
  }

  const invoiceNumber = invoiceNumberInput.value.trim();
  const invoiceDate = invoiceDateInput.value;

  const customerName = customerNameInput.value.trim();
  const customerAddress = customerAddressInput.value.trim();
  const customerZip = customerZipInput.value.trim();
  const customerCity = customerCityInput.value.trim();
  const customerEmail = customerEmailInput.value.trim();

  if (!invoiceNumber) {
    alert("Die Rechnungsnummer darf nicht leer sein.");
    return;
  }

  if (!invoiceDate) {
    alert("Das Rechnungsdatum darf nicht leer sein.");
    return;
  }

  try {
    const response = await fetch(`/api/invoices/${currentInvoice.id}`, {
      method: "PUT",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,

        customer_name: customerName,
        customer_address: customerAddress,
        customer_zip: customerZip,
        customer_city: customerCity,
        customer_email: customerEmail,

        notes: currentInvoice.notes || "",
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Rechnungsdaten konnten nicht gespeichert werden.",
      );
    }

    // -------------------------------------------------
    // Lokalen Rechnungsstand aktualisieren
    // -------------------------------------------------

    currentInvoice.invoice_number = invoiceNumber;
    currentInvoice.invoice_date = invoiceDate;

    currentInvoice.customer_name = customerName;
    currentInvoice.customer_address = customerAddress;
    currentInvoice.customer_zip = customerZip;
    currentInvoice.customer_city = customerCity;
    currentInvoice.customer_email = customerEmail;

    alert("Rechnungsdaten gespeichert.");
  } catch (err) {
    console.error("Fehler beim Speichern der Rechnungsdaten:", err);

    alert(err.message);
  }
}

// =====================================================
// RECHNUNG ALS PDF ÖFFNEN
// =====================================================

function createInvoicePdf() {
  if (!currentInvoice) {
    return;
  }

  const url = `/api/invoices/${currentInvoice.id}/pdf`;

  window.open(url, "_blank");
}

// =====================================================
// POSITIONEN RENDERN
// =====================================================

function renderInvoiceItems() {
  renderInvoiceItemsTable();
  renderInvoiceItemCards();
}

// =====================================================
// EVENTS FÜR POSITION
// =====================================================

function setupInvoiceItemEvents(container, item) {
  if (!currentInvoice) {
    return;
  }

  const isFinal = currentInvoice.status === "final";

  const descriptionInput = container.querySelector(".invoice-item-description");

  const quantityInput = container.querySelector(".invoice-item-quantity");

  const priceInput = container.querySelector(".invoice-item-price");

  const totalCell =
    container.querySelector(".invoice-item-total") ||
    container.querySelector(".invoice-item-card-total strong");

  // -------------------------------------------------
  // Abgeschlossene Rechnung
  // -------------------------------------------------

  if (isFinal) {
    return;
  }

  // -------------------------------------------------
  // Vorschau aktualisieren
  // -------------------------------------------------

  const updatePreview = () => {
    // Sicherheitsprüfung
    if (!currentInvoice || currentInvoice.status === "final") {
      return;
    }

    const description = descriptionInput?.value.trim() || "";

    const quantity = Number(quantityInput?.value) || 0;

    const price = Number(priceInput?.value) || 0;

    const total = quantity * price;

    item.description = description;
    item.quantity = quantity;
    item.unit_price = price;
    item.total = total;

    // Gesamt anzeigen
    if (totalCell) {
      if (
        totalCell.tagName === "STRONG" &&
        totalCell.parentElement.classList.contains("invoice-item-card-total")
      ) {
        totalCell.textContent = formatCurrency(total);
      } else {
        totalCell.innerHTML = `
          <strong>
            ${formatCurrency(total)}
          </strong>
        `;
      }
    }

    // Mobile Überschrift
    const header = container.querySelector(".invoice-item-card-header strong");

    if (header) {
      header.textContent = description || "Position";
    }

    // Rechnungssumme
    updateLocalInvoiceTotal();
  };

  descriptionInput?.addEventListener("input", updatePreview);

  quantityInput?.addEventListener("input", updatePreview);

  priceInput?.addEventListener("input", updatePreview);

  // -------------------------------------------------
  // Löschen
  // -------------------------------------------------

  const deleteButton = container.querySelector(".invoice-delete-item");

  if (deleteButton) {
    deleteButton.addEventListener("click", () => deleteInvoiceItem(item));
  }
}

// =====================================================
// LOKALE RECHNUNGSSUMME AKTUALISIEREN
// =====================================================

function updateLocalInvoiceTotal() {
  if (!currentInvoice || currentInvoice.status === "final") {
    return;
  }

  const total = currentInvoiceItems.reduce((sum, item) => {
    return sum + (Number(item.total) || 0);
  }, 0);

  currentInvoice.total = total;

  renderInvoiceTotals();
}

// =====================================================
// POSITIONEN GESAMT SPEICHERN
// =====================================================

async function saveInvoiceItems() {
  if (!currentInvoice) {
    return;
  }

  // Sicherheitsprüfung
  if (currentInvoice.status === "final") {
    alert(
      "Diese Rechnung ist bereits abgeschlossen und kann nicht mehr geändert werden.",
    );
    return;
  }

  // -------------------------------------------------
  // Eingaben aus DOM übernehmen
  // -------------------------------------------------

  const rows = document.querySelectorAll("#invoiceItemsTable tbody tr");

  rows.forEach((row, index) => {
    const item = currentInvoiceItems[index];

    if (!item) {
      return;
    }

    const description = row.querySelector(".invoice-item-description");

    const quantity = row.querySelector(".invoice-item-quantity");

    const price = row.querySelector(".invoice-item-price");

    if (description) {
      item.description = description.value.trim();
    }

    if (quantity) {
      item.quantity = Number(quantity.value) || 0;
    }

    if (price) {
      item.unit_price = Number(price.value) || 0;
    }

    item.total = item.quantity * item.unit_price;
  });

  // -------------------------------------------------
  // Prüfen
  // -------------------------------------------------

  for (const item of currentInvoiceItems) {
    if (!item.description?.trim()) {
      alert("Die Beschreibung einer Position darf nicht leer sein.");

      return;
    }
  }

  const button = document.getElementById("saveInvoiceItemsBtn");

  if (button) {
    button.disabled = true;

    button.innerHTML = `
      <i class="fa-solid fa-spinner fa-spin"></i>
      Speichern...
    `;
  }

  try {
    const response = await fetch(
      `/api/invoices/${currentInvoice.id}/items/save`,
      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          items: currentInvoiceItems,
          deletedItemIds: [...deletedInvoiceItemIds],
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Positionen konnten nicht gespeichert werden.",
      );
    }

    deletedInvoiceItemIds = [];

    // -------------------------------------------------
    // Rechnung neu laden
    // -------------------------------------------------

    await loadInvoiceForEvent(currentInvoice.event_id);

    alert("Rechnungspositionen gespeichert.");
  } catch (err) {
    console.error("Fehler beim Speichern der Rechnungspositionen:", err);

    alert(err.message);
  } finally {
    if (button) {
      button.disabled = false;

      button.innerHTML = `
        <i class="fa-solid fa-floppy-disk"></i>
        Positionen speichern
      `;
    }
  }
}

// =====================================================
// RECHNUNGSDATUM ÄNDERN
// =====================================================

async function updateInvoiceDate(date) {
  if (!currentInvoice) {
    return;
  }

  // Sicherheitsprüfung
  if (currentInvoice.status === "final") {
    alert(
      "Diese Rechnung ist bereits abgeschlossen und kann nicht mehr geändert werden.",
    );
    return;
  }

  try {
    const response = await fetch(`/api/invoices/${currentInvoice.id}`, {
      method: "PUT",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        invoice_date: date,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Rechnungsdatum konnte nicht gespeichert werden.",
      );
    }

    currentInvoice.invoice_date = date;
  } catch (err) {
    console.error("Fehler beim Ändern des Rechnungsdatums:", err);

    alert(err.message);
  }
}

// =====================================================
// SUMMEN RENDERN
// =====================================================

function renderInvoiceTotals() {
  const container = document.getElementById("invoiceTotals");

  if (!container || !currentInvoice) {
    return;
  }

  container.innerHTML = `
    <div class="invoice-total-row invoice-total-final">

      <span>
        Gesamt
      </span>

      <strong>
        ${formatCurrency(currentInvoice.total)}
      </strong>

    </div>
  `;
}

// =====================================================
// WÄHRUNG
// =====================================================

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

// =====================================================
// RECHNUNG ABSCHLIESSEN
// =====================================================

async function finalizeInvoice() {
  if (!currentInvoice) {
    return;
  }

  if (currentInvoice.status === "final") {
    return;
  }

  const confirmed = confirm(
    "Rechnung wirklich abschließen?\n\n" +
      "Danach können Rechnungsdaten und Positionen " +
      "nicht mehr geändert werden.",
  );

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(
      `/api/invoices/${currentInvoice.id}/finalize`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const responseText = await response.text();
    let result = {};

    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch (_) {
      throw new Error(
        `Der Server hat eine ungültige Antwort geliefert (HTTP ${response.status}).`,
      );
    }

    if (!response.ok) {
      throw new Error(
        result.error || "Rechnung konnte nicht abgeschlossen werden.",
      );
    }

    // Lokalen Status aktualisieren
    currentInvoice.status = "final";

    // Alles neu rendern
    renderInvoice();

    alert("Rechnung wurde abgeschlossen.");
  } catch (err) {
    console.error("Fehler beim Abschließen der Rechnung:", err);

    alert(err.message);
  }
}

// =====================================================
// DESKTOP – TABELLE
// =====================================================

function renderInvoiceItemsTable() {
  const tbody = document.querySelector("#invoiceItemsTable tbody");

  if (!tbody || !currentInvoice) {
    return;
  }

  const isFinal = currentInvoice.status === "final";

  tbody.innerHTML = "";

  currentInvoiceItems.forEach((item) => {
    const row = document.createElement("tr");

    const isMaterial =
      item.material_id !== null && item.material_id !== undefined;

    row.innerHTML = `
      <td>
        <input
          type="text"
          class="invoice-item-description"
          value="${escapeHtml(item.description || "")}"
          ${isFinal ? "disabled" : ""}
        >
      </td>

      <td>
        <input
          type="number"
          class="invoice-item-quantity"
          value="${Number(item.quantity || 0)}"
          min="0"
          step="0.01"
          ${isFinal ? "disabled" : ""}
        >
      </td>

      <td>
        <input
          type="number"
          class="invoice-item-price"
          value="${Number(item.unit_price || 0).toFixed(2)}"
          step="0.01"
          ${isFinal ? "disabled" : ""}
        >
      </td>

      <td class="invoice-item-total">
        <strong>
          ${formatCurrency(item.total)}
        </strong>
      </td>

      <td>
        <div class="table-actions">

          ${
            !isFinal
              ? `
                <button
                  type="button"
                  class="danger invoice-delete-item"
                  data-id="${item.id || ""}"
                  aria-label="Löschen"
                  title="Löschen">

                  <i class="fa-solid fa-trash"></i>

                </button>
              `
              : ""
          }

        </div>
      </td>
    `;

    if (isMaterial) {
      row.classList.add("invoice-material-item");
    } else {
      row.classList.add("invoice-manual-item");
    }

    tbody.appendChild(row);

    setupInvoiceItemEvents(row, item);
  });
}

// =====================================================
// MOBILE – CARDS
// =====================================================

function renderInvoiceItemCards() {
  const container = document.getElementById("invoiceItemCards");

  if (!container || !currentInvoice) {
    return;
  }

  const isFinal = currentInvoice.status === "final";

  container.innerHTML = "";

  currentInvoiceItems.forEach((item) => {
    const card = document.createElement("div");

    card.className = "invoice-item-card";

    const isMaterial =
      item.material_id !== null && item.material_id !== undefined;

    if (isMaterial) {
      card.classList.add("invoice-material-item");
    } else {
      card.classList.add("invoice-manual-item");
    }

    card.innerHTML = `
      <div class="invoice-item-card-header">
        <strong>
          ${escapeHtml(item.description || "Position")}
        </strong>
      </div>

      <div class="invoice-item-detail">

        <input
          type="text"
          class="invoice-item-description"
          value="${escapeHtml(item.description || "")}"
          ${isFinal ? "disabled" : ""}
        >

      </div>

      <div class="invoice-item-card-body">

        <div class="invoice-item-detail">

          <span>Menge</span>

          <input
            type="number"
            class="invoice-item-quantity"
            value="${Number(item.quantity || 0)}"
            min="0"
            step="0.01"
            ${isFinal ? "disabled" : ""}
          >

        </div>

        <div class="invoice-item-detail">

          <span>Einzelpreis</span>

          <input
            type="number"
            class="invoice-item-price"
            value="${Number(item.unit_price || 0).toFixed(2)}"
            step="0.01"
            ${isFinal ? "disabled" : ""}
          >

        </div>

        <div
          class="invoice-item-detail invoice-item-card-total">

          <span>Gesamt</span>

          <strong>
            ${formatCurrency(item.total)}
          </strong>

        </div>

      </div>

      ${
        !isFinal
          ? `
            <div class="invoice-item-card-actions">

              <button
                type="button"
                class="danger invoice-delete-item"
                aria-label="Löschen"
                title="Löschen">

                <i class="fa-solid fa-trash"></i>

              </button>

            </div>
          `
          : ""
      }
    `;

    container.appendChild(card);

    setupInvoiceItemEvents(card, item);
  });
}

// =====================================================
// POSITIONEN SPEICHERN
// =====================================================

async function saveInvoiceItems() {
  if (!currentInvoice) {
    return;
  }

  // WICHTIG:
  // Finale Rechnung darf niemals gespeichert werden.
  if (currentInvoice.status === "final") {
    alert(
      "Diese Rechnung ist bereits abgeschlossen und kann nicht mehr geändert werden.",
    );
    return;
  }

  // -------------------------------------------------
  // Eingaben aus DOM übernehmen
  // -------------------------------------------------

  const rows = document.querySelectorAll("#invoiceItemsTable tbody tr");

  rows.forEach((row, index) => {
    const item = currentInvoiceItems[index];

    if (!item) {
      return;
    }

    const description = row.querySelector(".invoice-item-description");

    const quantity = row.querySelector(".invoice-item-quantity");

    const price = row.querySelector(".invoice-item-price");

    if (description) {
      item.description = description.value.trim();
    }

    if (quantity) {
      item.quantity = Number(quantity.value) || 0;
    }

    if (price) {
      item.unit_price = Number(price.value) || 0;
    }

    item.total = item.quantity * item.unit_price;
  });

  // -------------------------------------------------
  // Prüfen
  // -------------------------------------------------

  for (const item of currentInvoiceItems) {
    if (!item.description?.trim()) {
      alert("Die Beschreibung einer Position darf nicht leer sein.");
      return;
    }
  }

  const button = document.getElementById("saveInvoiceItemsBtn");

  if (button) {
    button.disabled = true;

    button.innerHTML = `
      <i class="fa-solid fa-spinner fa-spin"></i>
      Speichern...
    `;
  }

  try {
    const response = await fetch(
      `/api/invoices/${currentInvoice.id}/items/save`,
      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          items: currentInvoiceItems,
          deletedItemIds: [...deletedInvoiceItemIds],
        }),
      },
    );

    const responseText = await response.text();
    let result = {};

    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch (_) {
      throw new Error(
        `Der Server hat eine ungültige Antwort geliefert (HTTP ${response.status}).`,
      );
    }

    if (!response.ok) {
      throw new Error(
        result.error || "Positionen konnten nicht gespeichert werden.",
      );
    }

    deletedInvoiceItemIds = [];

    await loadInvoiceForEvent(currentInvoice.event_id);

    alert("Rechnungspositionen gespeichert.");
  } catch (err) {
    console.error("Fehler beim Speichern der Rechnungspositionen:", err);

    alert(err.message);
  } finally {
    if (button) {
      button.disabled = false;

      button.innerHTML = `
        <i class="fa-solid fa-floppy-disk"></i>
        Positionen speichern
      `;
    }
  }
}

// =====================================================
// POSITION HINZUFÜGEN
// =====================================================

function addInvoiceItem() {
  if (!currentInvoice) {
    return;
  }

  if (currentInvoice.status === "final") {
    alert(
      "Diese Rechnung ist bereits abgeschlossen und kann nicht mehr geändert werden.",
    );
    return;
  }

  const newItem = {
    id: null,
    material_id: null,

    description: "Neue Position",

    quantity: 1,

    unit: "Stück",

    unit_price: 0,

    total: 0,
  };

  currentInvoiceItems.push(newItem);

  renderInvoiceItems();
  updateLocalInvoiceTotal();
}

// =====================================================
// POSITION LÖSCHEN
// =====================================================

function deleteInvoiceItem(item) {
  if (!currentInvoice) {
    return;
  }

  if (currentInvoice.status === "final") {
    alert(
      "Diese Rechnung ist bereits abgeschlossen und kann nicht mehr geändert werden.",
    );
    return;
  }

  if (!confirm("Diese Rechnungsposition wirklich löschen?")) {
    return;
  }

  const index = currentInvoiceItems.indexOf(item);

  if (index === -1) {
    return;
  }

  const itemId = Number(item?.id);

  if (Number.isInteger(itemId) && !deletedInvoiceItemIds.includes(itemId)) {
    deletedInvoiceItemIds.push(itemId);
  }

  currentInvoiceItems.splice(index, 1);

  renderInvoiceItems();
  updateLocalInvoiceTotal();
}

// =====================================================
// HTML SICHERN
// =====================================================

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
