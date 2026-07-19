let plan = [];
let categories = [];

document.addEventListener("DOMContentLoaded", () => {
    const filterElement = document.getElementById("distributionFilter");
    const categoryElement = document.getElementById("categoryFilter");

    loadEvents();

    if (filterElement) filterElement.addEventListener("change", renderTable);
    if (categoryElement) categoryElement.addEventListener("change", renderTable);
});

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

}

function renderTable() {

    const tbody = document.getElementById("plan_table");
    tbody.innerHTML = "";

    const filter = document.getElementById("distributionFilter").value;

    plan.filter(item => {

    const category = document.getElementById("categoryFilter").value;

    if (category && item.category_name != category)
        return false;

    if (filter === "planned")
        return item.planned == 1;

    if (filter === "unplanned")
        return item.planned == 0;

    return true;

    }).forEach(item => {

        tbody.innerHTML += `
        <tr>
            <td>
                <input type="checkbox" class="planned" data-id="${item.id}" ${item.planned ? "checked" : ""}>
            </td>
            <td>${item.product_name}</td>
            <td>${item.input || ""}</td>
            <td>${item.cable || ""}</td>
            <td>${item.schuko}</td>
            <td>${item.cee16}</td>
            <td>${item.cee32}</td>
            <td>${item.cee63}</td>
            <td>${item.cee125}</td>
            <td>
                <input type="text" class="location" data-id="${item.id}" value="${item.location || ""}">
            </td>
        </tr>`;
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
async function savePlan() {

    const eventId = document.getElementById("event_id").value;

    if (!eventId) {
        alert("Bitte zuerst eine Veranstaltung auswählen.");
        return;
    }

    const items = [];

    document.querySelectorAll("#plan_table tr").forEach(row => {

        const check = row.querySelector(".planned");
        const location = row.querySelector(".location");

        items.push({
            distribution_item_id: Number(check.dataset.id),
            planned: check.checked ? 1 : 0,
            location: location.value
        });

    });

    const response = await fetch("/api/distribution-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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