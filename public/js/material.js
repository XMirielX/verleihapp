// ==========================
// Materialverwaltung Frontend
// ==========================

// DOM
let materialCardContainer = null;
let categoryCardContainer = null;
let categorySelect = null;
let materialForm = null;
let result = null;
let saveButton = null;
let formTitle = null;
let materialTableBody = null;
let categoryTableBody = null;

let categoryDialog = null;
let newCategoryBtn = null;
let saveCategoryBtn = null;
let closeDialogBtn = null;
let newCategoryName = null;

let categories = [];
let materialTypes = [];
let currentMaterialId = null;
// ==========================
// INIT
// ==========================
async function initMaterialPage() {
  materialCardContainer = document.getElementById("materialCardContainer");
  categoryCardContainer = document.getElementById("categoryCardContainer");
  categorySelect = document.getElementById("category");
  materialForm = document.getElementById("materialForm");
  result = document.getElementById("result");
  saveButton = document.getElementById("saveButton");
  formTitle = document.getElementById("formTitle");
  materialTableBody = document.querySelector("#materialTable tbody");
  categoryTableBody = document.querySelector("#categoryTable tbody");

  categoryDialog = document.getElementById("categoryDialog");
  newCategoryBtn = document.getElementById("newCategoryBtn");
  saveCategoryBtn = document.getElementById("saveCategoryBtn");
  closeDialogBtn = document.getElementById("closeDialogBtn");
  newCategoryName = document.getElementById("newCategoryName");

  bindEvents();

  await loadCategories();
  await loadMaterialTypes();
  initPricesPage();
}
// ==========================
// EVENTS
// ==========================
function bindEvents() {
  if (!materialForm || !newCategoryBtn || !saveCategoryBtn || !closeDialogBtn || !categoryDialog || !newCategoryName) {
    return;
  }

  materialForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveMaterialType();
  });

  newCategoryBtn.addEventListener("click", () => {
    newCategoryName.value = "";
    categoryDialog.showModal();
  });

  saveCategoryBtn.addEventListener("click", async () => {
    await createCategory();
  });

  closeDialogBtn.addEventListener("click", () => {
    categoryDialog.close();
  });
}

// ==========================
// LOAD DATA
// ==========================
async function loadCategories() {
  const res = await fetch("/api/categories");
  categories = await res.json();

  renderCategorySelect();
  renderMaterials();
}

async function loadMaterialTypes() {
  const res = await fetch("/api/material");
  materialTypes = await res.json();

  renderMaterials();
}
// ==========================
// CREATE
// ==========================
async function createCategory() {
  const name = newCategoryName.value.trim();
  if (!name) return;

  const res = await fetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  const text = await res.text();
  console.log("RAW RESPONSE:", text);

  if (!res.ok) {
    alert("Fehler beim Erstellen der Kategorie");
    return;
  }

  categoryDialog.close();
  await loadCategories();
}

async function createMaterialType() {
  const payload = {
    name: document.getElementById("name").value.trim(),
    specification: document.getElementById("specification").value.trim(),
    category_id: categorySelect.value,
  };

  if (!payload.name || !payload.category_id) {
    result.textContent = "Bitte Name und Kategorie ausfüllen";
    return;
  }

  const res = await fetch("/api/material", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);

  //  ERROR HANDLING
  if (!res.ok) {
    if (res.status === 409) {
      result.textContent = data?.error || "Material existiert bereits";
      return;
    }

    if (res.status === 400) {
      result.textContent = data?.error || "Ungültige Eingabe";
      return;
    }

    result.textContent = data?.error || "Unbekannter Fehler";
    return;
  }

  // 🟢 SUCCESS
  result.textContent = data?.message || "Gespeichert ✔";
  currentMaterialId = null;
  formTitle.textContent = "Neuen Materialtyp anlegen";
  saveButton.textContent = "Material anlegen";
  materialForm.reset();
  await loadMaterialTypes();
}
// ==========================
// Edit
// ==========================
function editMaterial(material) {
  currentMaterialId = material.id;

  document.getElementById("name").value = material.name || "";
  document.getElementById("specification").value = material.specification || "";
  categorySelect.value = material.category_id;
  formTitle.textContent = "Materialtyp bearbeiten";
  saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>';
  saveButton.setAttribute("aria-label", "Speichern");
  saveButton.title = "Speichern";
}

