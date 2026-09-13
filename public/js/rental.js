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
  events = sortEventsSmart(events, page);

  const select = selectId && document.getElementById(selectId);

  if (select) {
    select.innerHTML = "";

    events.forEach((event, index) => {
      const option = document.createElement("option");

      option.value = event.id;
      option.textContent = `${event.name} (${event.start} - ${event.ende})`;
      option.selected = index === 0;

      select.appendChild(option);
    });

    select.onchange = () => {
      updateCloseButtonVisibility(events);
      loadRentals(Number(select.value));
    };
  }

  updateCloseButtonVisibility(events);

  return events;
}

function sortEventsSmart(events, page = null) {
  const statusOrder =
    page === "rentals"
      ? {
          20: 1,
          10: 2,
          90: 3,
        }
      : {
          20: 1,
          10: 2,
        };

  return events.sort((a, b) => {
    const statusA = Number(a.stat);
    const statusB = Number(b.stat);

    // Zuerst nach Status
    const orderA = statusOrder[statusA] ?? 99;
    const orderB = statusOrder[statusB] ?? 99;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // Innerhalb des Status nach Datum aufsteigend
    const dateA = new Date(a.start);
    const dateB = new Date(b.start);

    return dateA - dateB;
  });
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
    alert(err.message);
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
    if (material.scanned === material.planned && material.planned > 0)
      scanIcon = "🟢";
    else if (material.scanned > material.planned) scanIcon = "🔴";
    else if (material.scanned > 0) scanIcon = "🟡";

    const card = document.createElement("div");
    card.className = "card";
    card.dataset.materialId = material.material_id;
    card.style.cursor = "pointer";
    card.innerHTML = `
      <div class="card-header"><strong>${material.pname}</strong><br><small>${material.specification || "-"}</small></div>
      <div class="card-body">
        <div class="status-row"><span>🟢 Vorhanden</span><strong>${material.available}</strong></div>
        <div class="status-row"><span>🔵 Geplant</span><strong>${material.planned}</strong></div>
        <div class="status-row"><span>${scanIcon} Ausgeliehen</span><strong>${material.scanned}</strong></div>
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
function setupBarcodeScanner() {
  const barcodeInput = document.getElementById("barcodeInput");
  if (!barcodeInput) return;

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
      if (scannedcode) handleScan(scannedcode);
    } catch (err) {
      console.error("Scan fehlgeschlagen:", err);
      alert("Scan konnte nicht durchgeführt werden");
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
      handleRentalAction("/api/rentals");
      break;
    case "return":
      handleRentalAction("/api/rentals/return");
      break;
    case "storno":
      handleRentalAction("/api/rentals/storno");
      break;
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
      alert("Bitte Barcode eingeben oder scannen");
      return;
    }

    const payload = {
      event_id,
      Codes: [Code], // <-- hier als Array
    };

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
      const messages = result.results.map(
        (r) =>
          `${r.Code}: ${r.status}${r.product ? " (" + r.product + ")" : ""}`,
      );

      alert(messages.join("\n"));
    }
    clearProductDetailCacheForEvent(event_id);
    await loadRentals(event_id);

    if (barcodeInput) barcodeInput.value = "";
    if (barcodeInput && window.innerWidth > 768) barcodeInput.focus();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}
// =====================================================
// PLACEHOLDER CAMERA SCAN
// =====================================================
// 1. ZXing installieren oder per CDN einbinden
// <script src="https://unpkg.com/@zxing/library@0.19.1/umd/index.min.js"></script>
async function startCameraScan() {
  return new Promise(async (resolve, reject) => {
    try {
      const codeReader = new ZXing.BrowserBarcodeReader();
      const video = document.createElement("video");
      video.setAttribute("playsinline", true); // iOS

      const container = document.getElementById("cameraContainer");
      container.style.display = "block"; // 🔹 Container sichtbar, wenn Kamera läuft
      container.appendChild(video);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      video.srcObject = stream;
      await video.play();

      const result = await codeReader.decodeOnceFromVideoDevice(
        undefined,
        video,
      );
      resolve(result.text);

      // Kamera stoppen
      stream.getTracks().forEach((track) => track.stop());
      video.remove();
      container.style.display = "none"; // 🔹 Container wieder ausblenden
    } catch (err) {
      reject(err);
    }
  });
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

      if (
        !confirm(
          "Event wirklich abschließen?",
        )
      )
        return;

      const res = await fetch(`/api/events/${event_id}/close`, {
        method: "PUT",
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      alert(result.message);

      // 🔄 UI aktualisieren
      loadRentalPageEvents("eventSelect");
      loadRentals(event_id);
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
  if (Number(event.stat) === 90) {
    btn.style.display = "none";
  } else {
    btn.style.display = "inline-block";
  }
}
// =====================================================
// DATUM FORMAT
// =====================================================
function formatDateDE(date) {
  if (!date) return "";
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
