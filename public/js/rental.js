const productDetailCache = {};

async function initRentalPage(page) {
  try {
    const events = await loadRentalPageEvents("eventSelect", page);

    if (events.length > 0) {
      await loadRentals(events[0].id);
    }
  } catch (err) {
    console.error("Fehler beim Initialisieren der Rental-Seite:", err);
    alert(err.message);
  }

  setupRentalButtons();
  setupBarcodeScanner();
  setupCameraButton();
  setupCloseEventButton();
  setupCsvExportButton();
}

async function loadRentalPageEvents(selectId = null, page = null) {
  // Immer alle Events laden.
  // Die gewünschte Auswahl wird anschließend anhand des Status gefiltert.
  const res = await fetch("/api/events", {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Fehler beim Laden der Events");
  }

  let events = await res.json();

  // Übersicht: alle Events
  // Andere Seiten: nur aktive/nicht abgeschlossene Events
  if (page !== "rentals") {
    events = events.filter(
      (event) => Number(event.stat) === 20 || Number(event.stat) === 10,
    );
  }

  // Status und anschließend Datum sortieren
  events = sortEventsByStatus(events);

  const select = selectId && document.getElementById(selectId);

  if (select) {
    select.innerHTML = "";

    events.forEach((event, index) => {
      const option = document.createElement("option");

      option.value = event.id;
      option.textContent = `${getEventStatusSymbol(event.stat)} ${event.name}`;
      option.selected = index === 0;

      select.appendChild(option);
    });

    updateCloseButtonVisibility(events);

    select.onchange = async () => {
      updateCloseButtonVisibility(events);
      await loadRentals(Number(select.value));
      focusBarcodeInput();
    };
  }

  return events;
}

async function loadRentals(eventId) {
  if (!eventId) return;

  try {
    const res = await fetch(`/api/rentals/${eventId}`);

    if (!res.ok) {
      throw new Error("Fehler beim Laden der Übersicht");
    }

    const materials = await res.json();
    renderRentalTable(materials);
    renderRentalCards(materials);
  } catch (err) {
    console.error(err);
    if (document.getElementById("barcodeInput")) {
      showRentalScanMessage(err.message, "error");
    } else {
      alert(err.message);
    }
  }
}

function renderRentalTable(materials) {
  const tbody = document.querySelector("#rentalTable tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  materials.forEach((material) => {
    const row = document.createElement("tr");
    row.dataset.materialId = material.material_id;
    row.style.cursor = "pointer";
    row.innerHTML = `
      <td>${material.pname}</td>
      <td>${material.specification || "-"}</td>
      <td>${material.available}</td>
      <td>${material.planned}</td>
      <td>${material.scanned}</td>
      <td>${material.returned}</td>
    `;
    row.addEventListener("click", () =>
      toggleMaterialProductsTable(row, material),
    );
    tbody.appendChild(row);
  });
}

function renderRentalCards(materials) {
  const container = document.getElementById("rentalCardContainer");
  if (!container) return;

  container.innerHTML = "";

  materials.forEach((material) => {
    let scanIcon = "⚪";

    if (material.scanned === material.planned && material.planned > 0) {
      scanIcon = "🟢";
    } else if (material.scanned > material.planned) {
      scanIcon = "🔴";
    } else if (material.scanned > 0) {
      scanIcon = "🟡";
    }

    const card = document.createElement("div");

    card.className = "card rental-card";
    card.dataset.materialId = material.material_id;
    card.style.cursor = "pointer";

    card.innerHTML = `
      <div class="rental-card-header">
        <div class="rental-title">
          <h3>${material.pname || ""}</h3>
        </div>

        <div class="rental-subtitle">
          ${material.specification || "-"}
        </div>
      </div>

      <div class="rental-card-body">

        <div class="rental-detail">
          <span class="rental-detail-label">Vorhanden</span>
          <span class="rental-detail-value">
            <span class="rental-status-icon">🟢</span>
            ${material.available}
          </span>
        </div>

        <div class="rental-detail">
          <span class="rental-detail-label">Geplant</span>
          <span class="rental-detail-value">
            <span class="rental-status-icon">🔵</span>
            ${material.planned}
          </span>
        </div>

        <div class="rental-detail">
          <span class="rental-detail-label">Ausgeliehen</span>
          <span class="rental-detail-value">
            <span class="rental-status-icon">${scanIcon}</span>
            ${material.scanned}
          </span>
        </div>

        <div class="rental-detail">
          <span class="rental-detail-label">Zurückgegeben</span>
          <span class="rental-detail-value">
            <span class="rental-status-icon">↩️</span>
            ${material.returned}
          </span>
        </div>

      </div>
    `;

    card.addEventListener("click", () =>
      toggleMaterialProducts(card, material),
    );

    container.appendChild(card);
  });
}

