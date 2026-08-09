let allMaterials = [];
let currentPlan = [];
let selectedEvent = null;
let selectedEventDataPlan = null;

function isPlanningEditable() {
  return selectedEventDataPlan && Number(selectedEventDataPlan.stat) !== 90;
}

// Start
async function initPlanningPage() {
  await loadRentalEvents();
  await loadPlanningMaterials();
  renderCategories();
  renderMaterialsSelect();
  renderPlanningView();

  const eventSelect = document.getElementById("eventSelect");
  if (eventSelect) {
    eventSelect.addEventListener("change", eventChanged);
  }

  const materialSelect = document.getElementById("materialSelect");
  if (materialSelect) {
    materialSelect.addEventListener("change", renderPlanningView);
  }

  const categorySelect = document.getElementById("categorySelect");
  if (categorySelect) {
    categorySelect.addEventListener("change", renderPlanningView);
  }

  const onlyPlanned = document.getElementById("onlyPlanned");
  if (onlyPlanned) {
    onlyPlanned.addEventListener("change", renderPlanningView);
  }

  const saveButton = document.getElementById("savePlanningButton");
  if (saveButton) {
    saveButton.addEventListener("click", savePlanning);
  }
}

// Veranstaltungen laden
async function loadRentalEvents() {
  try {
    const response = await fetch("/api/events");
    const events = await response.json();
    const select = document.getElementById("eventSelect");

    if (!select) {
      return;
    }

    select.innerHTML = '<option value="">Bitte auswählen</option>';

    if (!Array.isArray(events)) {
      console.error("Ungueltige Event-Antwort:", events);
      return;
    }

    // Offene Events zuerst, abgeschlossene danach
    events.sort((a, b) => {
      const aClosed = Number(a.stat) === 90;
      const bClosed = Number(b.stat) === 90;

      if (aClosed !== bClosed) {
        return aClosed ? 1 : -1;
      }

      return a.name.localeCompare(b.name);
    });

    events.forEach((event) => {
      const option = document.createElement("option");

      option.value = event.id;
      option.textContent = event.name;
      option.dataset.stat = event.stat;

      if (Number(event.stat) === 90) {
        option.textContent += " (abgeschlossen)";
      }

      select.appendChild(option);
    });
  } catch (error) {
    console.error("EVENT LOAD ERROR:", error);
  }
}

// Event geändert
async function eventChanged() {
  const eventSelect = document.getElementById("eventSelect");

  selectedEvent = eventSelect.value;

  selectedEventDataPlan = null;

  if (selectedEvent) {
    const selectedOption = eventSelect.options[eventSelect.selectedIndex];

    selectedEventDataPlan = {
      id: selectedEvent,
      stat: selectedOption.dataset.stat,
    };
  }

  await loadPlanningMaterials();
  renderCategories();
  renderMaterialsSelect();

  if (!selectedEvent) {
    currentPlan = [];
    updatePlanningRights();
    renderPlanningView();
    return;
  }

  await loadPlanningPlan();

  updatePlanningRights();
  renderPlanningView();
}

function updatePlanningRights() {
  const saveButton = document.getElementById("savePlanningButton");
  const resultElement = document.getElementById("result");

  const editable = isPlanningEditable();

  if (saveButton) {
    saveButton.disabled = !editable;
    saveButton.style.display = editable ? "" : "none";
  }

  if (resultElement) {
    if (selectedEventDataPlan && !editable) {
      resultElement.textContent =
        "Veranstaltung abgeschlossen – Planung nur zur Ansicht.";
    } else {
      resultElement.textContent = "";
    }
  }
}

