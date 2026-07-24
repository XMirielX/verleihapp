// ==========================
// Distribution Frontend
// ==========================

const API = {
    products: "/api/products",
    distributions: "/api/distributions"
};

const productSelect = document.getElementById("product_id");
const distributionIdInput = document.getElementById("distribution_id");
const inputField = document.getElementById("input");
const cableField = document.getElementById("cable");
const schukoField = document.getElementById("schuko");
const cee16Field = document.getElementById("cee16");
const cee32Field = document.getElementById("cee32");
const cee63Field = document.getElementById("cee63");
const cee125Field = document.getElementById("cee125");
const tableBody = document.getElementById("distribution_table");

let products = [];
let distributions = [];

document.addEventListener("DOMContentLoaded", async () => {
    await loadProducts();
    await loadDistributions();
});

async function loadProducts() {
    try {
        const res = await fetch(API.products, { credentials: "include" });
        if (!res.ok) throw new Error("Produkte konnten nicht geladen werden");
        products = await res.json();
        renderProductSelect();
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

async function loadDistributions() {
    try {
        const res = await fetch(API.distributions, { credentials: "include" });
        if (!res.ok) throw new Error("Distributionen konnten nicht geladen werden");
        distributions = await res.json();
        renderProductSelect();
        renderDistributionTable();
        renderDistributionCards();
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

function renderProductSelect(currentProductId = null) {
    if (!productSelect) return;

    productSelect.innerHTML = '<option value="">Bitte auswählen</option>';

    const usedProducts = distributions
        .filter(d => Number(d.product_id) !== Number(currentProductId))
        .map(d => Number(d.product_id));

    products
        .filter(p => !usedProducts.includes(Number(p.id)))
        .sort((a, b) => (a.bez || "").localeCompare(b.bez || "", "de", { numeric: true }))
        .forEach(product => {
            const option = document.createElement("option");
            option.value = product.id;
            option.textContent = `${product.bez} (${product.name})`;
            productSelect.appendChild(option);
        });

    if (currentProductId) {
        productSelect.value = currentProductId;
    }
}
function renderDistributionCards() {
    const container = document.getElementById("distributionCards");
    if (!container) return;

    container.innerHTML = "";
distributions
    .sort((a, b) => {
        const bezA = products.find(p => p.id == a.product_id)?.bez || "";
        const bezB = products.find(p => p.id == b.product_id)?.bez || "";

        return bezA.localeCompare(bezB, "de", {
            numeric: true,
            sensitivity: "base"
        });
    })
    .forEach(item => {
        const product = products.find(p => Number(p.id) === Number(item.product_id));

        container.innerHTML += `
            <div class="distribution-card">
                <div class="distribution-title">${product?.bez ?? "-"}</div>

                <div><strong>Eingang:</strong> ${item.input || "-"}</div>
                <div><strong>Kabel:</strong> ${item.cable || "-"}</div>

                <div class="output-grid">
                    ${item.schuko ? `<div>Schuko: ${item.schuko}</div>` : ""}
                    ${item.cee16 ? `<div>CEE16: ${item.cee16}</div>` : ""}
                    ${item.cee32 ? `<div>CEE32: ${item.cee32}</div>` : ""}
                    ${item.cee63 ? `<div>CEE63: ${item.cee63}</div>` : ""}
                    ${item.cee125 ? `<div>CEE125: ${item.cee125}</div>` : ""}
                </div>

                <div style="margin-top:10px">
                    <button onclick="editDistribution(${item.id})">Bearbeiten</button>
                    <button onclick="deleteDistribution(${item.id})">Löschen</button>
                </div>
            </div>
        `;
    });
}
function renderDistributionTable() {
    if (!tableBody) return;

    tableBody.innerHTML = "";

    distributions.forEach((item) => {
        const product = products.find((p) => Number(p.id) === Number(item.product_id));
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${product ? product.bez : "-"}</td>
            <td>${item.input || "-"}</td>
            <td>${item.cable || "-"}</td>
            <td>${item.schuko ? item.schuko : ""}</td>
            <td>${item.cee16 ? item.cee16 : ""}</td>
            <td>${item.cee32 ? item.cee32 : ""}</td>
            <td>${item.cee63 ? item.cee63 : ""}</td>
            <td>${item.cee125 ? item.cee125 : ""}</td>
            <td>
                <button type="button" onclick="editDistribution(${item.id})">Bearbeiten</button>
                <button type="button" onclick="deleteDistribution(${item.id})">Löschen</button>
            </td>
        `;

        tableBody.appendChild(tr);
    });
}

function clearForm() {
    if (distributionIdInput) distributionIdInput.value = "";
    if (productSelect) productSelect.value = "";
    if (inputField) inputField.value = "";
    if (cableField) cableField.value = "";
    if (schukoField) schukoField.value = "0";
    if (cee16Field) cee16Field.value = "0";
    if (cee32Field) cee32Field.value = "0";
    if (cee63Field) cee63Field.value = "0";
    if (cee125Field) cee125Field.value = "0";
    renderProductSelect();
}

async function saveDistribution() {
    const payload = {
        product_id: productSelect?.value || "",
        input: inputField?.value?.trim() || "",
        cable: cableField?.value?.trim() || "",
        schuko: Number(schukoField?.value || 0),
        cee16: Number(cee16Field?.value || 0),
        cee32: Number(cee32Field?.value || 0),
        cee63: Number(cee63Field?.value || 0),
        cee125: Number(cee125Field?.value || 0)
    };

    if (!payload.product_id) {
        alert("Bitte ein Produkt auswählen");
        return;
    }

    try {
        const id = distributionIdInput?.value;
        const method = id ? "PUT" : "POST";
        const url = id ? `${API.distributions}/${id}` : API.distributions;

        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "include"
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "Speichern fehlgeschlagen");

        clearForm();
        await loadDistributions();
        alert(data?.message || "Distribution gespeichert");
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

async function editDistribution(id) {
    if (distributionIdInput) distributionIdInput.value = item.id;
    renderProductSelect(item.product_id);
    if (productSelect) productSelect.value = item.product_id;
    if (inputField) inputField.value = item.input || "";
    if (cableField) cableField.value = item.cable || "";
    if (schukoField) schukoField.value = item.schuko ?? 0;
    if (cee16Field) cee16Field.value = item.cee16 ?? 0;
    if (cee32Field) cee32Field.value = item.cee32 ?? 0;
    if (cee63Field) cee63Field.value = item.cee63 ?? 0;
    if (cee125Field) cee125Field.value = item.cee125 ?? 0;
}

async function deleteDistribution(id) {
    if (!confirm("Distribution wirklich löschen?")) return;

    try {
        const res = await fetch(`${API.distributions}/${id}`, {
            method: "DELETE",
            credentials: "include"
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "Löschen fehlgeschlagen");
        await loadDistributions();
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}
