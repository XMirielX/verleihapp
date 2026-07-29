// =====================================================
// 🌍 GLOBALE VARIABLEN
// =====================================================
let allProducts = [];
let categoryMap = {};
let sortDirection = 1;
let editingProductId = null;
let currentUser = null;
const page = window.location.pathname;

const isDeletePage = page.includes("productdelete.html");
const isCheckPage = page.includes("productcheck.html");

// =====================================================
// 🚀 INIT
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
    await loadCategories();
    await loadMaterialTypes();
    currentUser = await checkLogin();
    await loadProducts();
    const adminBtn = document.getElementById("adminBtn");
    document.querySelectorAll(".adminOnly").forEach(btn => {
        btn.style.display = isAdmin() ? "inline-block" : "none";
    });
    fillSpecFilter(allProducts);
    setupEditMode();
    setupForm();
    setupFilterListeners();
    setDefaultDate();

});

// =====================================================
// 📦 PRODUKTE LERNEN
// =====================================================
async function loadProducts() {
    try {
        const res = await fetch("/api/products");
        const products = await res.json();

        allProducts = products;

        renderProducts(products, isDeletePage, isCheckPage);

    } catch (err) {
        console.error("Fehler beim Laden der Produkte:", err);
    }
}

function isProductOverview(showDelete, showCheck) {
    return page.includes("products.html") && !showDelete && !showCheck;
}

function openProductEdit(id) {
    window.location.href = `productadd.html?id=${encodeURIComponent(id)}`;
}

function isAdmin() {
    return currentUser && currentUser.role === "admin";
}

// =====================================================
// 🧾 PRODUKTE RENDERN
// =====================================================
function renderProducts(products, showDelete = false, showCheck = false) {
    const table = document.getElementById("productTable");
    const tableBody = document.getElementById("productTableBody");
    const container = document.getElementById("productTableContainer");

    if (!table || !tableBody || !container) return;

    tableBody.innerHTML = "";
    container.innerHTML = "";

    const filtered = filterProducts(products);

    // 📱 Mobile
    if (window.innerWidth <= 768) {
        table.style.display = "none"; // Tabelle ausblenden

        filtered.forEach(product => {
            const item = document.createElement("div");
            item.className = "card product-card";

            const statusColor = getStatusColor(product.stat);

            let buttons = "";
            if (showDelete) buttons += `<button class="small" onclick="deleteProduct(${product.id})">Loeschen</button>`;
            if (showCheck) buttons += `<button class="small" onclick="checkProduct(${product.id})">pruefen</button>`;

           item.style.borderLeftWidth = "6px";
item.style.borderLeftColor = statusColor;
            if (isProductOverview(showDelete, showCheck) && isAdmin()) {
                item.title = "Produkt bearbeiten";
                item.addEventListener("click", (event) => {
                    if (!event.target.closest("button")) openProductEdit(product.id);
                });
            }
            const productName = getProductName(product);
            const productSpec = getProductSpec(product);

            item.innerHTML = `
                    <div class="product-title">${productName}${productSpec ? " (" + productSpec + ")" : ""}</div>
                    <div class="product-sub">
                    ${categoryMap[product.category_id] || "-"} / ${product.bez || "-"}
                    </div>
                    <div class="product-sub">Pruefdatum: ${formatDateDE(product.check_date)}</div>
                    <div class="product-sub">Barcode: ${product.Code}    </div>
                    <div class="product-actions">${buttons}</div>
                    `;
            container.appendChild(item);
        });

        return;
    }

    // 💻 Desktop
    table.style.display = ""; // Tabelle anzeigen

    filtered.forEach(product => {
        const row = document.createElement("tr");

        let buttons = "";
        if (showDelete) buttons += `<button class="small" onclick="deleteProduct(${product.id})">Loeschen</button>`;
        if (showCheck) buttons += `<button class="small" onclick="checkProduct(${product.id})">Check</button>`;

        row.innerHTML = `
            <td>${product.bez || ""}</td>
            <td>${formatStatus(product.stat)}</td>
            <td>${product.Code}</td>
            <td>${categoryMap[product.category_id] || "-"}</td>
            <td>${getProductSpec(product)}</td>
            <td>${formatDateDE(product.check_date)}</td>
            <td>${buttons}</td>
        `;
        if (isProductOverview(showDelete, showCheck) && isAdmin()) {
            row.classList.add("clickable-row");
            row.title = "Produkt bearbeiten";
            row.addEventListener("click", (event) => {
                if (!event.target.closest("button")) openProductEdit(product.id);
            });
        }
        if (!showDelete && !showCheck) row.lastElementChild.remove();
        tableBody.appendChild(row);
    });

    updateSummary(filtered);
}
let materialTypes = [];

