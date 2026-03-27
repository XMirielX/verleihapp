// =====================================================
// 🌍 GLOBALE VARIABLEN
// =====================================================
let allEvents = [];
let sortDirection = 1;

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
    loadEvents();
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

        allEvents = events;
        renderEvents(events);

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
        tbody.appendChild(row);
    });
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
            const res = await fetch("/api/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error);

            alert("Event gespeichert (ID: " + result.id + ")");
            form.reset();
            loadEvents();

        } catch (err) {
            alert(err.message);
        }
    });
}


// =====================================================
// ❌ EVENT LÖSCHEN
// =====================================================
async function deleteEvent(id) {
    if (!confirm("Event wirklich löschen?")) return;

    try {
        await fetch(`/api/events/${id}`, { method: "DELETE" });
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

        renderEvents(filtered);
    });
}


// =====================================================
// 🔽 SORTIERUNG
// =====================================================
function sortEvents(field) {
    sortDirection *= -1;

    allEvents.sort((a, b) => {
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


// =====================================================
// 🎨 FORMATIERUNG
// =====================================================
function formatDateDE(date) {
    if (!date) return "";
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function formatStatus(stat) {
    const s = Number(stat);

    if (s === 10) return '<span class="status-frei">aktiv</span>';
    if (s === 90) return '<span class="status-verliehen">abgeschlossen</span>';

    return stat;
}
function getEventStatus(ev) {
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