// =====================================================
// 👤 USER & LOGIN
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

async function changePassword() {
    const pw1 = document.getElementById("newPassword").value.trim();
    const pw2 = document.getElementById("confirmPassword").value.trim();

    if (!pw1 || pw1 !== pw2) {
        return alert("Passwörter stimmen nicht überein!");
    }

    try {
        const res = await fetch("/api/users/change-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ password: pw1 })
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error);

        alert("Passwort geändert!");

        // 👉 Nach Änderung zurück zur App
        window.location.href = "index.html";

    } catch (err) {
        alert(err.message);
    }
}
// Login-Funktion
async function loginUser(username, password) {
    try {
        const res = await fetch("/api/users/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ username, password })
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error);

        // 👉 NEU: Prüfen auf first_login
        if (result.firstLogin) {
            window.location.href = "passwordchange.html";
        }
        else {        // Zur letzten besuchten Seite springen
        const last = localStorage.getItem("lastPage") || "index.html";
        localStorage.removeItem("lastPage");
        window.location.href = last;
        }
    } catch (err) {
        const el = document.getElementById("loginResult");
        if (el) el.innerText = err.message;
    }
}

// Logout-Funktion
async function logout() {
    try {
        await fetch("/api/users/logout", { credentials: "include" });
    } catch (err) {
        console.error("Fehler beim Logout:", err);
    } finally {
        window.location.href = "login.html";
    }
}

// =====================================================
// 🚀 INIT
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
    let user = null;

    // Auf allen Seiten außer login.html prüfen
    if (!window.location.pathname.includes("login.html")) {
        user = await checkLogin();
    }

    // Anwender-Button nur für Admin
    const adminBtn = document.getElementById("adminBtn");
    if (adminBtn) {
        adminBtn.style.display = (!user || user.role !== "admin") ? "none" : "inline-block";
    }

    // Login-Button (falls auf Login-Seite)
    const loginBtn = document.getElementById("loginButton");
    if (loginBtn) {
        loginBtn.addEventListener("click", async () => {
            const username = document.getElementById("username").value.trim();
            const password = document.getElementById("password").value.trim();
            if (!username || !password) return alert("Username & Passwort angeben");

            await loginUser(username, password);
        });
    }

    // Login-Button (falls auf Login-Seite)
    const chpassBtn = document.getElementById("changePasswordButton");
    if (chpassBtn) {
        chpassBtn.addEventListener("click", async () => {
            changePassword();
        });
    }
    // Logout-Button (falls vorhanden)
    const logoutBtn = document.getElementById("logoutButton");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", logout);
    }
});