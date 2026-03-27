document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("CatForm");
    const result = document.getElementById("result");
    const categoryList = document.getElementById("categoryList");
    checkLogin();
    // Kategorien vom Backend laden
    async function loadCategories() {
        try {
            const res = await fetch("/api/categories"); // dein Endpoint
            const categories = await res.json();

            categoryList.innerHTML = ""; // vorherige Einträge löschen
            categories.forEach(cat => {
                const li = document.createElement("li");
                li.textContent = cat.name + " ";

                // Löschen-Button hinzufügen
                const delBtn = document.createElement("button");
                delBtn.textContent = "Löschen";
                delBtn.style.marginLeft = "10px";
                delBtn.addEventListener("click", async () => {
                    if (!confirm(`Kategorie "${cat.name}" wirklich löschen?`)) return;

                    try {
                        const delRes = await fetch(`/api/categories/${cat.id}`, {
                            method: "DELETE"
                        });

                        if (delRes.ok) {
                            result.textContent = `Kategorie "${cat.name}" gelöscht ✅`;
                            loadCategories(); // Liste aktualisieren
                        } else {
                            const data = await delRes.json();
                            result.textContent = `Fehler: ${data.error}`;
                        }
                    } catch (err) {
                        console.error(err);
                        result.textContent = "Fehler beim Löschen der Kategorie";
                    }
                });

                li.appendChild(delBtn);
                categoryList.appendChild(li);
            });
        } catch (err) {
            console.error(err);
            result.textContent = "Fehler beim Laden der Kategorien";
        }
    }

    // Beim Laden direkt aufrufen
    loadCategories();

    // Neue Kategorie anlegen
    form.addEventListener("submit", async e => {
        e.preventDefault();
        const name = document.getElementById("name").value.trim();
        if (!name) return;

        try {
            const res = await fetch("/api/categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name })
            });

            if (res.ok) {
                result.textContent = `Kategorie "${name}" gespeichert ✅`;
                document.getElementById("name").value = "";
                loadCategories(); // Liste aktualisieren
            } else {
                const data = await res.json();
                result.textContent = `Fehler: ${data.error}`;
            }
        } catch (err) {
            console.error(err);
            result.textContent = "Fehler beim Speichern der Kategorie";
        }
    });
});
// =====================================================
// 🎨 LOGIN CHECK
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