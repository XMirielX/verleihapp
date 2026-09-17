// =====================================================
// 🌍 GLOBALE VARIABLEN
// =====================================================
let allEvents = [];
let sortDirection = 1;
let endWasManuallyChanged = false;
let editingEventId = null;
let customersEvents = [];

let form = null;
let searchInput = null;
let table = null;
let container = null;

// =====================================================
// 🚀 INIT
// =====================================================
async function initEventPage() {
  user = await checkLogin();

  form = document.getElementById("eventForm");
  searchInput = document.getElementById("searchInput");
  table = document.getElementById("eventTable");
  container = document.getElementById("eventTableContainer");

  await loadCustomers();
  await loadEvents();

  setupEditMode();
  setupForm();
  setupSearch();
}

async function loadCustomers() {
  try {
    const res = await fetch("/api/customers");

    if (!res.ok) {
      throw new Error("Kunden konnten nicht geladen werden.");
    }

    customersEvents = await res.json();

    const select = document.getElementById("customer_id");
    if (!select) return;

    select.innerHTML = `<option value="">Kein Kunde</option>`;

    customersEvents;
    customersEvents
      .filter((customer) => Number(customer.stat) === 1)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      .forEach((customersEvents) => {
        const option = document.createElement("option");
        option.value = customersEvents.id;
        option.textContent = customersEvents.name;
        select.appendChild(option);
      });
  } catch (err) {
    console.error("Fehler beim Laden der Kunden:", err);
  }
}
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

  const isAdmin = user && user.role === "admin";

  // =====================================================
  // MOBILE
  // =====================================================
  if (window.innerWidth <= 768) {
    table.style.display = "none";
    container.innerHTML = "";

    events.forEach((ev) => {
      const status = getEventStatus(ev);

      let color = "#999";
      if (status === "done") color = "green";
      else if (status === "active") color = "#007bff";

      const item = document.createElement("div");

      item.className = "card event-card";

      item.innerHTML = `
    <div class="event-card-header">
        <div class="event-title">
            <h3>${ev.name || ""}</h3>
            <span class="status-badge">${formatStatus(ev.stat)}</span>
        </div>
    </div>

    <div class="event-card-body">

        <div class="event-detail">
            <span class="event-detail-label">Kunde</span>
            <span class="event-detail-value">${ev.customer_name || "-"}</span>
        </div>

        <div class="event-detail">
            <span class="event-detail-label">Beginn</span>
            <span class="event-detail-value">${formatDateDE(ev.start)}</span>
        </div>

        <div class="event-detail">
            <span class="event-detail-label">Ende</span>
            <span class="event-detail-value">${formatDateDE(ev.ende)}</span>
        </div>

    </div>

    ${
      isAdmin
        ? `

                    ${
                      Number(ev.stat) !== 95
                        ? `
                            <button
                                class="small"
                                onclick="openEventEdit(${ev.id})"
                                aria-label="Bearbeiten"
                                title="Bearbeiten">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                          `
                        : ""
                    }


                    ${
                      Number(ev.stat) === 10
                        ? `
                                <button
                                    class="small"
                                    onclick="deleteEvent(${ev.id})"
                                    aria-label="Löschen"
                                    title="Löschen">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            `
                        : ""
                    }

                </div>
            `
        : ""
    }
`;

      // Ganze Karte als Bearbeiten klickbar
      if (isAdmin) {
        item.title = "Veranstaltung bearbeiten";

        item.addEventListener("click", (event) => {
          if (!event.target.closest("button")) {
            openEventEdit(ev.id);
          }
        });
      }

      container.appendChild(item);
    });

    return;
  }

  // =====================================================
  // DESKTOP
  // =====================================================

  table.style.display = "table";

  const tbody = table.querySelector("tbody");
  tbody.innerHTML = "";

  events.forEach((ev) => {
    const row = document.createElement("tr");

    row.innerHTML = `
            <td>${ev.name}</td>
            <td>${formatStatus(ev.stat)}</td>
            <td>${ev.customer_name || "-"}</td>
            <td>${formatDateDE(ev.start)}</td>
            <td>${formatDateDE(ev.ende)}</td>

${
  isAdmin
    ? `
        <td class="event-actions">


${
  Number(ev.stat) !== 95
    ? `
        <button
            class="small"
            onclick="openEventEdit(${ev.id})"
            aria-label="Bearbeiten"
            title="Bearbeiten">
            <i class="fa-solid fa-pen"></i>
        </button>
      `
    : ""
}

            ${
              Number(ev.stat) === 10
                ? `
                    <button
                        class="small"
                        onclick="deleteEvent(${ev.id})"
                        aria-label="Löschen"
                        title="Löschen">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                `
                : ""
            }

        </td>
    `
    : ""
}

        `;

    // Ganze Zeile als Bearbeiten klickbar
    if (isAdmin) {
      row.classList.add("clickable-row");
      row.title = "Veranstaltung bearbeiten";

      row.addEventListener("click", (event) => {
        if (!event.target.closest("button")) {
          openEventEdit(ev.id);
        }
      });
    }

    tbody.appendChild(row);
  });
}

