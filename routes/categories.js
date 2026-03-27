const express = require("express");
const router = express.Router();
const db = require("../models/dbv");


router.get("/", async (req, res) => {
    try {
        const categories = await db.allAsync("SELECT id, name FROM categories ORDER BY name ASC");
        res.json(categories);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Kategorien konnten nicht geladen werden" });
    }
});



module.exports = router;
