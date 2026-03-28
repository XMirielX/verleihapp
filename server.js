const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const fs = require("fs");
const env = require("dotenv").config();
const { db, initDB } = require('./models/dbv');
const app = express();

(async () => {

    // Backupd / ansonsten Admin anlegen
    require('./backup_persistent');

    await initDB();

    require('./init_admin');

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
    const mainRoutes = require('./routes/main');

    app.use("/api/main", mainRoutes);
    app.use("/api/users", userRoutes);
    app.use("/api/categories", catRoutes);
    app.use("/api/products", productRoutes);
    app.use("/api/events", eventRoutes);
    app.use("/api/rentals", rentalRoutes);

    // Server starten
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));

    setInterval(() => {
        console.log("Auto-Backup läuft...");
        backupDB();
    }, 1000 * 60 * 60 * 24 * 7); // 7 Tage
    function cleanupBackups() {
        const files = fs.readdirSync(BACKUP_DIR).sort();

        while (files.length > 10) {
            const file = files.shift();
            fs.unlinkSync(path.join(BACKUP_DIR, file));
        }
    }

})();