// Material laden
async function loadPlanningMaterials() {
  try {
    const [materialResponse, productResponse] = await Promise.all([
      fetch("/api/material"),
      fetch("/api/products"),
    ]);

    const materials = await materialResponse.json();
    const products = await productResponse.json();

    if (!Array.isArray(materials)) {
      console.error("Ungueltige Material-Antwort:", materials);
      allMaterials = [];
      return;
    }

    if (!Array.isArray(products)) {
      console.error("Ungueltige Produkt-Antwort:", products);
      allMaterials = [];
      return;
    }

    allMaterials = materials.map((material) => {
      const available = products.filter(
        (product) =>
          isProductForMaterial(product, material) &&
          Number(product.stat) === 10,
      ).length;

      return {
        ...material,
        category: material.category_name || "-",
        available,
        quantity: 0,
      };
    });
  } catch (error) {
    console.error("MATERIAL LOAD ERROR:", error);
  }
}

function isProductForMaterial(product, material) {
  if (product.material_typ_id) {
    return String(product.material_typ_id) === String(material.id);
  }

  return (
    product.name === material.name &&
    String(product.category_id) === String(material.category_id) &&
    (product.spezification || "") === (material.spezification || "")
  );
}

// bestehende Planung laden
async function loadPlanningPlan() {
  try {
    const response = await fetch(`/api/event_plan/${selectedEvent}`);
    currentPlan = await response.json();

    if (!Array.isArray(currentPlan)) {
      console.error("Ungueltige Plan-Antwort:", currentPlan);
      currentPlan = [];
    }

    allMaterials.forEach((material) => {
      const planned = currentPlan.find(
        (p) => Number(p.material_id) === Number(material.id),
      );
      material.quantity = planned ? planned.quantity : 0;
    });
  } catch (error) {
    console.error("PLAN LOAD ERROR:", error);
  }
}

function renderMaterialsSelect() {
  const select = document.getElementById("materialSelect");
  if (!select) {
    return;
  }

  select.innerHTML = '<option value="">Alle</option>';

  allMaterials
    .sort((a, b) => getMaterialLabel(a).localeCompare(getMaterialLabel(b)))
    .forEach((material) => {
      const option = document.createElement("option");
      option.value = material.id;
      option.textContent = getMaterialLabel(material);
      select.appendChild(option);
    });
}

function getMaterialLabel(material) {
  const parts = [material.category || "-", material.name || "Ohne Name"];

  if (material.specification) {
    parts.push(material.specification);
  }

  return parts.join(" - ");
}

function getFilteredMaterials() {
  const selectedMaterial = document.getElementById("materialSelect").value;
  const category = document.getElementById("categorySelect").value;
  const onlyPlanned = document.getElementById("onlyPlanned").checked;

  return allMaterials.filter((material) => {
    const matchesMaterial =
      !selectedMaterial || material.id == selectedMaterial;
    const matchesCategory = !category || material.category === category;
    const matchesPlan = !onlyPlanned || material.quantity > 0;
    return matchesMaterial && matchesCategory && matchesPlan;
  });
}

// Kategorien erzeugen
function renderCategories() {
  const select = document.getElementById("categorySelect");
  if (!select) {
    return;
  }

  const categories = [
    ...new Set(allMaterials.map((m) => m.category || "-")),
  ].sort();
  select.innerHTML = '<option value="">Alle</option>';

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });
}

function renderPlanningCards() {
  const container = document.getElementById("planningCards");
  if (!container) return;

container.innerHTML = "";

// Karten erst anzeigen, wenn ein Event ausgewählt wurde
if (!selectedEvent) {
    return;
}

const filtered = getFilteredMaterials();

  filtered.forEach((item) => {
    const card = document.createElement("div");
    card.className = "planning-card";

    if (item.quantity > 0) {
      card.classList.add("planned");
    }

    if (item.quantity > item.available) {
      card.classList.add("warning");
    }

    card.innerHTML = `
            <div class="planning-card-title">
                ${item.name}
            </div>

            <div class="planning-card-sub">
                ${item.category || "-"}
                ${item.specification ? " / " + item.specification : ""}
            </div>

            <div class="planning-row">
                <span>Verfügbar</span>
                <strong>${item.available}</strong>
            </div>

            <div class="planning-qty">
                <label>Menge</label>
            <input
                type="number"
                min="0"
                value="${item.quantity}"
                data-id="${item.id}"
                class="planningQuantity"
                ${!isPlanningEditable() ? "readonly" : ""}>
                        </div>
                    `;
    container.appendChild(card);
  });
}

