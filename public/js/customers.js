let customers = [];
let editingCustomerId = null;

// =====================================================
// INITIALISIERUNG
// =====================================================

async function initCustomerPage() {
  editingCustomerId = null;

  resetCustomerForm();

  await loadPriceCategoriesCustomer();
  await loadCustomers();

  const editId = sessionStorage.getItem("editCustomerId");

  if (editId) {
    sessionStorage.removeItem("editCustomerId");

    editCustomer(Number(editId));
  }
}

// =====================================================
// PREISKATEGORIEN
// =====================================================

function renderPriceCategoriesCustomer() {
  const select = document.getElementById("customerPriceCategory");

  if (!select) return;

  select.innerHTML = `
        <option value="">
            Bitte auswählen
        </option>
    `;

  priceCategories
    .filter((category) => category.stat)
    .forEach((category) => {
      const option = document.createElement("option");

      option.value = category.id;
      option.textContent = category.name;

      select.appendChild(option);
    });
}

// =====================================================
// KUNDEN LADEN
// =====================================================

async function loadCustomers() {
  try {
    const response = await fetch("/api/customers");

    if (!response.ok) {
      throw new Error("Kunden konnten nicht geladen werden");
    }

    customers = await response.json();

    renderCustomers();
  } catch (err) {
    console.error(err);

    alert("Fehler beim Laden der Kunden.");
  }
}

// =====================================================
// KUNDEN RENDERN
// =====================================================

function renderCustomers() {
  renderCustomerTable();
  renderCustomerCards();
}

// =====================================================
// KUNDEN – TABELLE
// =====================================================

function renderCustomerTable() {
  const tbody = document.getElementById("customerTableBody");

  if (!tbody) return;

  tbody.innerHTML = "";

  customers.forEach((customer) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
            <td>
                ${escapeHtml(customer.name)}
            </td>

            <td>
                ${escapeHtml(customer.street || "")}<br>
                ${escapeHtml(
                  `${customer.plz || ""} ${customer.city || ""}`.trim(),
                )}
            </td>

            <td>
                ${escapeHtml(customer.email || "")}
            </td>

            <td>
                ${escapeHtml(customer.phone || "")}
            </td>

            <td>
                ${escapeHtml(customer.price_category || "Default")}
            </td>
<td>
    ${customer.knz_privat ? "Privat" : "Organisation"}
</td>
            <td>
                <span class="status-badge ${
                  customer.stat ? "status-active" : "status-inactive"
                }">
                    ${customer.stat ? "Aktiv" : "Inaktiv"}
                </span>
            </td>

            <td>

                <button
                    type="button"
                    class="btn"
                    onclick="openCustomerEdit(${customer.id})"
                    aria-label="Bearbeiten"
                    title="Bearbeiten">
                    <i class="fa-solid fa-pen"></i>
                </button>

                ${
                  customer.stat
                    ? `
                            <button
                                type="button"
                                class="btn btn-danger"
                                onclick="deleteCustomer(${customer.id})"
                                aria-label="Deaktivieren"
                                title="Deaktivieren">
                                <i class="fa-solid fa-ban"></i>
                            </button>
                        `
                    : `
                            <button
                                type="button"
                                class="btn"
                                onclick="restoreCustomer(${customer.id})"
                                aria-label="Aktivieren"
                                title="Aktivieren">
                                <i class="fa-solid fa-check"></i>
                            </button>
                        `
                }

            </td>
        `;

    tbody.appendChild(tr);
  });
}

// =====================================================
// KUNDEN – MOBILE CARDS
// =====================================================

function renderCustomerCards() {
  const container = document.getElementById("customerCards");

  if (!container) return;

  container.innerHTML = "";

  customers.forEach((customer) => {
    const card = document.createElement("div");

    card.className = "card customer-card";

    const address = [
      customer.street,
      `${customer.plz || ""} ${customer.city || ""}`.trim(),
    ]
      .filter(Boolean)
      .map((line) => escapeHtml(line))
      .join("<br>");

    card.innerHTML = `

    <div class="card-header customer-card-header">

        <div class="customer-title">

            <h3>
                ${escapeHtml(customer.name)}
            </h3>

            <span class="status-badge ${
              customer.stat ? "status-active" : "status-inactive"
            }">
                ${customer.stat ? "Aktiv" : "Inaktiv"}
            </span>

        </div>

    </div>


    <div class="card-body customer-card-body">

        ${
          address
            ? `
                    <div class="customer-detail">
                        <span class="customer-detail-label">
                            Adresse
                        </span>

                        <div class="customer-detail-value">
                            ${address}
                        </div>
                    </div>
                `
            : ""
        }


        ${
          customer.email
            ? `
                    <div class="customer-detail">
                        <span class="customer-detail-label">
                            E-Mail
                        </span>

                        <a
                            class="customer-detail-value"
                            href="mailto:${escapeHtml(customer.email)}">
                            ${escapeHtml(customer.email)}
                        </a>
                    </div>
                `
            : ""
        }


        ${
          customer.phone
            ? `
                    <div class="customer-detail">
                        <span class="customer-detail-label">
                            Telefon
                        </span>

                        <a
                            class="customer-detail-value"
                            href="tel:${escapeHtml(customer.phone)}">
                            ${escapeHtml(customer.phone)}
                        </a>
                    </div>
                `
            : ""
        }

