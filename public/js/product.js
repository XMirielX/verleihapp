// =====================================================
// 🌍 GLOBALE VARIABLEN
// =====================================================
let allProducts = [];
let categoryMap = {};
let sortDirectionProducts = 1;
let editingProductId = null;

function getProductPageFlags() {
  const currentPage = window.currentPage || window.location.pathname || "";

  return {
    isDeletePage: currentPage.includes("productdelete"),
    isCheckPage: currentPage.includes("productcheck"),
  };
}

// =====================================================
// 🚀 INIT
// =====================================================
async function initProductPage() {
  await loadCategories();
  await loadMaterialTypes();
  await loadProducts();

  const adminBtn = document.getElementById("adminBtn");
  if (adminBtn) {
    adminBtn.style.display = isAdmin() ? "inline-block" : "none";
  }

  document.querySelectorAll(".adminOnly").forEach((btn) => {
    btn.style.display = isAdmin() ? "inline-block" : "none";
  });

  fillSpecFilter(allProducts);
  setupEditMode();
  setupForm();
  setupFilterListeners();
  setDefaultDate();
}

// =====================================================
// 📦 PRODUKTE LADEN
// =====================================================
async function loadProducts() {
  try {
    const res = await fetch("/api/products");
    const products = await res.json();

    allProducts = products;

    renderProducts(products);
  } catch (err) {
    console.error("Fehler beim Laden der Produkte:", err);
  }
}

async function openProductEdit(id) {
  if (!isAdmin()) {
    return;
  }

  sessionStorage.setItem("editProductId", String(id));

  await loadPage("productadd");
}

function canProduct(action) {
  return hasRole(...(permissions.products?.[action] || []));
}

