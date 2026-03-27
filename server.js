const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const fs = require("fs");

const { db, initDB } = require('./models/dbv');

const app = express();

(async () => {
    // Tabellen anlegen
    await initDB();

    // Admin anlegen
    require('./init_admin');

    // Backup prüfen / erstellen
    const BACKUP_DIR = path.join(__dirname, "test_data");
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

    const DB_FILE = path.join(__dirname, "verleih.db");
    const BACKUP_FILE = path.join(BACKUP_DIR, "verleihapp_backup.db");

    if (fs.existsSync(DB_FILE)) {
        fs.copyFileSync(DB_FILE, BACKUP_FILE);
        console.log("✅ Backup erstellt");
    } else {
        console.log("⚠️ DB existiert noch nicht, Backup übersprungen");
    }

    // Middleware
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(cors({ origin: "*", credentials: true }));

    app.use(session({
        secret: "ern",
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false }
    }));

    app.use(express.static(path.join(__dirname, 'public')));

    // Login Seite
    app.get('/login', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    });

    // API-Router
    const userRoutes = require('./routes/users');
    const productRoutes = require("./routes/products");
    const eventRoutes = require('./routes/events');
    const catRoutes = require('./routes/categories');
    const rentalRoutes = require('./routes/rentals');

    app.use("/api/users", userRoutes);
    app.use("/api/categories", catRoutes);
    app.use("/api/products", productRoutes);
    app.use("/api/events", eventRoutes);
    app.use("/api/rentals", rentalRoutes);

    // Server starten
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));

})();