async function loadMaterialTypes() {

    try {
        const res = await fetch("/api/material");
        materialTypes = await res.json();
    } catch (err) {
        console.error("Fehler beim Laden der Materialtypen:", err);
        materialTypes = [];
        return;
    }

    if (!Array.isArray(materialTypes)) {
        console.error("Ungueltige Materialtypen-Antwort:", materialTypes);
        materialTypes = [];
        return;
    }

    const select = document.getElementById("materialTypeSelect");
    if (!select) return;

    select.innerHTML = '<option value="">-- Bitte waehlen --</option>';

    materialTypes.forEach(mat => {

        const option = document.createElement("option");

        option.value = mat.id;
        option.textContent =
            `${mat.category_name} - ${mat.name} ${mat.specification ?? ""}`;

        select.appendChild(option);

    });

}
// =====================================================
// 🔍 FILTER & SUCHE
// =====================================================
function filterProducts(products) {
    const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
    const category = document.getElementById("categoryFilter")?.value || "";
    const spec = document.getElementById("specFilter")?.value.toLowerCase() || "";

    return products.filter(p => {
        const productName = getProductName(p).toLowerCase();
        const productSpec = getProductSpec(p).toLowerCase();
        const matchSearch = productName.includes(search) || String(p.Code).includes(search);
        const matchCategory = !category || p.category_id == category;
        const matchSpec = !spec || productSpec.includes(spec);
        return matchSearch && matchCategory && matchSpec;
    });
}

function setupFilterListeners() {
    const search = document.getElementById("searchInput");
    const category = document.getElementById("categoryFilter");
    const spec = document.getElementById("specFilter");

    const refreshProducts = () => {
        renderProducts(allProducts, isDeletePage, isCheckPage);
    };

    if (search) search.addEventListener("input", refreshProducts);
    if (category) category.addEventListener("change", refreshProducts);
    if (spec) spec.addEventListener("input", refreshProducts);
}
// =====================================================
// 🔽 SORTIERUNG
// =====================================================
function sortProducts(field) {
    sortDirection *= -1;

    allProducts.sort((a, b) => {
        let valA = getSortableProductValue(a, field);
        let valB = getSortableProductValue(b, field);

        if (typeof valA === "string") {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }

        if (valA < valB) return -1 * sortDirection;
        if (valA > valB) return 1 * sortDirection;
        return 0;
    });

    renderProducts(allProducts);
}

function getSortableProductValue(product, field) {
    if (field === "name") return getProductName(product);
    if (field === "spezification") return getProductSpec(product);
    return product[field] ?? "";
}

function getProductName(product) {
    if (product.name) return product.name;

    const material = materialTypes.find(mat => String(mat.id) === String(product.material_typ_id));
    return material?.name || "Ohne Material";
}

function getProductSpec(product) {
    if (product.spezification) return product.spezification;

    const material = materialTypes.find(mat => String(mat.id) === String(product.material_typ_id));
    return material?.specification || "";
}

// =====================================================
// 📊 SUMMARY
// =====================================================
function updateSummary(products) {
    const el = document.getElementById("summary");
    if (!el) return;

    const total = products.length;
    const frei = products.filter(p => p.stat === 10).length;
    const verliehen = products.filter(p => p.stat === 90).length;

    el.innerText = `Gesamt: ${total} | Frei: ${frei} | Verliehen: ${verliehen}`;
}

// =====================================================
// 🎨 FORMATIERUNGEN
// =====================================================
function formatStatus(stat) {
    switch (Number(stat)) {
        case 10: return '<span class="status-frei">frei</span>';
        case 90: return '<span class="status-verliehen">verliehen</span>';
        default: return stat;
    }
}