// =====================================================
// 🧾 PRODUKTE RENDERN
// =====================================================
function renderProducts(products) {
  const table = document.getElementById("productTable");
  const tableBody = document.getElementById("productTableBody");
  const container = document.getElementById("productTableContainer");

  if (!table || !tableBody || !container) return;

  tableBody.innerHTML = "";
  container.innerHTML = "";

  const filtered = filterProducts(products);

  // 📱 Mobile
  if (window.innerWidth <= 768) {
    table.style.display = "none";
    container.style.display = "flex";

    filtered.forEach((product) => {
      const item = document.createElement("div");
      item.className = "card product-card";

      const statusColor = getStatusColor(product.stat);

      let buttons = "";

      if (canProduct("delete")) {
        buttons += `<button class="small" onclick="deleteProduct(${product.id})" aria-label="Löschen" title="Löschen"><i class="fa-solid fa-trash"></i></button>`;
      }

      if (canProduct("check")) {
        buttons += `<button class="small" onclick="checkProduct(${product.id})">Check</button>`;
      }

      item.style.borderLeftWidth = "6px";
      item.style.borderLeftColor = statusColor;
      if (canProduct("edit")) {
        item.title = "Produkt bearbeiten";
        item.addEventListener("click", (event) => {
          if (!event.target.closest("button")) openProductEdit(product.id);
        });
      }
      const productSpec = getProductSpec(product);

      item.innerHTML = `
                <div class="product-title">${product.bez || ""}</div>
                <div class="product-sub">${categoryMap[product.category_id] || "-"}${productSpec ? " / " + productSpec : ""}</div>
                <div class="product-info">Barcode: ${product.Code || "-"}</div>
                <div class="product-info">Prüfung: ${formatDateDE(product.check_date)}</div>
                ${buttons ? `<div class="product-actions">${buttons}</div>` : ""}
            `;
      container.appendChild(item);
    });

    return;
  }

  // 💻 Desktop
  table.style.display = "";

  filtered.forEach((product) => {
    const row = document.createElement("tr");

    let buttons = "";

    if (canProduct("delete")) {
      buttons += `<button class="small" onclick="deleteProduct(${product.id})" aria-label="Löschen" title="Löschen"><i class="fa-solid fa-trash"></i></button>`;
    }

    if (canProduct("check")) {
      buttons += `<button class="small" onclick="checkProduct(${product.id})">Check</button>`;
    }

    row.innerHTML = `
    <td>${product.bez || ""}</td>
    <td>${formatStatus(product.stat)}</td>
    <td>${product.Code || ""}</td>
    <td>${categoryMap[product.category_id] || "-"}</td>
    <td>${getProductSpec(product)}</td>
    <td>${formatDateDE(product.check_date)}</td>
    <td>${buttons}</td>
  `;

    if (canProduct("edit")) {
      row.classList.add("clickable-row");
      row.title = "Produkt bearbeiten";

      row.addEventListener("click", (event) => {
        if (!event.target.closest("button")) {
          openProductEdit(product.id);
        }
      });
    }

    tableBody.appendChild(row);
  });

  updateSummary(filtered);
}

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

  materialTypes.forEach((mat) => {
    const option = document.createElement("option");

    option.value = mat.id;
    option.textContent = `${mat.category_name} - ${mat.name} ${mat.specification ?? ""}`;

    select.appendChild(option);
  });
}
// =====================================================
// 🔍 FILTER & SUCHE
// =====================================================
function filterProducts(products) {
  const search =
    document.getElementById("searchInput")?.value.toLowerCase() || "";
  const category = document.getElementById("categoryFilter")?.value || "";
  const spec = document.getElementById("specFilter")?.value.toLowerCase() || "";

  return products.filter((p) => {
    const productName = getProductName(p).toLowerCase();
    const productSpec = getProductSpec(p).toLowerCase();
    const matchSearch =
      productName.includes(search) || String(p.Code).includes(search);
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
    renderProducts(allProducts);
  };

  if (search) search.addEventListener("input", refreshProducts);
  if (category) category.addEventListener("change", refreshProducts);
  if (spec) spec.addEventListener("input", refreshProducts);
}
// =====================================================
// 🔽 SORTIERUNG
// =====================================================
function sortProducts(field) {
  sortDirectionProducts *= -1;

  allProducts.sort((a, b) => {
    let valA = getSortableProductValue(a, field);
    let valB = getSortableProductValue(b, field);

    if (typeof valA === "string") {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }

    if (valA < valB) return -1 * sortDirectionProducts;
    if (valA > valB) return 1 * sortDirectionProducts;
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

  const material = materialTypes.find(
    (mat) => String(mat.id) === String(product.material_typ_id),
  );
  return material?.name || "Ohne Material";
}

function getProductSpec(product) {
  if (product.spezification) return product.spezification;

  const material = materialTypes.find(
    (mat) => String(mat.id) === String(product.material_typ_id),
  );
  return material?.specification || "";
}

// =====================================================
// 📊 SUMMARY
// =====================================================
function updateSummary(products) {
  const el = document.getElementById("summary");
  if (!el) return;

  const total = products.length;
  const frei = products.filter((p) => p.stat === 10).length;
  const verliehen = products.filter((p) => p.stat === 90).length;

  el.innerText = `Gesamt: ${total} | Frei: ${frei} | Verliehen: ${verliehen}`;
}

// =====================================================
// 🎨 FORMATIERUNGEN
// =====================================================
function formatStatus(stat) {
  switch (Number(stat)) {
    case 10:
      return '<span class="status-frei">frei</span>';
    case 90:
      return '<span class="status-verliehen">verliehen</span>';
    default:
      return stat;
  }
}

function formatDateDE(date) {
  if (!date) return "";
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function getStatusColor(stat) {
  switch (Number(stat)) {
    case 10:
      return "green";
    case 90:
      return "red";
    default:
      return "#999";
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

    categories.forEach((cat) => {
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
  products.forEach((p) => {
    if (p.spezification) specs.add(p.spezification);
  });

  specs.forEach((spec) => {
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
      check_date: document.getElementById("check_date").value,
    };

    try {
      const url = editingProductId
        ? `/api/products/${editingProductId}`
        : "/api/products";
      const method = editingProductId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      alert(result.message);
      if (editingProductId) {
        editingProductId = null;
        await loadPage("products");
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

  const editId = sessionStorage.getItem("editProductId");

  if (!editId) return;

  sessionStorage.removeItem("editProductId");

  editingProductId = Number(editId);
  if (!editingProductId) return;

  const product = allProducts.find(
    (p) => String(p.id) === String(editingProductId),
  );
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
    materialSelect.value =
      product.material_typ_id || findMaterialTypeId(product) || "";
  }

  document.getElementById("check_date").value = toDateInputValue(
    product.check_date,
  );
}

function findMaterialTypeId(product) {
  const material = materialTypes.find(
    (mat) =>
      mat.name === product.name &&
      String(mat.category_id) === String(product.category_id) &&
      (mat.specification || "") === (product.spezification || ""),
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
      body: JSON.stringify({ check_date: today }),
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
  if (field && !field.value)
    field.value = new Date().toISOString().split("T")[0];
}

function toDateInputValue(date) {
  if (!date) return "";
  return String(date).split("T")[0];
}

function normalizeCode(code) {
  return String(Number(code));
}
