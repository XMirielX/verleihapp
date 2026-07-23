const express = require("express");
const router = express.Router();
const { db } = require("../models/dbv");


// Planung laden (alle Distributionen + bestehende Eventplanung)
router.get("/:eventId", async (req, res) => {
    try {
        const rows = await db.allAsync(`
            SELECT
                di.id,
                di.product_id,
                p.name AS product_name,
                c.name AS category_name,
                di.input,
                di.cable,
                di.schuko,
                di.cee16,
                di.cee32,
                di.cee63,
                di.cee125,
                COALESCE(dp.id,0) AS plan_id,
                COALESCE(dp.planned,0) AS planned,
                COALESCE(dp.location,'') AS location
            FROM distribution_items di
            JOIN products p ON p.id = di.product_id
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN distribution_plan dp 
                ON dp.distribution_item_id = di.id 
                AND dp.event_id = ?
            WHERE di.active = 1
            ORDER BY c.name, p.name
        `, [req.params.eventId]);

        res.json(rows);
    } catch (err) {
        console.error("GET DISTRIBUTION PLAN ERROR:", err);
        res.status(500).json({ error:"Fehler beim Laden der Planung" });
    }
});


// Planung speichern
router.post("/", async (req,res)=>{
    try {
        const { event_id, items } = req.body;

        const event = await db.getAsync(
            "SELECT stat FROM event WHERE id=?",
            [event_id]
        );

        if (!event) return res.status(404).json({error:"Event nicht gefunden"});
        if (event.stat == 90) return res.status(400).json({error:"Abgeschlossenes Event kann nicht geändert werden"});

        await db.runAsync(
            "DELETE FROM distribution_plan WHERE event_id=?",
            [event_id]
        );

        for (const item of items) {
            if (!item.planned) continue;

            await db.runAsync(`
                INSERT INTO distribution_plan
                (event_id,distribution_item_id,location,planned)
                VALUES (?,?,?,1)
            `,[
                event_id,
                item.distribution_item_id,
                item.location || ""
            ]);
        }

        res.json({success:true});

    } catch(err) {
        console.error("POST DISTRIBUTION PLAN ERROR:",err);
        res.status(500).json({error:"Fehler beim Speichern"});
    }
});


// Einzelnen Eintrag ändern
router.put("/:id", async(req,res)=>{
    try {
        const {location,planned}=req.body;

        await db.runAsync(`
            UPDATE distribution_plan
            SET location=?, planned=?
            WHERE id=?
        `,[location || "", planned ? 1:0, req.params.id]);

        res.json({success:true});

    } catch(err) {
        console.error(err);
        res.status(500).json({error:"Fehler beim Ändern"});
    }
});


// Einzelnen Eintrag löschen
router.delete("/:id", async(req,res)=>{
    try {
        await db.runAsync(
            "DELETE FROM distribution_plan WHERE id=?",
            [req.params.id]
        );

        res.json({success:true});

    } catch(err) {
        console.error(err);
        res.status(500).json({error:"Fehler beim Löschen"});
    }
});


// Distribution in Materialplanung übernehmen
router.post("/:eventId/generate", async(req,res)=>{
    try {
        const eventId=req.params.eventId;

        const event=await db.getAsync(
            "SELECT stat FROM event WHERE id=?",
            [eventId]
        );

        if (!event) return res.status(404).json({error:"Event nicht gefunden"});
        if (event.stat==90) return res.status(400).json({error:"Event abgeschlossen"});

        const items=await db.allAsync(`
            SELECT p.material_typ_id, COUNT(*) AS quantity
            FROM distribution_plan dp
            JOIN distribution_items di ON di.id=dp.distribution_item_id
            JOIN products p ON p.id=di.product_id
            WHERE dp.event_id=? AND dp.planned=1
            GROUP BY p.material_typ_id
        `,[eventId]);

        const materials={};

        items.forEach(i=>{
            if (!i.material_typ_id) return;
            materials[i.material_typ_id] = (materials[i.material_typ_id] || 0) + Number(i.quantity || 0);
        });

        for(const materialId in materials){
            const quantity = materials[materialId];

            if (!quantity) continue;

            const existing = await db.getAsync(`
                SELECT id, quantity
                FROM event_plan
                WHERE event_id=? AND material_id=?
            `, [eventId, materialId]);

            if (existing) {
                await db.runAsync(`
                    UPDATE event_plan
                    SET quantity = ?
                    WHERE id = ?
                `, [Number(existing.quantity || 0) + quantity, existing.id]);
            } else {
                await db.runAsync(`
                    INSERT INTO event_plan
                    (event_id, material_id, quantity)
                    VALUES (?, ?, ?)
                `, [eventId, materialId, quantity]);
            }
        }

        res.json({success:true});

    }catch(err){
        console.error("GENERATE MATERIAL PLAN ERROR:",err);
        res.status(500).json({error:"Fehler beim Übernehmen"});
    }
});


module.exports=router;