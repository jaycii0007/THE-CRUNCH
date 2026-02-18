const router = require("express").Router();
const db = require("../config/db");

// GET all menu items
router.get("/", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM Menu");
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'DB error', error: err.message });
    }
});

// ADD menu item
router.post("/", async (req, res) => {
    try {
        const { product_name, price, stock, promo, category_id } = req.body;
        const [result] = await db.query(
            "INSERT INTO Menu (Product_Name, Price, Stock, Promo, Category_ID) VALUES (?,?,?,?,?)",
            [product_name, price || 0, stock || 0, promo || null, category_id || null]
        );

        res.status(201).json({ message: "Menu item added", id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'DB error', error: err.message });
    }
});

module.exports = router;
