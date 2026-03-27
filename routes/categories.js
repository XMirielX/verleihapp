const express = require("express");
const router = express.Router();
const { db } = require("../models/dbv");

// GET /api/categories
router.get("/", async (req, res) => {
    try {
        const rows = await db.allAsync("SELECT id, name FROM categories ORDER BY name");
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/categories
router.post("/", async (req, res) => {
    const { name } = req.body;
    try {
        await db.runAsync(
            "INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
            [name]
        );
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/categories/:id
router.delete("/:id", async (req, res) => {
    const id = req.params.id;
    try {
        await db.runAsync("DELETE FROM categories WHERE id = $1", [id]);
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;