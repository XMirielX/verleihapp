const express = require("express");
const router = express.Router();
const { db } = require("../models/dbv");

// GET /api/categories
router.get("/", async (req, res) => {
    db.all("SELECT id, name FROM categories ORDER BY name", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST /api/categories
router.post("/", async (req, res) => {
    const { name } = req.body;
    db.run("INSERT OR IGNORE INTO categories (name) VALUES (?)", [name], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ ok: true });
    });
});

// DELETE /api/categories/:id
router.delete("/:id", async (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM categories WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ ok: true });
    });
});

module.exports = router;