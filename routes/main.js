const express = require("express");
const router = express.Router();
const { backupService } = require("../services/backup_service");
const { requireLogin, requireAdmin } = require("./users");

router.post("/backup", requireLogin, requireAdmin, async (req, res) => {
  try {
    res.json(await backupService.runBackup());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
