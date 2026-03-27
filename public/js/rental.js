
// -----------------------------
// rental.js – Optimiert für Browser
// -----------------------------
document.addEventListener("DOMContentLoaded", () => {
    console.log("Seite geladen");

    loadEvents("eventSelect").then(events => {
        if (events.length > 0 && document.getElementById("rentalTable")) {
            loadRentals(events[0].id);
        }
    });

    setupRentalButtons();
    setupBarcodeScanner();
    setupCameraButton();
    setupCloseEventButton();
});

// -----------------------------
// EVENTS LADEN
// -----------------------------
async function loadEvents(selectId = null) {
    const isRentalPage = window.location.pathname.endsWith("rentals.html");
    const url = isRentalPage
        ? "/api/events"
        : "/api/events/active";

    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error("Fehler beim Laden der Events");

    let events = await res.json();
    events = sortEventsSmart(events);

    if (selectId) {
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = "";
            events.forEach((ev, idx) => {
                const opt = document.createElement("option");
                opt.value = ev.id;
                opt.text = `${ev.name} (${ev.start} - ${ev.ende})`;
                if (idx === 0) opt.selected = true;
                select.appendChild(opt);
            });

            select.addEventListener("change", () => {
                const event_id = parseInt(select.value, 10);
                if (document.getElementById("rentalTable")) {
                    loadRentals(event_id);
                }
            });
        }
    }
    updateCloseButtonVisibility();
    return events;
}

// =====================================================
// RENTALS LADEN & RENDERN
// =====================================================
async function loadRentals(event_id) {
    if (!event_id) return;
    try {
        const res = await fetch(`/api/rentals/${event_id}`);
        if (!res.ok) throw new Error("Fehler beim Laden der Verleihdaten");
        const rentals = await res.json();

        const table = document.getElementById("rentalTable");
        const container = document.getElementById("rentalTableContainer");

        if (window.innerWidth <= 768) {
            // Mobile View: Karte
            if (table) table.style.display = "none";
            if (container) container.innerHTML = "";

            rentals.forEach(r => {
                const item = document.createElement("div");
                item.className = "rental-item";
                let statusColor = "#999";
                switch (Number(r.stat)) {
                    case 10: statusColor = "green"; break;
                    case 90: statusColor = "red"; break;
                    case 20: statusColor = "#ffc107"; break;
                }
                item.style.borderLeft = `6px solid ${statusColor}`;
                item.innerHTML = `<div>${r.pname} (${r.spezification || "-"})</div><div>Barcode: ${r.Code}</div>`;
                if (container) {
                    container.appendChild(item);
                }
            });
        } else {
            // Desktop View: Tabelle
            if (table) table.style.display = "table";

            const tbody = table ? table.querySelector("tbody") : null;
            if (!tbody) {
                console.warn("Kein tbody gefunden – Tabelle kann nicht gefüllt werden");
                return;
            }
            tbody.innerHTML = "";  // nur tbody leeren, thead bleibt

            rentals.forEach(r => {
                const row = document.createElement("tr");

                let statusText = "", statusClass = "";
                switch (Number(r.stat)) {
                    case 10: statusText = "verliehen"; statusClass = "status-verliehen"; break;
                    case 20: statusText = "fehlt"; statusClass = "status-fehlt"; break;
                    case 90: statusText = "zurückgegeben"; statusClass = "status-zurueckgegeben"; break;
                    default: statusText = "unbekannt"; statusClass = "status-unbekannt"; break;
                }

                row.innerHTML = `
                    <td>${r.pname}</td>
                    <td>${r.spezification || "-"}</td>
                    <td>${r.cname || "-"}</td>
                    <td class="${statusClass}">${statusText}</td>
                `;
                tbody.appendChild(row);
            });
        }

    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}
// -----------------------------
// EVENTS SORTIEREN
// -----------------------------
function sortEventsSmart(events) {
    const today = new Date();
    return events.sort((a, b) => {
        const dateA = new Date(a.start);
        const dateB = new Date(b.start);
        const isPastA = dateA < today;
        const isPastB = dateB < today;
        if (isPastA !== isPastB) return isPastA ? 1 : -1;
        return Math.abs(dateA - today) - Math.abs(dateB - today);
    });
}

// =====================================================
// BUTTONS
// =====================================================
function setupRentalButtons() {
    const mapping = [
        { id: "rentButton", url: "/api/rentals" },
        { id: "backrentButton", url: "/api/rentals/return" },
        { id: "stornorentButton", url: "/api/rentals/storno" }
    ];

    mapping.forEach(btn => {
        const element = document.getElementById(btn.id);
        if (element) element.addEventListener("click", () => handleRentalAction(btn.url));
    });
}

// =====================================================
// BARCODE SCANNER
// =====================================================
function setupBarcodeScanner() {
    const barcodeInput = document.getElementById("barcodeInput");
    if (!barcodeInput) return;

    barcodeInput.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            const code = barcodeInput.value.trim();
            if (!code) return;
            handleScan(code);
            barcodeInput.value = "";
        }
    });


}