function formatDateDE(date) {
    if (!date) return "";
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function getStatusColor(stat) {
    switch (Number(stat)) {
        case 10: return "green";
        case 90: return "red";
        default: return "#999";
    }
}

// =====================================================
// 🗂️ KATEGORIEN & SPEZIFIKATION
// =====================================================
async function loadCategories() {
    try {
        const res = await fetch("/api/categories");
        const categories = await res.json();

        const select = document.getElementById("categorySelect");
        const filter = document.getElementById("categoryFilter");

        categories.forEach(cat => {
            categoryMap[cat.id] = cat.name;

            if (select) {
                const opt = document.createElement("option");
                opt.value = cat.id;
                opt.textContent = cat.name;
                select.appendChild(opt);
            }
            if (filter) {
                const opt = document.createElement("option");
                opt.value = cat.id;
                opt.textContent = cat.name;
                filter.appendChild(opt);
            }
        });

    } catch (err) {
        console.error("Fehler Kategorien:", err);
    }
}


function fillSpecFilter(products) {
    const select = document.getElementById("specFilter");
    if (!select) return;

    const specs = new Set();
    products.forEach(p => { if (p.spezification) specs.add(p.spezification); });

    specs.forEach(spec => {
        const opt = document.createElement("option");
        opt.value = spec;
        opt.textContent = spec;
        select.appendChild(opt);
    });
}

// =====================================================
// ➕ PRODUKT ANLEGEN
// =====================================================
function setupForm() {
    const form = document.getElementById("productForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const data = {
            material_typ_id: document.getElementById("materialTypeSelect").value,
            bez: document.getElementById("bez").value,
            Code: parseInt(document.getElementById("Code").value, 10),
            check_date: document.getElementById("check_date").value
        };

        try {
            const url = editingProductId ? `/api/products/${editingProductId}` : "/api/products";
            const method = editingProductId ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            alert(result.message);
            if (editingProductId) {
                window.location.href = "products.html";
                return;
            }
            document.getElementById("Code").value = "";
            loadProducts();
        } catch (err) {
            alert(err.message);
        }
    });
}

function setupEditMode() {
    const form = document.getElementById("productForm");
    if (!form) return;

    const params = new URLSearchParams(window.location.search);
    editingProductId = params.get("id");
    if (!editingProductId) return;

    const product = allProducts.find(p => String(p.id) === String(editingProductId));
    if (!product) {
        alert("Produkt wurde nicht gefunden.");
        window.location.href = "products.html";
        return;
    }

    document.title = "Produkt bearbeiten";
    const heading = document.querySelector("body > h1");
    if (heading) heading.textContent = "Produkt bearbeiten";
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.textContent = "Aktualisieren";

    document.getElementById("bez").value = product.bez || "";
    document.getElementById("Code").value = product.Code || "";

    const materialSelect = document.getElementById("materialTypeSelect");
    if (materialSelect) {
        materialSelect.value = product.material_typ_id || findMaterialTypeId(product) || "";
    }

    document.getElementById("check_date").value = toDateInputValue(product.check_date);
}

function findMaterialTypeId(product) {
    const material = materialTypes.find(mat =>
        mat.name === product.name &&
        String(mat.category_id) === String(product.category_id) &&
        (mat.specification || "") === (product.spezification || "")
    );

    return material?.id;
}

// =====================================================
// ❌ PRODUKT LÖSCHEN
// =====================================================
async function deleteProduct(id) {
    if (!confirm("Produkt wirklich loeschen?")) return;
    try {
        const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        alert(result.message);
        loadProducts();
    } catch (err) {
        alert("Fehler beim Loeschen: " + err.message);
    }
}

// =====================================================
// ✔️ CHECK DATE SETZEN
// =====================================================
async function checkProduct(id) {
    const today = new Date().toISOString().split("T")[0];
    try {
        const res = await fetch(`/api/products/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ check_date: today })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        alert(result.message);
        loadProducts();
    } catch (err) {
        alert(err.message);
    }
}

// =====================================================
// 📅 DEFAULT DATUM
// =====================================================
function setDefaultDate() {
    const field = document.getElementById("check_date");
    if (field && !field.value) field.value = new Date().toISOString().split("T")[0];
}

function toDateInputValue(date) {
    if (!date) return "";
    return String(date).split("T")[0];
}

// =====================================================
// 🎨 LOGIN CHECK
// =====================================================

// Pruefen, ob User angemeldet ist
async function checkLogin() {
    try {
        const res = await fetch("/api/users/me", { credentials: "include" });

        if (!res.ok) {
            // Nur redirect, wenn wir NICHT auf login.html sind
            if (!window.location.pathname.includes("login.html")) {
                localStorage.setItem("lastPage", window.location.pathname);
                window.location.href = "login.html";
            }
            return null;
        }

        const user = await res.json();
        // User Info auf der Seite anzeigen (falls vorhanden)
        const el = document.getElementById("userInfo");
        if (el) el.innerText = `Eingeloggt als: ${user.username} (${user.role})`;

        return user;

    } catch (err) {
        console.error("Fehler beim Laden des Users:", err);
        if (!window.location.pathname.includes("login.html")) {
            localStorage.setItem("lastPage", window.location.pathname);
            window.location.href = "login.html";
        }
        return null;
    }
}
function normalizeCode(code) {
    return String(Number(code));
}
