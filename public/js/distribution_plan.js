let plan = [];
let categoriesDistr = [];
let canEdit = false;
let selectedEventData = null;

function isPlanEditable() {
  return selectedEventData && Number(selectedEventData.stat) !== 90;
}

async function initDistributionPlanPage() {
  const filterElement = document.getElementById("distributionFilter");

  const categoryElement = document.getElementById("categoryFilter");

  const eventElement = document.getElementById("event_id");

  const saveButton = document.getElementById("saveButton");

  const transferButton = document.getElementById("transferButton");

  // Veranstaltung laden
  await loadDistributionEvents();

  // Benutzer laden
  await loadCurrentUser();

  // Filter
  if (filterElement) {
    filterElement.addEventListener("change", renderDistributionsView);
  }

  if (categoryElement) {
    categoryElement.addEventListener("change", renderDistributionsView);
  }

  // Veranstaltung geändert
  if (eventElement) {
    eventElement.addEventListener("change", loadDistributionPlan);
  }

  // Speichern
  if (saveButton) {
    saveButton.addEventListener("click", saveDistributionPlan);
  }

  // In Materialplanung übernehmen
  if (transferButton) {
    transferButton.addEventListener("click", transferToMaterialPlan);
  }

  // Initial ausblenden
  updateDistributionVisibility();

  updateRights();
}
function updateDistributionVisibility() {
  const distributionContent = document.getElementById("distributionContent");

  if (!distributionContent) {
    return;
  }

  distributionContent.style.display = selectedEventData ? "" : "none";
}
async function loadDistributionPlan() {
  const eventSelect = document.getElementById("event_id");

  if (!eventSelect) {
    return;
  }

  const eventId = eventSelect.value;

  // Zurücksetzen
  selectedEventData = null;
  plan = [];

  updateDistributionVisibility();

  // Keine Veranstaltung ausgewählt
  if (!eventId) {
    updateRights();
    renderDistributionsView();
    return;
  }

  const selectedOption = eventSelect.options[eventSelect.selectedIndex];

  selectedEventData = {
    id: eventId,
    stat: selectedOption.dataset.stat,
  };

  try {
    const response = await fetch(`/api/distribution-plan/${eventId}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    plan = await response.json();

    if (!Array.isArray(plan)) {
      console.error("Ungültige Distribution-Antwort:", plan);

      plan = [];
    }

    loadCategories();

    updateDistributionVisibility();

    updateRights();

    renderDistributionsView();
  } catch (error) {
    console.error("DISTRIBUTION PLAN LOAD ERROR:", error);

    plan = [];

    updateDistributionVisibility();

    updateRights();

    renderDistributionsView();
  }
}

async function loadCurrentUser() {
  try {
    const response = await fetch("/api/users/me");

    if (!response.ok) {
      canEdit = false;
      return;
    }

    const user = await response.json();

    canEdit = user.role === "admin";
  } catch (error) {
    console.error("USER LOAD ERROR:", error);
    canEdit = false;
  }
}
function renderDistributionsView() {
  renderDistributionTable();
  renderDistributionCards();
}
function updateRights() {
  const editable = canEdit && isPlanEditable();

  const saveButton = document.getElementById("saveButton");
  const transferButton = document.getElementById("transferButton");

  if (saveButton) {
    saveButton.style.display = editable ? "" : "none";
  }

  if (transferButton) {
    transferButton.style.display = editable ? "" : "none";
  }
}

async function loadDistributionEvents() {
  const res = await fetch("/api/events");
  const events = await res.json();

  const select = document.getElementById("event_id");

  if (!select) return;

  select.innerHTML = '<option value="">Bitte auswählen</option>';

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

    // Status für später speichern
    option.dataset.stat = event.stat;

    if (Number(event.stat) === 90) {
      option.textContent += " (abgeschlossen)";
    }

    select.appendChild(option);
  });
}


function renderDistributionTable() {
  const tbody = document.getElementById("plan_table");
  if (!tbody) return;

  tbody.innerHTML = "";

  const editable = canEdit && isPlanEditable();

  getFilteredPlan().forEach((item) => {
    tbody.innerHTML += `
      <tr>
        <td>
          <input
            type="checkbox"
            class="planned"
            data-id="${item.id}"
            ${item.planned ? "checked" : ""}
            ${!editable ? "disabled" : ""}
          >
        </td>

        <td>${item.product_name}</td>
        <td>${item.input || ""}</td>
        <td>${item.cable || ""}</td>
        <td>${item.schuko || ""}</td>
        <td>${item.cee16 || ""}</td>
        <td>${item.cee32 || ""}</td>
        <td>${item.cee63 || ""}</td>
        <td>${item.cee125 || ""}</td>

        <td>
          <button
            type="button"
            onclick="openDistributionImages(${item.id}, true)">
            📷
          </button>

          <input
            type="text"
            class="location"
            data-id="${item.id}"
            value="${item.location || ""}"
            ${!editable ? "disabled" : ""}
          >
        </td>
      </tr>
    `;
  });
}

function renderDistributionCards() {
  const container = document.getElementById("distributionCards");
  if (!container) return;

  container.innerHTML = "";

  const editable = canEdit && isPlanEditable();

  getFilteredPlan().forEach((item) => {
    const card = document.createElement("div");

    card.className =
      "distribution-card " + (item.planned ? "planned" : "unplanned");

    card.innerHTML = `
      <div class="distribution-card-header">

        <div class="distribution-title">
          <h3>${item.product_name || ""}</h3>

          <div class="distribution-header-actions">

            <button
              type="button"
              class="small image-button"
              onclick="openDistributionImages(${item.id}, true)"
              aria-label="Bilder"
              title="Bilder">
              📷
            </button>

            <label class="switch">
              <input
                type="checkbox"
                class="planned"
                data-id="${item.id}"
                ${item.planned ? "checked" : ""}
                ${!editable ? "disabled" : ""}
              >
            </label>

          </div>
        </div>

      </div>

      <div class="distribution-card-body">

        <div class="distribution-detail">
          <span class="distribution-detail-label">Eingang</span>
          <span class="distribution-detail-value">
            ${item.input || "-"}
          </span>
        </div>

        <div class="distribution-detail">
          <span class="distribution-detail-label">Kabel</span>
          <span class="distribution-detail-value">
            ${item.cable || "-"}
          </span>
        </div>

        <div class="distribution-output-title">
          Ausgänge
        </div>

        <div class="distribution-output-grid">

          <div>
            <small>Schuko</small>
            <strong>${item.schuko || 0}</strong>
          </div>

          <div>
            <small>CEE16</small>
            <strong>${item.cee16 || 0}</strong>
          </div>

          <div>
            <small>CEE32</small>
            <strong>${item.cee32 || 0}</strong>
          </div>

          <div>
            <small>CEE63</small>
            <strong>${item.cee63 || 0}</strong>
          </div>

          <div>
            <small>CEE125</small>
            <strong>${item.cee125 || 0}</strong>
          </div>

        </div>

      </div>

      <div class="distribution-location">
        <label for="distributionLocation-${item.id}">
          Ort
        </label>

        <input
          id="distributionLocation-${item.id}"
          type="text"
          class="location"
          data-id="${item.id}"
          value="${item.location || ""}"
          ${!editable ? "disabled" : ""}
        >
      </div>
    `;

    container.appendChild(card);
  });
}



async function transferToMaterialPlan() {
  const eventId = document.getElementById("event_id").value;

  if (!eventId) {
    alert("Bitte zuerst eine Veranstaltung auswählen.");
    return;
  }
  if (!canEdit || !isPlanEditable()) {
    alert(
      "Die Veranstaltung ist abgeschlossen oder Sie haben keine Berechtigung zur Bearbeitung.",
    );
    return;
  }

  if (!confirm("Distribution in die Materialplanung übernehmen?")) return;

  const res = await fetch(`/api/distribution-plan/${eventId}/generate`, {
    method: "POST",
  });

  const result = await res.json();

  if (result.error) {
    alert(result.error);
    return;
  }

  alert("Materialplanung wurde übernommen.");
}
function loadCategories() {
  const select = document.getElementById("categoryFilter");
  const values = [
    ...new Set(plan.map((x) => x.category_name).filter(Boolean)),
  ].sort();

  select.innerHTML = '<option value="">Alle</option>';

  values.forEach((c) => {
    select.innerHTML += `<option value="${c}">${c}</option>`;
  });
}

function getFilteredPlan() {
  const filter = document.getElementById("distributionFilter").value;
  const categoriesDistr = document.getElementById("categoryFilter").value;

  return plan.filter((item) => {
    if (categoriesDistr && item.category_name != categoriesDistr) return false;

    if (filter === "planned" && item.planned != 1) return false;

    if (filter === "unplanned" && item.planned != 0) return false;

    return true;
  });
}
async function saveDistributionPlan() {
  const eventId = document.getElementById("event_id").value;

  if (!eventId) {
    alert("Bitte zuerst eine Veranstaltung auswählen.");
    return;
  }

  if (!canEdit) {
    alert("Sie haben keine Berechtigung, die Planung zu ändern.");
    return;
  }

  if (!isPlanEditable()) {
    alert(
      "Die Veranstaltung ist bereits abgeschlossen. Die Planung kann nur eingesehen werden.",
    );
    return;
  }
  const items = [];
  const handled = new Set();
  document.querySelectorAll(".planned").forEach((check) => {
    const id = Number(check.dataset.id);
    // verhindert doppelte Einträge (Tabelle + Cards)
    if (handled.has(id)) return;
    handled.add(id);
    const location = document.querySelector(`.location[data-id="${id}"]`);
    items.push({
      distribution_item_id: id,
      planned: check.checked ? 1 : 0,
      location: location ? location.value : "",
    });
  });
  const response = await fetch("/api/distribution-plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event_id: eventId,
      items: items,
    }),
  });
  const result = await response.json();
  if (result.error) {
    alert(result.error);
    return;
  }
  alert("Planung gespeichert.");

  loadDistributionPlan();
}