function setupCameraButton() {
    const btn = document.getElementById("scanBtn");
    if (!btn) return;

    btn.addEventListener("click", async () => {
        try {
            const scannedCode = await startCameraScan();
            if (scannedCode) handleScan(scannedCode);
        } catch (err) {
            console.error("Scan fehlgeschlagen:", err);
            alert("Scan konnte nicht durchgeführt werden");
        }
    });
}

function handleScan(code) {
    const mode = document.body.dataset.mode;
    if (navigator.vibrate) navigator.vibrate(100);

    const input = document.getElementById("barcodeInput");
    if (input) input.value = code;

    switch (mode) {
        case "rent": handleRentalAction("/api/rentals"); break;
        case "return": handleRentalAction("/api/rentals/return"); break;
        case "storno": handleRentalAction("/api/rentals/storno"); break;
        default: console.warn("Unbekannter Modus:", mode);
    }
}

async function handleRentalAction(url) {
    try {
        const eventSelect = document.getElementById("eventSelect");
        if (!eventSelect) throw new Error("Event-Select nicht gefunden");
        const event_id = parseInt(eventSelect.value, 10);
        if (!event_id) throw new Error("Kein Event ausgewählt");

        const barcodeInput = document.getElementById("barcodeInput");
        const code = barcodeInput ? barcodeInput.value.trim() : null;
        if (!code) {
            alert("Bitte Barcode eingeben oder scannen");
            return;
        }

        const payload = {
            event_id,
            codes: [code]   // <-- hier als Array
        };

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "include"
        });

        // Absichern: nur JSON parsen, wenn Content-Type JSON ist
        let result = null;

        result = await res.json();

        if (!res.ok) {
            throw new Error(typeof result === "string" ? result : result.error || "Fehler bei der Aktion");
        }
        if (result.results && result.results.length > 0) {
            const messages = result.results.map(r =>
                `${r.code}: ${r.status}${r.product ? " (" + r.product + ")" : ""}`
            );

            alert(messages.join("\n"));
        }
        await loadRentals(event_id);

        if (barcodeInput) barcodeInput.value = "";
        if (barcodeInput && window.innerWidth > 768) barcodeInput.focus();

    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}
// =====================================================
// PLACEHOLDER CAMERA SCAN
// =====================================================
// 1. ZXing installieren oder per CDN einbinden
// <script src="https://unpkg.com/@zxing/library@0.19.1/umd/index.min.js"></script>
async function startCameraScan() {
    return new Promise(async (resolve, reject) => {
        try {
            const codeReader = new ZXing.BrowserBarcodeReader();
            const video = document.createElement("video");
            video.setAttribute("playsinline", true); // iOS

            const container = document.getElementById("cameraContainer");
            container.style.display = "block";  // 🔹 Container sichtbar, wenn Kamera läuft
            container.appendChild(video);

            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            video.srcObject = stream;
            await video.play();

            const result = await codeReader.decodeOnceFromVideoDevice(undefined, video);
            resolve(result.text);

            // Kamera stoppen
            stream.getTracks().forEach(track => track.stop());
            video.remove();
            container.style.display = "none"; // 🔹 Container wieder ausblenden
        } catch (err) {
            reject(err);
        }
    });
}
function setupCloseEventButton() {
    const btn = document.getElementById("closeEventButton");
    if (!btn) return;

    btn.addEventListener("click", async () => {
        try {
            const eventSelect = document.getElementById("eventSelect");
            if (!eventSelect) throw new Error("Event-Select nicht gefunden");

            const event_id = parseInt(eventSelect.value, 10);
            if (!event_id) throw new Error("Kein Event ausgewählt");

            if (!confirm("Event wirklich abschließen? Offene Geräte werden als 'fehlt' markiert!")) return;

            const res = await fetch(`/api/events/${event_id}/close`, {
                method: "PUT"
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error);

            alert(result.message);

            // 🔄 UI aktualisieren
            loadEvents("eventSelect");
            loadRentals(event_id);

        } catch (err) {
            console.error(err);
            alert(err.message);
        }
    });
}
function updateCloseButtonVisibility() {
    const btn = document.getElementById("closeEventButton");
    const select = document.getElementById("eventSelect");

    if (!btn || !select) return;

    const event_id = parseInt(select.value, 10);
    const event = allEvents.find(e => e.id == event_id);

    if (!event) return;

    // stat 90 = abgeschlossen
    if (Number(event.stat) === 90) {
        btn.style.display = "none";
    } else {
        btn.style.display = "inline-block";
    }
}
// =====================================================
// DATUM FORMAT
// =====================================================
function formatDateDE(date) {
    if (!date) return "";
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

// =====================================================
// LOGIN CHECK
// =====================================================
async function checkLogin() {
    const res = await fetch("/api/users/me");
    if (!res.ok) {
        localStorage.setItem("lastPage", window.location.pathname);
        window.location.href = "login.html";
    }
}
checkLogin();