<div class="customer-detail">

    <span class="customer-detail-label">
        Kundentyp
    </span>

    <span class="price-category-badge">
        ${customer.knz_privat ? "Privat" : "Organisation"}
    </span>

</div>
        <div class="customer-detail">

            <span class="customer-detail-label">
                Preiskategorie
            </span>

            <span class="price-category-badge">
                ${escapeHtml(customer.price_category || "Default")}
            </span>

        </div>

    </div>


    <div class="card-actions">

        <button
            type="button"
            class="btn"
            onclick="openCustomerEdit(${customer.id})"
            aria-label="Bearbeiten"
            title="Bearbeiten">
            <i class="fa-solid fa-pen"></i>
        </button>

        ${
          customer.stat
            ? `
                    <button
                        type="button"
                        class="btn btn-danger"
                        onclick="deleteCustomer(${customer.id})"
                        aria-label="Deaktivieren"
                        title="Deaktivieren">
                        <i class="fa-solid fa-ban"></i>
                    </button>
                `
            : `
                    <button
                        type="button"
                        class="btn"
                        onclick="restoreCustomer(${customer.id})"
                        aria-label="Aktivieren"
                        title="Aktivieren">
                        <i class="fa-solid fa-check"></i>
                    </button>
                `
        }

    </div>

        `;

    container.appendChild(card);
  });
}

// KUNDE BEARBEITEN
// =====================================================
function editCustomer(id) {
  const customer = customers.find((c) => c.id === id);

  if (!customer) return;

  editingCustomerId = id;

  document.getElementById("customerName").value = customer.name || "";

  document.getElementById("customerStreet").value = customer.street || "";

  document.getElementById("customerPlz").value = customer.plz || "";

  document.getElementById("customerCity").value = customer.city || "";

  document.getElementById("customerEmail").value = customer.email || "";

  document.getElementById("customerPhone").value = customer.phone || "";

  document.getElementById("customerPriceCategory").value =
    customer.price_category_id || "";

  document.getElementById("customerStat").checked = !!customer.stat;

  document.getElementById("customerFormTitle").textContent = "Kunde bearbeiten";
  document.getElementById("customerKnzPrivat").checked = !!customer.knz_privat;
  const saveButton = document.getElementById("customerSaveButton");
  saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>';
  saveButton.setAttribute("aria-label", "Speichern");
  saveButton.title = "Speichern";
}

async function openCustomerEdit(id) {
  const customer = customers.find((c) => c.id === id);

  if (!customer) {
    console.error("Kunde nicht gefunden:", id);
    return;
  }

  sessionStorage.setItem("editCustomerId", String(id));

  await loadPage("customersadd");
}

// =====================================================
// KUNDE SPEICHERN / ÄNDERN
// =====================================================

async function saveCustomer() {
  const name = document.getElementById("customerName").value.trim();

  if (!name) {
    alert("Bitte einen Namen eingeben.");

    return;
  }

  const priceCategorySelect = document.getElementById("customerPriceCategory");

  const customer = {
    name,

    street: document.getElementById("customerStreet").value.trim(),

    plz: document.getElementById("customerPlz").value.trim(),

    city: document.getElementById("customerCity").value.trim(),

    email: document.getElementById("customerEmail").value.trim(),

    phone: document.getElementById("customerPhone").value.trim(),

    price_category_id: priceCategorySelect?.value || null,

    knz_privat: document.getElementById("customerKnzPrivat").checked ? 1 : 0,

    stat: document.getElementById("customerStat").checked ? 1 : 0,
  };

  try {
    const url = editingCustomerId
      ? `/api/customers/${editingCustomerId}`
      : "/api/customers";

    const method = editingCustomerId ? "PUT" : "POST";

    const response = await fetch(url, {
      method,

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(customer),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Kunde konnte nicht gespeichert werden");
    }

    resetCustomerForm();

    await loadCustomers();
  } catch (err) {
    console.error("Fehler beim Speichern des Kunden:", err);

    alert(err.message);
  }
}

// =====================================================
// KUNDE DEAKTIVIEREN
// =====================================================

async function deleteCustomer(id) {
  const customer = customers.find((c) => c.id === id);

  if (!customer) return;

  if (!confirm(`Kunde "${customer.name}" wirklich deaktivieren?`)) {
    return;
  }

  try {
    const response = await fetch(`/api/customers/${id}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Kunde konnte nicht deaktiviert werden");
    }

    await loadCustomers();
  } catch (err) {
    console.error("Fehler beim Deaktivieren des Kunden:", err);

    alert(err.message);
  }
}