// -----------------------------
// CACHE
// -----------------------------

function getProductCacheKey(eventId, materialId) {
  return `${eventId}_${materialId}`;
}

function clearProductDetailCache() {
  Object.keys(productDetailCache).forEach((key) => {
    delete productDetailCache[key];
  });
}

function clearProductDetailCacheForEvent(eventId) {
  const prefix = `${eventId}_`;

  Object.keys(productDetailCache).forEach((key) => {
    if (key.startsWith(prefix)) {
      delete productDetailCache[key];
    }
  });
}

async function loadProductDetails(eventId, materialId) {
  const cacheKey = getProductCacheKey(eventId, materialId);

  // Bereits geladene Daten verwenden
  if (productDetailCache[cacheKey]) {
    return productDetailCache[cacheKey];
  }

  const res = await fetch(
    `/api/rentals/${eventId}/material/${materialId}/products`,
    {
      credentials: "include",
    },
  );

  if (!res.ok) {
    throw new Error("Fehler beim Laden der Artikel");
  }

  const products = await res.json();

  // Daten eventbezogen speichern
  productDetailCache[cacheKey] = products;

  return products;
}

// =====================================================
// RENTAL-PRODUKTE – CARD
// =====================================================

async function toggleMaterialProducts(card, material) {
  let details = card.querySelector(".product-details");

  // Bereits geöffnet → schließen
  if (details) {
    details.remove();
    return;
  }

  try {
    const eventSelect = document.getElementById("eventSelect");

    if (!eventSelect) {
      throw new Error("Event-Select nicht gefunden");
    }

    const eventId = Number(eventSelect.value);

    if (!eventId) {
      throw new Error("Kein Event ausgewählt");
    }

    const products = await loadProductDetails(eventId, material.material_id);

    details = document.createElement("div");
    details.className = "product-details";

    products.forEach((p) => {
      const returned = Number(p.rental_stat) === 90;

      details.innerHTML += `
        <div class="${returned ? "product-returned" : ""}">
          ${returned ? "↩️" : "🟢"} ${p.name} (${p.Code})
        </div>
      `;
    });

    card.appendChild(details);
  } catch (err) {
    console.error("Fehler beim Laden der Produktdetails:", err);
    alert(err.message);
  }
}

// =====================================================
// RENTAL-PRODUKTE – TABLE
// =====================================================

async function toggleMaterialProductsTable(row, material) {
  const next = row.nextElementSibling;

  // Bereits geöffnet → schließen
  if (next && next.classList.contains("product-detail-row")) {
    next.remove();
    return;
  }

  try {
    const eventSelect = document.getElementById("eventSelect");

    if (!eventSelect) {
      throw new Error("Event-Select nicht gefunden");
    }

    const eventId = Number(eventSelect.value);

    if (!eventId) {
      throw new Error("Kein Event ausgewählt");
    }

    const products = await loadProductDetails(eventId, material.material_id);

    const detailRow = document.createElement("tr");
    detailRow.className = "product-detail-row";

    const cell = document.createElement("td");
    cell.colSpan = 5;

    const details = document.createElement("div");
    details.className = "product-details";

    products.forEach((p) => {
      const returned = Number(p.rental_stat) === 90;

      details.innerHTML += `
        <div class="${returned ? "product-returned" : ""}">
          ${returned ? "↩️" : "🟢"} ${p.name} (${p.Code})
        </div>
      `;
    });

    cell.appendChild(details);
    detailRow.appendChild(cell);

    row.parentNode.insertBefore(detailRow, row.nextSibling);
  } catch (err) {
    console.error("Fehler beim Laden der Produktdetails:", err);
    alert(err.message);
  }
}

