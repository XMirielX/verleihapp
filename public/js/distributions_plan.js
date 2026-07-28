let plan = [];
let categories = [];
let currentUser = null;
let canEdit = false;


document.addEventListener("DOMContentLoaded", async () => {
        currentUser = await checkLogin();

    await loadCurrentUser();

    const filterElement = document.getElementById("distributionFilter");
    const categoryElement = document.getElementById("categoryFilter");

    await loadEvents();

    if (filterElement)
        filterElement.addEventListener("change", renderView);

    if (categoryElement)
        categoryElement.addEventListener("change", renderView);

    updateRights();
});

function updateRights() {

    document.getElementById("saveButton").style.display =
        canEdit ? "" : "none";

    document.getElementById("transferButton").style.display =
        canEdit ? "" : "none";
}

async function loadCurrentUser() {
    const res = await fetch("/api/users/me", {
        credentials: "include"
    });

    if (!res.ok) {
        location.href = "login.html";
        return;
    }

    currentUser = await res.json();
    canEdit = currentUser.role === "admin";
}
async function loadEvents() {
    const res = await fetch("/api/events");
    const events = await res.json();

    const select = document.getElementById("event_id");
    select.innerHTML = '<option value="">Bitte auswählen</option>';

    events.forEach(event => {
        select.innerHTML += `<option value="${event.id}">${event.name}</option>`;
    });

}

async function loadPlan() {

    const eventId = document.getElementById("event_id").value;
    if (!eventId) return;
    const res = await fetch(`/api/distribution-plan/${eventId}`);
    plan = await res.json();
    loadCategories();
    renderTable();
    renderCards();

}

function renderTable() {

    const tbody = document.getElementById("plan_table");
    tbody.innerHTML = "";

    getFilteredPlan().forEach(item => {

        tbody.innerHTML += `
        <tr>
        <td>
            <input type="checkbox" class="planned" 
            data-id="${item.id}" 
            ${item.planned ? "checked" : ""}
            ${!canEdit ? "disabled" : ""}></td>
            <td>${item.product_name}</td>
            <td>${item.input || ""}</td>
            <td>${item.cable || ""}</td>
            <td>${item.schuko ? item.schuko : ""}</td>
            <td>${item.cee16 ? item.cee16 : ""}</td>
            <td>${item.cee32 ? item.cee32 : ""}</td>
            <td>${item.cee63 ? item.cee63 : ""}</td>
            <td>${item.cee125 ? item.cee125 : ""}</td>
            <td>
                <button 
                    type="button"
                    onclick="openDistributionImages(${item.id}, true)">
                    📷
                </button>
                <input type="text" 
                class="location" 
                data-id="${item.id}" 
                value="${item.location || ""}"
                ${!canEdit ? "disabled" : ""}>
            </td>
        </tr>`;
    });
}
function renderCards() {

    const container = document.getElementById("distributionCards");
    container.innerHTML = "";

    getFilteredPlan().forEach(item => {

        const card = document.createElement("div");
        card.className = "distribution-card " + 
        (item.planned ? "planned" : "unplanned");

        card.innerHTML = `
            <div class="distribution-header">

                <strong>${item.product_name}</strong>

                <button 
                    class="small image-button"
                    onclick="openDistributionImages(${item.id}, true)">
                    📷
                </button>

                <label class="switch">
                    <input type="checkbox" class="planned"
                    data-id="${item.id}"
                    ${item.planned ? "checked" : ""}
                    ${!canEdit ? "disabled" : ""}>
                </label>
            </div>


            <div class="distribution-info">
                <div>
                    <small>Eingang</small>
                    <strong>${item.input || "-"}</strong>
                </div>

                <div>
                    <small>Kabel</small>
                    <strong>${item.cable || "-"}</strong>
                </div>
            </div>


            <div class="output-title">
                Ausgänge
            </div>


            <div class="output-grid">
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


            <label class="location-label">
                Ort
                <input type="text"
                class="location"
                data-id="${item.id}"
                value="${item.location || ""}">
            </label>
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

    if (!confirm("Distribution in die Materialplanung übernehmen?"))
        return;

    const res = await fetch(`/api/distribution-plan/${eventId}/generate`, {
        method: "POST"
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
    const values = [...new Set(plan.map(x => x.category_name).filter(Boolean))].sort();

    select.innerHTML = '<option value="">Alle</option>';

    values.forEach(c => {
        select.innerHTML += `<option value="${c}">${c}</option>`;
    });
}

function getFilteredPlan() {

    const filter = document.getElementById("distributionFilter").value;
    const category = document.getElementById("categoryFilter").value;

    return plan.filter(item => {

        if (category && item.category_name != category)
            return false;

        if (filter === "planned" && item.planned != 1)
            return false;

        if (filter === "unplanned" && item.planned != 0)
            return false;

        return true;
    });
}
async function savePlan() {
    const eventId = document.getElementById("event_id").value;
    if (!eventId) {
        alert("Bitte zuerst eine Veranstaltung auswählen.");
        return;
    }
    const items = [];
    const handled = new Set();
    document.querySelectorAll(".planned").forEach(check => {
        const id = Number(check.dataset.id);
        // verhindert doppelte Einträge (Tabelle + Cards)
        if (handled.has(id))
            return;
        handled.add(id);
        const location = document.querySelector(
            `.location[data-id="${id}"]`
        );
        items.push({
            distribution_item_id: id,
            planned: check.checked ? 1 : 0,
            location: location ? location.value : ""
        });
    });
    const response = await fetch("/api/distribution-plan", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            event_id: eventId,
            items: items
        })
    });
    const result = await response.json();
    if (result.error) {
        alert(result.error);
        return;
    }
    alert("Planung gespeichert.");

    loadPlan();
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