// =====================================================
// KUNDE AKTIVIEREN
// =====================================================

async function restoreCustomer(id) {
  const customer = customers.find((c) => c.id === id);

  if (!customer) return;

  try {
    const response = await fetch(`/api/customers/${id}`, {
      method: "PUT",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        name: customer.name,
        street: customer.street || "",
        plz: customer.plz || "",
        city: customer.city || "",
        email: customer.email || "",
        phone: customer.phone || "",
        price_category_id: customer.price_category_id || null,
        knz_privat: customer.knz_privat ? 1 : 0,
        stat: 1,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Kunde konnte nicht aktiviert werden");
    }

    await loadCustomers();
  } catch (err) {
    console.error("Fehler beim Aktivieren des Kunden:", err);

    alert(err.message);
  }
}

// =====================================================
// FORMULAR ZURÜCKSETZEN
// =====================================================

function resetCustomerForm() {
  editingCustomerId = null;

  const fields = [
    "customerName",
    "customerStreet",
    "customerPlz",
    "customerCity",
    "customerEmail",
    "customerPhone",
    "customerPriceCategory",
    "customerKnzPrivat",
  ];

  fields.forEach((id) => {
    const element = document.getElementById(id);

    if (element) {
      element.value = "";
    }
  });

  const stat = document.getElementById("customerStat");

  if (stat) {
    stat.checked = true;
  }

  const title = document.getElementById("customerFormTitle");

  if (title) {
    title.textContent = "Kunde anlegen";
  }
  const knzPrivat = document.getElementById("customerKnzPrivat");

  if (knzPrivat) {
    knzPrivat.checked = false;
  }
  const button = document.getElementById("customerSaveButton");

  if (button) {
    button.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>';
    button.setAttribute("aria-label", "Speichern");
    button.title = "Speichern";
  }
}
// =====================================================
// PREISKATEGORIEN LADEN
// =====================================================

async function loadPriceCategoriesCustomer() {
  try {
    const response = await fetch("/api/prices");

    if (!response.ok) {
      throw new Error("Preiskategorien konnten nicht geladen werden");
    }

    priceCategories = await response.json();

    renderPriceCategoriesCustomer();
  } catch (err) {
    console.error("Fehler beim Laden der Preiskategorien:", err);

    alert("Fehler beim Laden der Preiskategorien.");
  }
}

// =====================================================
// HTML ESCAPEN
// =====================================================

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