// =====================================================
// BUTTONS
// =====================================================
function setupRentalButtons() {
  const mapping = [
    { id: "rentButton", url: "/api/rentals" },
    { id: "backrentButton", url: "/api/rentals/return" },
    { id: "stornorentButton", url: "/api/rentals/storno" },
  ];

  mapping.forEach((btn) => {
    const element = document.getElementById(btn.id);
    if (element)
      element.addEventListener("click", () => handleRentalAction(btn.url));
  });
}
function setupCsvExportButton() {
  const btn = document.getElementById("exportCsvButton");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    try {
      const eventSelect = document.getElementById("eventSelect");
      if (!eventSelect) throw new Error("Event-Select nicht gefunden");

      const event_id = parseInt(eventSelect.value, 10);
      if (!event_id) throw new Error("Kein Event ausgewählt");

      window.location.href = `/api/events/${event_id}/export`;
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  });
}
// =====================================================
// BARcode SCANNER
// =====================================================
function focusBarcodeInput() {
  document.getElementById("barcodeInput")?.focus({ preventScroll: true });
}

function showRentalScanMessage(message, type = "success") {
  const result = document.getElementById("result");
  if (!result) return;
  result.className = `rental-scan-message rental-scan-message-${type}`;
  result.textContent = message;
}

function setupBarcodeScanner() {
  const barcodeInput = document.getElementById("barcodeInput");
  if (!barcodeInput) return;

  focusBarcodeInput();

  barcodeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const Code = barcodeInput.value.trim();
      if (!Code) return;
      handleScan(Code);
      barcodeInput.value = "";
    }
  });
}

function setupCameraButton() {
  const btn = document.getElementById("scanBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    try {
      const scannedcode = await startCameraScan();
      if (scannedcode) await handleScan(scannedcode);
    } catch (err) {
      console.error("Scan fehlgeschlagen:", err);
      showRentalScanMessage(err.message || "Scan konnte nicht durchgeführt werden", "error");
    } finally {
      focusBarcodeInput();
    }
  });
}

function handleScan(Code) {
  const mode = document.body.dataset.mode;
  if (navigator.vibrate) navigator.vibrate(100);

  const input = document.getElementById("barcodeInput");
  if (input) input.value = Code;

  switch (mode) {
    case "rent":
      return handleRentalAction("/api/rentals");
    case "return":
      return handleRentalAction("/api/rentals/return");
    case "storno":
      return handleRentalAction("/api/rentals/storno");
    default:
      console.warn("Unbekannter Modus:", mode);
  }
}

