// -----------------------------
// Admin JS
// -----------------------------
// -----------------------------
// Admin JS
// -----------------------------
document.addEventListener("DOMContentLoaded", () => {
    loadUsers();
    setupUserCreation();
});

function setupUserCreation() {
    const createBtn = document.getElementById("createUserButton");
    if (!createBtn) return;

    createBtn.addEventListener("click", async () => {
        const usernameEl = document.getElementById("newUsername");
        const roleEl = document.getElementById("newRole");

        if (!usernameEl || !roleEl) {
            console.error("Formular-Elemente fehlen!");
            return;
        }

        const username = usernameEl.value.trim();
        const role = roleEl.value;

        if (!username) {
            alert("Bitte einen Benutzernamen angeben");
            return;
        }

        try {
            const res = await fetch("/api/users/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, role }) // kein Passwort
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error);

            alert(result.message);
            usernameEl.value = "";
            loadUsers(); // Liste aktualisieren

        } catch (err) {
            alert(err.message);
        }
    });
}

// -----------------------------
// Benutzerliste laden
// -----------------------------

async function loadUsers() {
    try {
        const res = await fetch("/api/users/list", { credentials: "include" });
        if (!res.ok) throw new Error("Fehler beim Laden der User");

        const users = await res.json();
        const isMobile = window.innerWidth <= 768;

        // Desktop
        if (!isMobile) {
            const tbody = document.querySelector("#userTable tbody");
            if (tbody) tbody.innerHTML = ""; // 🔥 DAS FEHLT
            users.forEach(user => {

                const tr = document.createElement("tr");
                tr.innerHTML = `
            <td>${user.username}</td>
            <td>${user.role}</td>
            <td>
                <button onclick="editUser(${user.id})">Bearbeiten</button>
                <button onclick="deleteUser(${user.id})">Löschen</button>
                <button onclick="resetPass(${user.id})">Passwort Reset</button>

            </td>
        `;
                tbody.appendChild(tr);
            });
        }

        // Mobile
        if (isMobile) {
            const cardContainer = document.getElementById("userCardContainer");
            if (cardContainer) cardContainer.innerHTML = ""; // 🔥 auch hier!
            users.forEach(user => {
                const card = document.createElement("div");
                card.classList.add("user-card");
                card.innerHTML = `
            <p><strong>Benutzername:</strong> ${user.username}</p>
            <p><strong>Rolle:</strong> ${user.role}</p>
            <button onclick="editUser(${user.id})">Bearbeiten</button>
            <button onclick="deleteUser(${user.id})">Löschen</button>
            <button onclick="resetPass(${user.id})">Passwort Reset</button>
        `;
                cardContainer.appendChild(card);
            });
        }

    } catch (err) {
        console.error(err);
        alert("Fehler beim Laden der Benutzerliste.");
    }
}
async function checkLogin() {
    const res = await fetch("/api/users/me");
    if (!res.ok) {
        localStorage.setItem("lastPage", window.location.pathname);
        window.location.href = "login.html";
    }
}
checkLogin();


async function deleteUser(id) {
    if (!confirm("Benutzer wirklich löschen?")) return;

    try {
        const res = await fetch(`/api/users/${id}`, {
            method: "DELETE",
            credentials: "include"
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error);

        alert("Benutzer gelöscht");
        loadUsers();

    } catch (err) {
        alert(err.message);
    }
}

async function editUser(id) {
    const newRole = prompt("Neue Rolle (admin/user):");

    if (!newRole) return;

    try {
        const res = await fetch(`/api/users/${id}/role`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ role: newRole })
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error);

        alert("Rolle geändert");
        loadUsers();

    } catch (err) {
        alert(err.message);
    }
}

async function resetPass(id) {
    if (!confirm("Passwort wirklich zurücksetzen?")) return;

    try {
        const res = await fetch(`/api/users/${id}/reset-password`, {
            method: "POST",
            credentials: "include"
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error);

        alert("Passwort wurde auf Standard zurückgesetzt");
        loadUsers();

    } catch (err) {
        alert(err.message);
    }
}