// =====================================================
// 🌍 GLOBALE VARIABLEN
// =====================================================
let allProducts = [];
let categoryMap = {};
let sortDirection = 1;
let editingProductId = null;
let currentUser = null;

const page = window.location.pathname;

// =====================================================
// 🚀 INIT
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
    await loadCategories();
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

        if (page.includes("products.html")) {
            renderProducts(products);
        }
        if (page.includes("productdelete.html")) {
            renderProducts(products, true);
        }
        if (page.includes("productcheck.html")) {
            renderProducts(products, false, true);
        }

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
            item.className = "product-item";

            const statusColor = getStatusColor(product.stat);

            let buttons = "";
            if (showDelete) buttons += `<button class="small" onclick="deleteProduct(${product.id})">Loeschen</button>`;
            if (showCheck) buttons += `<button class="small" onclick="checkProduct(${product.id})">pruefen</button>`;

            item.style.borderLeft = `6px solid ${statusColor}`;
            if (isProductOverview(showDelete, showCheck) && isAdmin()) {
                item.title = "Produkt bearbeiten";
                item.addEventListener("click", (event) => {
                    if (!event.target.closest("button")) openProductEdit(product.id);
                });
            }
            item.innerHTML = `
                    <div class="product-title">${product.name}${product.spezification ? " (" + product.spezification + ")" : ""}</div>
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
            <td>${product.name}</td>
            <td>${formatStatus(product.stat)}</td>
            <td>${product.bez}</td>
            <td>${product.Code}</td>
            <td>${categoryMap[product.category_id] || "-"}</td>
            <td>${product.spezification || ""}</td>
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

// =====================================================
// 🔍 FILTER & SUCHE
// =====================================================
function filterProducts(products) {
    const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
    const category = document.getElementById("categoryFilter")?.value || "";
    const spec = document.getElementById("specFilter")?.value.toLowerCase() || "";

    return products.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(search) || String(p.Code).includes(search);
        const matchCategory = !category || p.category_id == category;
        const matchSpec = !spec || (p.spezification || "").toLowerCase().includes(spec);
        return matchSearch && matchCategory && matchSpec;
    });
}

function setupFilterListeners() {
    const search = document.getElementById("searchInput");
    const category = document.getElementById("categoryFilter");
    const spec = document.getElementById("specFilter");

    if (search) search.addEventListener("input", () => renderProducts(allProducts));
    if (category) category.addEventListener("change", () => renderProducts(allProducts));
    if (spec) spec.addEventListener("input", () => renderProducts(allProducts));
}

// =====================================================
// 🔽 SORTIERUNG
// =====================================================
function sortProducts(field) {
    sortDirection *= -1;

    allProducts.sort((a, b) => {
        let valA = a[field];
        let valB = b[field];

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
            name: document.getElementById("name").value,
            bez: document.getElementById("bez").value,
            Code: parseInt(document.getElementById("Code").value, 10),
            category_id: document.getElementById("categorySelect").value,
            spezification: document.getElementById("spezification").value,
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

    document.getElementById("name").value = product.name || "";
    document.getElementById("bez").value = product.bez || "";
    document.getElementById("Code").value = product.Code || "";
    document.getElementById("categorySelect").value = product.category_id || "";

    const specSelect = document.getElementById("spezification");
    const specValue = product.spezification || "-";
    if (specSelect && !Array.from(specSelect.options).some(option => option.value === specValue)) {
        const option = document.createElement("option");
        option.value = specValue;
        option.textContent = specValue;
        specSelect.appendChild(option);
    }
    if (specSelect) specSelect.value = specValue;

    document.getElementById("check_date").value = toDateInputValue(product.check_date);
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

