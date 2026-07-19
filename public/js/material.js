// ==========================
// Materialverwaltung Frontend
// ==========================

const API = {
    categories: "/api/categories",
    materialTypes: "/api/material"
};

// DOM
const categorySelect = document.getElementById("category");
const materialForm = document.getElementById("materialForm");
const result = document.getElementById("result");

const materialTableBody = document.querySelector("#materialTable tbody");
const categoryTableBody = document.querySelector("#categoryTable tbody");

const categoryDialog = document.getElementById("categoryDialog");
const newCategoryBtn = document.getElementById("newCategoryBtn");
const saveCategoryBtn = document.getElementById("saveCategoryBtn");
const closeDialogBtn = document.getElementById("closeDialogBtn");
const newCategoryName = document.getElementById("newCategoryName");

let categories = [];
let materialTypes = [];

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
        await createMaterialType();
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
    renderCategoryTable();
}

async function loadMaterialTypes() {
    const res = await fetch("/api/material");

    const text = await res.text();
    console.log("RAW RESPONSE:", text);

    materialTypes = JSON.parse(text);

    renderMaterialTable(); // <<< DAS FEHLT
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

    materialForm.reset();
    await loadMaterialTypes();
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

        tr.querySelector(".deleteMaterial").addEventListener("click", () => {
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