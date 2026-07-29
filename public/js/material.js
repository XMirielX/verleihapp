// ==========================
// Materialverwaltung Frontend
// ==========================

const API = {
    categories: "/api/categories",
    materialTypes: "/api/material"
};

// DOM
const materialCardContainer = document.getElementById("materialCardContainer");
const categoryCardContainer = document.getElementById("categoryCardContainer");
const categorySelect = document.getElementById("category");
const materialForm = document.getElementById("materialForm");
const result = document.getElementById("result");
const saveButton = document.getElementById("saveButton");
const formTitle = document.getElementById("formTitle");
const materialTableBody = document.querySelector("#materialTable tbody");
const categoryTableBody = document.querySelector("#categoryTable tbody");

const categoryDialog = document.getElementById("categoryDialog");
const newCategoryBtn = document.getElementById("newCategoryBtn");
const saveCategoryBtn = document.getElementById("saveCategoryBtn");
const closeDialogBtn = document.getElementById("closeDialogBtn");
const newCategoryName = document.getElementById("newCategoryName");

let categories = [];
let materialTypes = [];
let currentMaterialId = null;
// ==========================
// INIT
// ==========================
document.addEventListener("DOMContentLoaded", async () => {
    bindEvents();

    await loadCategories();
    await loadMaterialTypes();
});
// ==========================
// EVENTS
// ==========================
function bindEvents() {

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
    const res = await fetch(API.categories);
    categories = await res.json();

    renderCategorySelect();
    renderMaterials();
}

async function loadMaterialTypes() {
    const res = await fetch(API.materialTypes);
    materialTypes = await res.json();

    renderMaterials();
}
// ==========================
// CREATE
// ==========================
async function createCategory() {
    const name = newCategoryName.value.trim();
    if (!name) return;

  const res = await fetch(API.categories, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
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
            category_id: categorySelect.value
        };

    if (!payload.name || !payload.category_id) {
        result.textContent = "Bitte Name und Kategorie ausfüllen";
        return;
    }

    const res = await fetch(API.materialTypes, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
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
    saveButton.textContent = "Änderungen speichern";
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
        active: 1
    };

    const res = await fetch(`${API.materialTypes}/${currentMaterialId}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
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
    saveButton.textContent = "Material anlegen";

    await loadMaterialTypes();
}
function clearForm() {

    currentMaterialId = null;

    materialForm.reset();

    formTitle.textContent = "Neuen Materialtyp anlegen";

    saveButton.textContent = "Material anlegen";

    cancelButton.hidden = true;
}
// ==========================
// DELETE (optional UI)
// ==========================
async function deleteMaterialType(id) {
    await fetch(`${API.materialTypes}/${id}`, {
        method: "DELETE"
    });

    await loadMaterialTypes();
}

async function deleteCategory(id) {
    await fetch(`${API.categories}/${id}`, {
        method: "DELETE"
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
    if (window.innerWidth <= 768) {
        materialTable.style.display = "none";
        materialCardContainer.style.display = "flex";
        renderMaterialCards();
        renderCategoryCards();
    } else {
        materialTable.style.display = "table";
        materialCardContainer.style.display = "none";
        renderMaterialTable();
        renderCategoryTable();

    }
}

function renderMaterialTable() {
    materialTableBody.innerHTML = "";

    for (const m of materialTypes) {
        const cat = categories.find(c => c.id == m.category_id);

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${cat ? cat.name : "-"}</td>
            <td>${m.name}</td>
            <td>${m.specification || ""}</td>
            <td>
                <button data-id="${m.id}" class="deleteMaterial">Löschen</button>
            </td>
        `;
        tr.addEventListener("click", () => {
            editMaterial(m);
        });
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
                <button data-id="${c.id}" class="deleteCategory">Löschen</button>
            </td>
        `;

        tr.querySelector(".deleteCategory").addEventListener("click", () => {
            deleteCategory(c.id);
        });

        categoryTableBody.appendChild(tr);
    }
}
function renderMaterialCards() {
    materialCardContainer.innerHTML = "";

    materialTypes.forEach(m => {
        const cat = categories.find(c => c.id == m.category_id);

        const card = document.createElement("div");
        card.className = "card";

        card.innerHTML = `
            <div class="card-header">
                <strong>${m.name}</strong>
            </div>

            <div class="card-body">
                <div><strong>Kategorie:</strong> ${cat ? cat.name : "-"}</div>
                <div><strong>Spezifikation:</strong> ${m.specification || "-"}</div>
            </div>

            <div class="card-actions">
                <button class="danger-btn">Löschen</button>
            </div>
        `;

        card.addEventListener("click", () => editMaterial(m));

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
            <button data-id="${c.id}" class="deleteCategory">Löschen</button>
        `;

        card.querySelector(".deleteCategory").addEventListener("click", () => {
            deleteCategory(c.id);
        });

        categoryTableBody.appendChild(card);
    }
}