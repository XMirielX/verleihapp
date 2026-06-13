// =====================================================
// 🌍 GLOBALE VARIABLEN
// =====================================================
let allEvents = [];
let sortDirection = 1;
let endWasManuallyChanged = false;
let editingEventId = null;

const form = document.getElementById("eventForm");
const searchInput = document.getElementById("searchInput");
const table = document.getElementById("eventTable");
const container = document.getElementById("eventTableContainer");

// =====================================================
// 🚀 INIT
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
    user = await checkLogin();
    const adminBtn = document.getElementById("adminBtn");
    if (adminBtn) {
        adminBtn.style.display = (!user || user.role !== "admin") ? "none" : "inline-block";
    }
    await loadEvents();
    setupEditMode();
    setupForm();
    setupSearch();
});


// =====================================================
// 📦 EVENTS LADEN
// =====================================================
async function loadEvents() {
    try {
        const res = await fetch("/api/events");
        const events = await res.json();

        allEvents = sortEventsSmart(events);
        renderEvents(allEvents);

    } catch (err) {
        console.error("Fehler beim Laden der Events:", err);
    }
}


// =====================================================
// 🧾 EVENTS RENDERN – MOBILE & DESKTOP
// =====================================================
function renderEvents(events) {
    const table = document.getElementById("eventTable");
    const container = document.getElementById("eventTableContainer");

    if (!table || !container) return;

    const showDelete = window.location.pathname.includes("eventsdelete.html");
    const canEdit = window.location.pathname.includes("events.html") && !showDelete;

    // Mobile Ansicht
    if (window.innerWidth <= 768) {
        table.style.display = "none";   // Tabelle ausblenden
        container.innerHTML = "";        // Karten-Container leeren

        events.forEach(ev => {
            const status = getEventStatus(ev); // "done", "active", etc.
            let color = "#999"; // default
            if (status === "done") color = "green";
            else if (status === "active") color = "#007bff";

            const item = document.createElement("div");
            item.className = "event-item";
            item.style.borderLeft = `6px solid ${color}`;
            if (canEdit && !isEventClosed(ev)) {
                item.title = "Veranstaltung bearbeiten";
                item.addEventListener("click", (event) => {
                    if (!event.target.closest("button")) openEventEdit(ev.id);
                });
            } else if (canEdit) {
                item.title = "Abgeschlossene Veranstaltungen koennen nicht bearbeitet werden";
            }

            item.innerHTML = `
                <div class="event-title">${ev.name}</div>
                <div class="event-sub">
                    ${ev.costumer || "-"}<br>
                    ${formatDateDE(ev.start)} – ${formatDateDE(ev.ende)}
                </div>
                ${showDelete ? `<div class="event-actions"><button class="small" onclick="deleteEvent(${ev.id})">🗑️ Löschen</button></div>` : ""}
            `;
            container.appendChild(item);
        });

        return;
    }

    // Desktop Ansicht
    table.style.display = "table";
    const tbody = table.querySelector("tbody");
    tbody.innerHTML = "";

    events.forEach(ev => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${ev.name}</td>
            <td>${formatStatus(ev.stat)}</td>
            <td>${ev.costumer || "-"}</td>
            <td>${formatDateDE(ev.start)}</td>
            <td>${formatDateDE(ev.ende)}</td>
            ${showDelete ? `<td><button class="small" onclick="deleteEvent(${ev.id})">🗑️ Löschen</button></td>` : "<td></td>"}
        `;
        if (!showDelete) row.lastElementChild.remove();
        if (canEdit && !isEventClosed(ev)) {
            row.classList.add("clickable-row");
            row.title = "Veranstaltung bearbeiten";
            row.addEventListener("click", (event) => {
                if (!event.target.closest("button")) openEventEdit(ev.id);
            });
        } else if (canEdit) {
            row.title = "Abgeschlossene Veranstaltungen koennen nicht bearbeitet werden";
        }
        tbody.appendChild(row);
    });
}

function openEventEdit(id) {
    window.location.href = `eventadd.html?id=${encodeURIComponent(id)}`;
}
// =====================================================
// Dynamisch neu rendern bei Resize
// =====================================================
window.addEventListener("resize", () => {
    renderEvents(allEvents);
});

// =====================================================
// ➕ EVENT ANLEGEN
// =====================================================
function setupForm() {
    const form = document.getElementById("eventForm");
    if (!form) return;
    
    document.getElementById("ende").addEventListener("input", () => {
        endWasManuallyChanged = true;
    });
    document.getElementById("start").addEventListener("change", (e) => {
        const startValue = e.target.value;
        if (!startValue) return;

        const startDate = new Date(startValue);

        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 2); // = 3 Tage Event

        const formatted = endDate.toISOString().split("T")[0];

        const endInput = document.getElementById("ende");

        // nur überschreiben, wenn User NICHT manuell eingegriffen hat
        if (!endWasManuallyChanged) {
            endInput.value = formatted;
        }

        endInput.min = startValue;
    });
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
   
        const data = {
            name: document.getElementById("name").value,
            stat: document.getElementById("stat").value,
            costumer: document.getElementById("costumer").value,
            start: document.getElementById("start").value,
            ende: document.getElementById("ende").value
        };

        try {
            const url = editingEventId ? `/api/events/${editingEventId}` : "/api/events";
            const method = editingEventId ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error);

            alert(result.message || "Event gespeichert (ID: " + result.id + ")");
            if (editingEventId) {
                window.location.href = "events.html";
                return;
            }
            form.reset();
                endWasManuallyChanged = false;
            loadEvents();

        } catch (err) {
            alert(err.message);
        }
    });
}

function setupEditMode() {
    const form = document.getElementById("eventForm");
    if (!form) return;

    const params = new URLSearchParams(window.location.search);
    editingEventId = params.get("id");
    if (!editingEventId) return;

    const event = allEvents.find(e => String(e.id) === String(editingEventId));
    if (!event) {
        alert("Veranstaltung wurde nicht gefunden.");
        window.location.href = "events.html";
        return;
    }
    if (isEventClosed(event)) {
        alert("Abgeschlossene Veranstaltungen koennen nicht bearbeitet werden.");
        window.location.href = "events.html";
        return;
    }

    document.title = "Veranstaltung bearbeiten";
    const heading = document.querySelector("body > h1");
    if (heading) heading.textContent = "Veranstaltung bearbeiten";
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.textContent = "Aktualisieren";

    document.getElementById("name").value = event.name || "";
    document.getElementById("stat").value = event.stat || "10";
    document.getElementById("costumer").value = event.costumer || "";
    document.getElementById("start").value = toDateInputValue(event.start);
    document.getElementById("ende").value = toDateInputValue(event.ende);

    const startInput = document.getElementById("start");
    const endInput = document.getElementById("ende");
    if (startInput && endInput && startInput.value) {
        endInput.min = startInput.value;
    }
}


// =====================================================
// ❌ EVENT LÖSCHEN
// =====================================================
async function deleteEvent(id) {
    if (!confirm("Event wirklich löschen?")) return;

    try {
        const res = await fetch(`/api/events/${id}`, { method: "DELETE" });

        if (!res.ok) {
            const err = await res.json();
            alert(err.message);
            return;
        }

        const result = await res.json();
        alert(result.message);
        loadEvents();
    } catch (err) {
        console.error(err);
    }
}


// =====================================================
// 🔍 SUCHE
// =====================================================
function setupSearch() {
    if (!searchInput) return;

    searchInput.addEventListener("input", () => {
        const query = searchInput.value.toLowerCase();

        const filtered = allEvents.filter(e =>
            (e.name || "").toLowerCase().includes(query) ||
            (e.costumer || "").toLowerCase().includes(query)
        );

        renderEvents(sortEventsSmart(filtered));
    });
}


// =====================================================
// 🔽 SORTIERUNG
// =====================================================
function sortEvents(field) {
    sortDirection *= -1;

    allEvents.sort((a, b) => {
        const rankDiff = getEventSortRank(a) - getEventSortRank(b);
        if (rankDiff !== 0) return rankDiff;

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

    renderEvents(allEvents);
}

function sortEventsSmart(events) {
    return [...events].sort((a, b) => {
        const rankDiff = getEventSortRank(a) - getEventSortRank(b);
        if (rankDiff !== 0) return rankDiff;

        const dateA = getEventSortDate(a);
        const dateB = getEventSortDate(b);
        return dateA - dateB;
    });
}

function getEventSortRank(ev) {
    if (isEventClosed(ev)) return 3;

    const today = getTodayDate();
    const start = parseEventDate(ev.start);
    const end = parseEventDate(ev.ende);

    if (start && end && start <= today && end >= today) return 0;
    if (start && start > today) return 1;
    return 2;
}

function getEventSortDate(ev) {
    const rank = getEventSortRank(ev);
    const start = parseEventDate(ev.start);
    const end = parseEventDate(ev.ende);

    if (rank === 0) return start ? -start.getTime() : 0;
    if (rank === 1) return start ? start.getTime() : Number.MAX_SAFE_INTEGER;
    return end ? -end.getTime() : Number.MAX_SAFE_INTEGER;
}


// =====================================================
// 🎨 FORMATIERUNG
// =====================================================
function formatDateDE(date) {
    if (!date) return "";
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function toDateInputValue(date) {
    if (!date) return "";
    return String(date).split("T")[0];
}

function parseEventDate(date) {
    if (!date) return null;
    const [year, month, day] = String(date).split("T")[0].split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
}

function getTodayDate() {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function isEventClosed(ev) {
    return Number(ev.stat) === 90;
}

function formatStatus(stat) {
    const s = Number(stat);

    if (s === 10) return '<span class="status-frei">aktiv</span>';
    if (s === 90) return '<span class="status-verliehen">abgeschlossen</span>';

    return stat;
}
function getEventStatus(ev) {
    if (isEventClosed(ev)) return "done";

    const today = new Date();
    const start = new Date(ev.start);
    const end = new Date(ev.ende);

    if (end < today) return "done";       // 🟢
    if (start <= today) return "active";  // 🔵
    return "upcoming";                    // ⚪
}

// =====================================================
// 🎨 Login
// =====================================================

// Prüfen, ob User angemeldet ist
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



function isMobile() {
    return window.innerWidth <= 768;
}
window.addEventListener("resize", () => {
    renderEvents(allEvents);
});
