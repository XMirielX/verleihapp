// =====================================================
// prices.js
// Verwaltung der Materialpreise nach Preiskategorie
// =====================================================

let currentPriceMaterialId = null;

// =====================================================
// PREISDIALOG ÖFFNEN
// =====================================================

async function openMaterialPrices(materialId, materialName = "") {
  currentPriceMaterialId = materialId;

  const dialog = document.getElementById("priceDialog");

  if (!dialog) {
    console.error("priceDialog nicht gefunden");
    return;
  }

  const title = document.getElementById("priceDialogTitle");

  if (title) {
    title.textContent = materialName
      ? `Preise – ${materialName}`
      : "Materialpreise";
  }

  try {
    await loadMaterialPrices(materialId);

    dialog.showModal();
  } catch (err) {
    console.error("Fehler beim Öffnen der Materialpreise:", err);

    alert("Materialpreise konnten nicht geladen werden.");
  }
}

// =====================================================
// PREISKATEGORIEN LADEN
// =====================================================

async function loadPriceCategoriesForMaterial() {
  const response = await fetch("/api/prices");

  if (!response.ok) {
    throw new Error(
      `Preiskategorien konnten nicht geladen werden (${response.status})`,
    );
  }

  return await response.json();
}

// =====================================================
// MATERIALPREISE LADEN
// =====================================================

async function loadMaterialPrices(materialId) {
  const container = document.getElementById("materialPriceContainer");

  if (!container) {
    console.error("materialPriceContainer nicht gefunden");
    return;
  }

  container.innerHTML = "<p>Preise werden geladen...</p>";

  try {
    const [priceCategories, materialPrices] = await Promise.all([
      loadPriceCategoriesForMaterial(),

      fetch(`/api/prices/material/${materialId}`).then((response) => {
        if (!response.ok) {
          throw new Error(
            `Materialpreise konnten nicht geladen werden (${response.status})`,
          );
        }

        return response.json();
      }),
    ]);

    renderMaterialPrices(priceCategories, materialPrices);
  } catch (err) {
    console.error("Fehler beim Laden der Materialpreise:", err);

    container.innerHTML = `
            <p>
                Materialpreise konnten nicht geladen werden.
            </p>
        `;

    throw err;
  }
}

// =====================================================
// PREISE DARSTELLEN
// =====================================================

function renderMaterialPrices(priceCategories, materialPrices) {
  const container = document.getElementById("materialPriceContainer");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  // -------------------------------------------------
  // Standardpreis
  // -------------------------------------------------

  const standardPrice = materialPrices.find(
    (item) => item.price_category_id === null,
  );

  const standardRow = createPriceRow(
    null,
    "Standardpreis",
    standardPrice ? standardPrice.price : 0,
  );

  container.appendChild(standardRow);

  // -------------------------------------------------
  // Preise nach Preiskategorie
  // -------------------------------------------------

  priceCategories.forEach((category) => {
    const existingPrice = materialPrices.find(
      (item) => Number(item.price_category_id) === Number(category.id),
    );

    const row = createPriceRow(
      category.id,
      category.name,
      existingPrice ? existingPrice.price : 0,
    );

    container.appendChild(row);
  });
}

// =====================================================
// PREISZEILE ERSTELLEN
// =====================================================

function createPriceRow(priceCategoryId, name, price) {
  const row = document.createElement("div");

  row.className = "material-price-row";

  row.dataset.priceCategoryId = priceCategoryId === null ? "" : priceCategoryId;

  row.innerHTML = `

        <div class="material-price-name">
            ${escapeHtml(name)}
        </div>

        <div class="material-price-input">

            <input
                type="number"
                class="material-price-field"
                min="0"
                step="0.01"
                value="${Number(price).toFixed(2)}"
            >

            <span>€</span>

        </div>

    `;

  return row;
}

// =====================================================
// PREISE SPEICHERN
// =====================================================

async function saveMaterialPrices() {
  if (!currentPriceMaterialId) {
    console.error("Keine Material-ID für Preisverwaltung vorhanden");
    return;
  }

  const container = document.getElementById("materialPriceContainer");

  if (!container) {
    return;
  }

  const rows = container.querySelectorAll(".material-price-row");

  const prices = [];

  for (const row of rows) {
    const input = row.querySelector(".material-price-field");

    if (!input) {
      continue;
    }

    const rawPrice = input.value.trim();

    const price = rawPrice === "" ? 0 : Number(rawPrice);

    if (!Number.isFinite(price) || price < 0) {
      alert("Bitte geben Sie für alle Preise gültige Werte ein.");

      input.focus();

      return;
    }

    const categoryValue = row.dataset.priceCategoryId;

    const priceCategoryId = categoryValue === "" ? null : Number(categoryValue);

    prices.push({
      price_category_id: priceCategoryId,
      price: price,
    });
  }

  try {
    const response = await fetch(
      `/api/prices/material/${currentPriceMaterialId}`,
      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          prices: prices,
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Materialpreise konnten nicht gespeichert werden",
      );
    }

    closeMaterialPrices();
  } catch (err) {
    console.error("Fehler beim Speichern der Materialpreise:", err);

    alert(err.message || "Materialpreise konnten nicht gespeichert werden.");
  }
}

// =====================================================
// PREISDIALOG SCHLIESSEN
// =====================================================

function closeMaterialPrices() {
  const dialog = document.getElementById("priceDialog");

  if (dialog) {
    dialog.close();
  }

  currentPriceMaterialId = null;
}

// =====================================================
// HTML ESCAPEN
// =====================================================

function escapeHtml(value) {
  const div = document.createElement("div");

  div.textContent = value ?? "";

  return div.innerHTML;
}

// =====================================================
// EVENTS
// =====================================================

function initPricesPage() {
  const saveButton = document.getElementById("saveMaterialPricesBtn");

  if (saveButton) {
    saveButton.addEventListener("click", saveMaterialPrices);
  }

  const closeButton = document.getElementById("closePriceDialogBtn");

  if (closeButton) {
    closeButton.addEventListener("click", closeMaterialPrices);
  }

  const dialog = document.getElementById("priceDialog");

  if (dialog) {
    dialog.addEventListener("cancel", () => {
      currentPriceMaterialId = null;
    });
  }
}