async function handleRentalAction(url) {
  try {
    const eventSelect = document.getElementById("eventSelect");
    if (!eventSelect) throw new Error("Event-Select nicht gefunden");
    const event_id = parseInt(eventSelect.value, 10);
    if (!event_id) throw new Error("Kein Event ausgewählt");

    const barcodeInput = document.getElementById("barcodeInput");
    const Code = barcodeInput ? barcodeInput.value.trim() : null;
    if (!Code) {
      showRentalScanMessage("Bitte Barcode eingeben oder scannen", "error");
      return;
    }

    const payload = {
      event_id,
      Codes: [Code], // <-- hier als Array
    };

    if (barcodeInput) barcodeInput.value = "";

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });

    // Absichern: nur JSON parsen, wenn Content-Type JSON ist
    let result = null;

    result = await res.json();

    if (!res.ok) {
      throw new Error(
        typeof result === "string"
          ? result
          : result.error || "Fehler bei der Aktion",
      );
    }
    if (result.results && result.results.length > 0) {
      const actionLabels = {
        "wird ausgeliehen": "wurde ausgeliehen",
        "wird erneut ausgeliehen": "wurde erneut ausgeliehen",
        "zurückgegeben": "wurde zurückgegeben",
        "storniert": "wurde storniert",
        "bereits verliehen": "ist bereits verliehen",
        "nicht verliehen": "ist nicht verliehen",
      };
      const messages = result.results.map(r =>
        r.product
          ? `${r.product} ${actionLabels[r.status] || r.status} (${r.Code})`
          : `${r.status} (${r.Code})`,
      );

      const successStatuses = ["wird ausgeliehen", "wird erneut ausgeliehen", "zurückgegeben", "storniert"];
      const hasErrors = result.results.some(r => !successStatuses.includes(r.status));
      showRentalScanMessage(messages.join("\n"), hasErrors ? "error" : "success");
      if (url === "/api/rentals/storno" && !hasErrors) {
        showAppMessage(messages.join("\n"), "success");
      }
    } else {
      showRentalScanMessage(result.message || "Aktion abgeschlossen");
      if (url === "/api/rentals/storno") {
        showAppMessage(result.message || "Storno abgeschlossen", "success");
      }
    }
    clearProductDetailCacheForEvent(event_id);
    await loadRentals(event_id);

  } catch (err) {
    console.error(err);
    showRentalScanMessage(err.message, "error");
  } finally {
    focusBarcodeInput();
  }
}
async function startCameraScan() {
  if (!window.ZXing?.BrowserBarcodeReader) {
    throw new Error("Barcode-Scanner konnte nicht geladen werden");
  }
  if (!window.isSecureContext) {
    throw new Error(
      "Kamera benötigt eine sichere Verbindung (HTTPS).",
    );
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Kamera wird von diesem Browser nicht unterstützt");
  }

  const codeReader = new ZXing.BrowserBarcodeReader();
  const video = document.createElement("video");
  video.setAttribute("playsinline", true);

  const container = document.getElementById("cameraContainer");
  if (!container) throw new Error("Kamera-Container nicht gefunden");

  container.replaceChildren(video);
  container.style.display = "block";

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    video.srcObject = stream;
    await video.play();

    const result = await codeReader.decodeOnceFromVideoElement(video);
    return result.text;
  } finally {
    codeReader.reset();
    stream?.getTracks().forEach((track) => track.stop());
    video.remove();
    container.style.display = "none";
  }
}
function setupCloseEventButton() {
  const btn = document.getElementById("closeEventButton");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    try {
      const eventSelect = document.getElementById("eventSelect");
      if (!eventSelect) throw new Error("Event-Select nicht gefunden");

      const event_id = parseInt(eventSelect.value, 10);
      if (!event_id) throw new Error("Kein Event ausgewählt");

      if (!confirm("Event wirklich abschließen?")) return;

      const res = await fetch(`/api/events/${event_id}/close`, {
        method: "PUT",
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      showAppMessage(result.message);

      // 🔄 UI aktualisieren
      await loadRentalPageEvents("eventSelect", "rentals");

      const selectedEvent = Number(
        document.getElementById("eventSelect")?.value,
      );

      if (selectedEvent) {
        await loadRentals(selectedEvent);
      }
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  });
}
function updateCloseButtonVisibility(allEvents) {
  const btn = document.getElementById("closeEventButton");
  const select = document.getElementById("eventSelect");

  if (!btn || !select) return;

  const event_id = parseInt(select.value, 10);
  const event = allEvents.find((e) => e.id == event_id);

  if (!event) return;

  // stat 90 = abgeschlossen
  if (Number(event.stat) === 90 || Number(event.stat) === 95) {
    btn.style.display = "none";
  } else {
    btn.style.display = "inline-block";
  }
}
// =====================================================
// DATUM FORMAT
// =====================================================
function formatRentalDateDE(date) {
  if (!date) return "";
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
