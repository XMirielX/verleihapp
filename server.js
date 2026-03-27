// server.js
const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const fs = require("fs");
const app = express();

require('./backup_persistent'); // stellt sicher, dass DB wiederhergestellt wird und Backup erstellt wird
require('./init_admin');

// Direkt beim Start prüfen und Admin ggf. anlegen
// -----------------------------
// Middleware
// -----------------------------
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({
    origin: "http://localhost:3000", // oder "*" nur für Tests, aber ohne credentials
    credentials: true
}));
// Session-Handling
app.use(session({
    secret: "ern", // unbedingt sicher wählen, z.B. Umgebungsvariable
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // true nur bei HTTPS
}));
// Statische Dateien (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));
// Login Seiten direkt verlinken:
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
// -----------------------------
// API-Router
// -----------------------------
const userRoutes = require('./routes/users');
const productRoutes = require("./routes/products");
const eventRoutes = require('./routes/events');
const catRoutes = require('./routes/categories');
const rentalRoutes = require('./routes/rentals');

// Routen registrieren
app.use("/api/users", userRoutes);
app.use("/api/categories", catRoutes);
app.use("/api/products", productRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/rentals", rentalRoutes);

// -----------------------------
// Server starten
// -----------------------------
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Server läuft auf Port", PORT);
});


//const DB_FILE = path.join(__dirname, "verleih.db");
//const BACKUP_DIR = path.join(__dirname, "backups");
/* 
// Ordner erstellen, falls nicht vorhanden
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
    console.log("📁 Backup-Ordner erstellt");
}

function backupDatabase() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.db`);

    fs.copyFile(DB_FILE, backupFile, (err) => {
        if (err) {
            console.error("❌ Backup fehlgeschlagen:", err);
        } else {
            console.log("✅ Backup erstellt:", backupFile);
        }
    });
}
function cleanupBackups() {
    fs.readdir(BACKUP_DIR, (err, files) => {
        if (err) return;

        const now = Date.now();

        files.forEach(file => {
            const filePath = path.join(BACKUP_DIR, file);

            fs.stat(filePath, (err, stat) => {
                if (err) return;

                const age = now - stat.mtimeMs;

                // 7 Tage
                if (age > 7 * 24 * 60 * 60 * 1000) {
                    fs.unlink(filePath, () => {
                        console.log("🗑️ Altes Backup gelöscht:", file);
                    });
                }
            });
        });
    });
}
// Alle 6 Stunden Backup
setInterval(backupDatabase, 1000 * 60 * 60 * 12);

// Einmal täglich aufräumen
setInterval(cleanupBackups, 1000 * 60 * 60 * 24);

// Optional: direkt beim Start ein Backup machen
cleanupBackups();
backupDatabase(); */