async function saveMaterialType() {
  if (currentMaterialId) {
    await updateMaterialType();
  } else {
    await createMaterialType();
  }
}
async function updateMaterialType() {
  const payload = {
    name: document.getElementById("name").value.trim(),
    specification: document.getElementById("specification").value.trim(),
    category_id: categorySelect.value,
    active: 1,
  };

  const res = await fetch(`/api/material/${currentMaterialId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  console.log("UPDATE MATERIAL:", currentMaterialId, payload);
  const data = await res.json();

  if (!res.ok) {
    result.textContent = data.error;
    return;
  }

  result.textContent = data.message;

  currentMaterialId = null;

  materialForm.reset();

  formTitle.textContent = "Neuen Materialtyp anlegen";
  saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>';
  saveButton.setAttribute("aria-label", "Speichern");
  saveButton.title = "Speichern";

  await loadMaterialTypes();
}
function clearForm() {
  currentMaterialId = null;

  materialForm.reset();

  formTitle.textContent = "Neuen Materialtyp anlegen";

  saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>';
  saveButton.setAttribute("aria-label", "Speichern");
  saveButton.title = "Speichern";

  cancelButton.hidden = true;
}
// ==========================
// DELETE (optional UI)
// ==========================
async function deleteMaterialType(id) {
  await fetch(`/api/material/${id}`, {
    method: "DELETE",
  });

  await loadMaterialTypes();
}

async function deleteCategory(id) {
  await fetch(`/api/categories/${id}`, {
    method: "DELETE",
  });

  await loadCategories();
}

// ==========================
// RENDER
// ==========================
function renderCategorySelect() {
  categorySelect.innerHTML = "";

  for (const c of categories) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    categorySelect.appendChild(opt);
  }
}

function renderMaterials() {
    renderMaterialTable();
    renderMaterialCards();
    renderCategoryTable();
    renderCategoryCards();
}

function renderMaterialTable() {
  materialTableBody.innerHTML = "";

  for (const m of materialTypes) {
    const cat = categories.find((c) => c.id == m.category_id);

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${cat ? cat.name : "-"}</td>
      <td>${m.name}</td>
      <td>${m.specification || ""}</td>
      <td>
        <button
          type="button"
          class="materialPrices">
          Preise
        </button>

        <button
          type="button"
          data-id="${m.id}"
          class="deleteMaterial"
          aria-label="Löschen"
          title="Löschen">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    `;

    // Zeile bearbeiten
    tr.addEventListener("click", () => {
      editMaterial(m);
    });

    // Preise
    tr.querySelector(".materialPrices").addEventListener("click", (e) => {
      e.stopPropagation();
      openMaterialPrices(m.id, m.name);
    });

    // Löschen
    tr.querySelector(".deleteMaterial").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteMaterialType(m.id);
    });

    materialTableBody.appendChild(tr);
  }
}

function renderCategoryTable() {
  categoryTableBody.innerHTML = "";

  for (const c of categories) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${c.name}</td>
      <td>
        <button
          type="button"
          data-id="${c.id}"
          class="deleteCategory"
          aria-label="Löschen"
          title="Löschen">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    `;

    tr.querySelector(".deleteCategory").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteCategory(c.id);
    });

    categoryTableBody.appendChild(tr);
  }
}

function renderMaterialCards() {
  materialCardContainer.innerHTML = "";

  materialTypes.forEach((m) => {
    const cat = categories.find((c) => c.id == m.category_id);

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="card-header">
        <strong>${m.name}</strong>
      </div>

      <div class="card-body">
        ${cat ? cat.name : "-"}
        ${m.specification ? " / " + m.specification : ""}
      </div>

      <div class="card-actions">

        <button
          type="button"
          class="materialPrices">
          Preise
        </button>

        <button
          type="button"
          class="danger-btn"
          aria-label="Löschen"
          title="Löschen">
          <i class="fa-solid fa-trash"></i>
        </button>

      </div>
    `;

    // Card bearbeiten
    card.addEventListener("click", () => {
      editMaterial(m);
    });

    // Preise
    card.querySelector(".materialPrices").addEventListener("click", (e) => {
      e.stopPropagation();
      openMaterialPrices(m.id, m.name);
    });

    // Löschen
    card.querySelector(".danger-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteMaterialType(m.id);
    });

    materialCardContainer.appendChild(card);
  });
}

function renderCategoryCards() {
  categoryTableBody.innerHTML = "";

  for (const c of categories) {
    const card = document.createElement("div");
    card.className = "mobile-card";

    card.innerHTML = `
            <div class="card-content">
                <div class="card-title">${c.name}</div>
            </div>
            <button data-id="${c.id}" class="deleteCategory" aria-label="Löschen" title="Löschen"><i class="fa-solid fa-trash"></i></button>
        `;

    card.querySelector(".deleteCategory").addEventListener("click", () => {
      deleteCategory(c.id);
    });

    categoryTableBody.appendChild(card);
  }
}
