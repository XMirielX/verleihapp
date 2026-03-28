const express = require("express");
const router = express.Router();
const { db } = require("../models/dbv");
const { backupDB } = require("../backup_persistent");

router.post("/backup", (req, res) => {
  try {
    const success = backupDB();

    if (!success) {
      return res.status(400).json({ error: "Datenbank nicht gefunden" });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;