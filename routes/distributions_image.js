const express = require("express");
const router = express.Router();

const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { db } = require("../models/dbv");


// ==========================
// Upload Konfiguration
// ==========================

const uploadDir = path.join(
    __dirname,
    "../public/uploads/distributions"
);

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + ext);
    }
});

const upload = multer({
    storage
});


// ==========================
// Bilder eines Verteilers laden
// ==========================

router.get("/:id/images", async (req, res) => {

    try {

        const images = await db.allAsync(
            `
            SELECT 
                id,
                filename,
                created_at
            FROM distribution_images
            WHERE distribution_item_id = ?
            ORDER BY id
            `,
            [req.params.id]
        );

        res.json(images);

    } catch (err) {

        console.error(err);
        res.status(500).json({
            error: "Fehler beim Laden der Bilder"
        });
    }
});


// ==========================
// Bild hochladen
// ==========================

router.post(
    "/:id/images",
    upload.single("image"),
    async (req, res) => {

        try {

            if (!req.file) {
                return res.status(400).json({
                    error: "Kein Bild übertragen"
                });
            }


            await db.runAsync(
                `
                INSERT INTO distribution_images
                (
                    distribution_item_id,
                    filename
                )
                VALUES (?, ?)
                `,
                [
                    req.params.id,
                    req.file.filename
                ]
            );


            res.json({
                success: true,
                filename: req.file.filename
            });


        } catch (err) {

            console.error(err);
            res.status(500).json({
                error: "Fehler beim Speichern des Bildes"
            });
        }
    }
);


// ==========================
// Bild löschen
// ==========================

router.delete(
    "/images/:imageId",
    async (req, res) => {

        try {

            const image = await db.getAsync(
                `
                SELECT filename
                FROM distribution_images
                WHERE id = ?
                `,
                [
                    req.params.imageId
                ]
            );


            if (!image) {
                return res.status(404).json({
                    error: "Bild nicht gefunden"
                });
            }


            const filePath = path.join(
                uploadDir,
                image.filename
            );


            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }


            await db.runAsync(
                `
                DELETE FROM distribution_images
                WHERE id = ?
                `,
                [
                    req.params.imageId
                ]
            );


            res.json({
                success: true
            });


        } catch (err) {

            console.error(err);

            res.status(500).json({
                error: "Fehler beim Löschen"
            });
        }
    }
);


module.exports = router;