// Tabelle erzeugen
function renderPlanningTable() {
  const tbody = document.getElementById("planningBody");
  if (!tbody) {
    return;
  }

  tbody.innerHTML = "";

  const filtered = getFilteredMaterials();

  const groups = {};
  filtered.forEach((material) => {
    const categoryName = material.category || "-";
    if (!groups[categoryName]) {
      groups[categoryName] = [];
    }
    groups[categoryName].push(material);
  });

  Object.keys(groups)
    .sort()
    .forEach((categoryName) => {
      const header = document.createElement("tr");
      header.innerHTML = `<td colspan="4"><b>${categoryName.toUpperCase()}</b></td>`;
      tbody.appendChild(header);

      groups[categoryName].forEach((material) => {
        const tr = document.createElement("tr");
        if (material.quantity > material.available) {
          tr.style.backgroundColor = "#ffcccc";
        }

        tr.innerHTML = `
                <td>${material.name}${material.specification ? " (" + material.specification + ")" : ""}</td>
                <td>${material.category || "-"}</td>
                <td>${material.available ?? 0}</td>
                <td>
                <input
                    type="number"
                    min="0"
                    value="${material.quantity}"
                    data-id="${material.id}"
                    class="quantityInput"
                    ${!isPlanningEditable() ? "readonly" : ""}>                </td>
                            `;
        tbody.appendChild(tr);
      });
    });

  document.querySelectorAll(".quantityInput").forEach((input) => {
    input.addEventListener("change", (e) => {
      if (!isPlanningEditable()) {
        return;
      }

      const id = Number(e.target.dataset.id);
      const material = allMaterials.find((m) => m.id === id);

      if (material) {
        material.quantity = Number(e.target.value);
        updateSummary();
        renderPlanningView();
      }
    });
  });

  updateSummary();
}

function renderPlanningView() {
  renderPlanningTable();
  renderPlanningCards();
}

function updateSummary() {
  const planned = allMaterials.filter((m) => m.quantity > 0);
  const plannedPositions = document.getElementById("plannedPositions");
  const plannedQuantity = document.getElementById("plannedQuantity");

  if (plannedPositions) {
    plannedPositions.textContent = planned.length;
  }

  if (plannedQuantity) {
    plannedQuantity.textContent = planned.reduce(
      (sum, m) => sum + m.quantity,
      0,
    );
  }
}

function updateQuantity(id, value) {
  const material = allMaterials.find((m) => Number(m.id) === Number(id));
  if (material) {
    material.quantity = Number(value);
    updateSummary();
    renderPlanningView();
  }
}

// Speichern
async function savePlanning() {
  if (!selectedEvent) {
    alert("Bitte Veranstaltung auswählen");
    return;
  }

  if (!isPlanningEditable()) {
    alert(
      "Die Veranstaltung ist bereits abgeschlossen. Die Planung kann nur eingesehen werden.",
    );
    return;
  }

  const items = allMaterials
    .filter((m) => m.quantity > 0)
    .map((m) => ({
      material_id: m.id,
      quantity: m.quantity,
    }));

  try {
    const response = await fetch("/api/event_plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: selectedEvent,
        items: items,
      }),
    });

    await response.json();
    const resultElement = document.getElementById("result");
    if (resultElement) {
      resultElement.textContent = "Planung gespeichert";
    }
  } catch (error) {
    console.error("SAVE ERROR:", error);
    const resultElement = document.getElementById("result");
    if (resultElement) {
      resultElement.textContent = "Fehler beim Speichern";
    }
  }
}
