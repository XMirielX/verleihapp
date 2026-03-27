// routes/users.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const db = require("../models/dbv"); // deine SQLite DB
const saltRounds = 10;

// Standard-Passwort für neue Benutzer
const STANDARD_PASSWORD = "thwsteinau";

// -----------------------------
// REGISTER (Admin erstellt neue User)
// -----------------------------
router.post("/register", async (req, res) => {
    const { username, role } = req.body;
    if (!username) return res.status(400).json({ error: "Username benötigt" });

    const existing = await db.getAsync("SELECT id FROM users WHERE username = ?", [username]);
    if (existing) return res.status(400).json({ error: "Benutzer existiert bereits" });

    const hash = await bcrypt.hash(STANDARD_PASSWORD, saltRounds);
    try {
        await db.runAsync(
            "INSERT INTO users (username, password_hash, role, first_login) VALUES (?, ?, ?, 1)",
            [username, hash, role || "user"]
        );
        res.json({ message: `Benutzer "${username}" erfolgreich erstellt mit Standardpasswort` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Datenbankfehler" });
    }
});

// -----------------------------
// LOGIN
// -----------------------------
router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await db.getAsync("SELECT * FROM users WHERE username = ?", [username]);
    if (!user) return res.status(401).json({ error: "Benutzer nicht gefunden" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Falsches Passwort" });

    // Setze Session
    req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role,
    };

    if (user.first_login == 1) {
        return res.json({ firstLogin: true, username: user.username, role: user.role });
    }

    res.json({ message: "Login erfolgreich", firstLogin: false,username: user.username, role: user.role });
});

// -----------------------------
// PASSWORD CHANGE (nach erstem Login)
// -----------------------------
// POST /api/users/change-password
router.post("/change-password", async (req, res) => {
    const { password } = req.body;
    if (!req.session.user) {
        return res.status(401).json({ error: "Nicht eingeloggt" });
    }
    if (!password || password.length < 3) {
        return res.status(400).json({ error: "Passwort zu kurz" });
    }
    try {
        // Passwort hashen
        const hashedPassword = await bcrypt.hash(password, 10);

        // Passwort + first_login zurücksetzen
        await db.runAsync(
            `UPDATE users 
             SET password_hash = ?, first_login = 0 
             WHERE id = ?`,
            [hashedPassword, req.session.user.id]
        );
        //console.log("Geänderte Zeilen:", result.changes);
        res.json({ message: "Passwort erfolgreich geändert" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Fehler beim Passwort ändern" });
    }
});
router.post("/:id/reset-password", requireLogin, requireAdmin, async (req, res) => {
    try {
        const hash = await bcrypt.hash("thwsteinau", 10);
        await db.runAsync(
            `UPDATE users 
             SET password_hash = ?, first_login = 1 
             WHERE id = ?`,
            [hash, req.params.id]
        );
        res.json({ message: "Passwort zurückgesetzt" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Fehler beim Reset" });
    }
});

// -----------------------------
// LOGOUT
// -----------------------------
router.post("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ error: "Logout fehlgeschlagen" });
        res.json({ message: "Logout erfolgreich" });
    });
});

// -----------------------------
// CURRENT USER
// -----------------------------
router.get("/me", (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Nicht eingeloggt" });
    res.json(req.session.user);
});

// -----------------------------
// MIDDLEWARE
// -----------------------------
function requireLogin(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: "Nicht eingeloggt" });
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== "admin") return res.status(403).json({ error: "Admin nur" });
    next();
}

// -----------------------------
// ADMIN-ROUTEN
// -----------------------------
router.get("/list", requireLogin, requireAdmin, async (req, res) => {
    const users = await db.allAsync("SELECT id, username, role, first_login FROM users");
    res.json(users);
});

router.put("/:id/role", requireLogin, requireAdmin, async (req, res) => {
    const { role } = req.body;
    await db.runAsync("UPDATE users SET role = ? WHERE id = ?", [role, req.params.id]);
    res.json({ message: "Rolle aktualisiert" });
});

router.delete("/:id", requireLogin, requireAdmin, async (req, res) => {
    await db.runAsync("DELETE FROM users WHERE id = ?", [req.params.id]);
    res.json({ message: "Benutzer gelöscht" });
});

// -----------------------------
// EXPORT
// -----------------------------
module.exports.requireLogin = requireLogin;
module.exports.requireAdmin = requireAdmin;
module.exports = router;