async function openEventEdit(id) {
  if (!user || user.role !== "admin") {
    return;
  }

  sessionStorage.setItem("editEventId", String(id));

  await loadPage("eventadd");
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
function resetEventForm() {
  const form = document.getElementById("eventForm");
  if (form) {
    form.reset();
  }

  const statInput = document.getElementById("stat");
  if (statInput) {
    statInput.value = "10";
  }

  const endInput = document.getElementById("ende");
  if (endInput) {
    endInput.min = "";
  }

  editingEventId = null;
  endWasManuallyChanged = false;
}

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

    const customerValue = document.getElementById("customer_id").value;

    const data = {
      name: document.getElementById("name").value,
      stat: document.getElementById("stat").value,
      customer_id: customerValue ? Number(customerValue) : null,
      start: document.getElementById("start").value,
      ende: document.getElementById("ende").value,
    };

    try {
      const url = editingEventId
        ? `/api/events/${editingEventId}`
        : "/api/events";
      const method = editingEventId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      alert(result.message || "Event gespeichert (ID: " + result.id + ")");
      if (editingEventId) {
        editingEventId = null;
        await loadPage("events");
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

  const editId = sessionStorage.getItem("editEventId");

  if (!editId) return;

  sessionStorage.removeItem("editEventId");

  editingEventId = Number(editId);

  const event = allEvents.find((e) => Number(e.id) === editingEventId);

  if (!event) {
    alert("Veranstaltung wurde nicht gefunden.");
    return;
  }
  const eventIsClosed = isEventClosed(event);

  document.title = "Veranstaltung bearbeiten";

  const heading = document.querySelector("body > h1");

  if (heading) {
    heading.textContent = "Veranstaltung bearbeiten";
  }

  const submitButton = form.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>';
    submitButton.setAttribute("aria-label", "Speichern");
    submitButton.title = "Speichern";
  }

  document.getElementById("name").value = event.name || "";

  document.getElementById("stat").value = event.stat || "10";

  const customerSelect = document.getElementById("customer_id");

  if (customerSelect) {
    customerSelect.value = event.customer_id || "";
  }

  document.getElementById("start").value = toDateInputValue(event.start);

  document.getElementById("ende").value = toDateInputValue(event.ende);
if (eventIsClosed) {
  document.getElementById("name").disabled = true;
  document.getElementById("stat").disabled = true;
  document.getElementById("start").disabled = true;
  document.getElementById("ende").disabled = true;

  if (customerSelect) {
    customerSelect.disabled = Number(event.stat) === 95;
  }
}

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
  if (!user || user.role !== "admin") {
    alert("Nur Administratoren dürfen Veranstaltungen löschen.");
    return;
  }

  if (!confirm("Event wirklich löschen?")) return;

  try {
    const res = await fetch(`/api/events/${id}`, {
      method: "DELETE",
    });

    const result = await res.json();

    if (!res.ok) {
      alert(
        result.error || result.message || "Event konnte nicht gelöscht werden.",
      );
      return;
    }

    alert(result.message);

    await loadEvents();
  } catch (err) {
    console.error("Fehler beim Löschen des Events:", err);
    alert("Event konnte nicht gelöscht werden.");
  }
}
// =====================================================
// 🔍 SUCHE
// =====================================================
function setupSearch() {
  if (!searchInput) {
    console.warn("searchInput wurde nicht gefunden.");
    return;
  }

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();

    const filtered = allEvents.filter((event) => {
      const name = (event.name || "").toLowerCase();
      const customer = (event.customer_name || "").toLowerCase();

      return name.includes(query) || customer.includes(query);
    });

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
  if (s === 20) return '<span class="status-gestartet">gestartet</span>';
  if (s === 90) return '<span class="status-abgeschlossen">abgeschlossen</span>';
  if (s === 95) return '<span class="status-abgerechnet">abgerechnet</span>';

  return stat;
}
