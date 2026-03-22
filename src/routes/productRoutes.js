const router = require("express").Router();
const db = require("../config/db");

// GET all products (old backend used `products` table)
router.get("/", async (req, res) => {
    try {
        const includeRaw = String(req.query.includeRaw || "").toLowerCase();
        const includeRawMaterials = includeRaw === "1" || includeRaw === "true";

        const whereClause = includeRawMaterials
            ? ""
            : "WHERE COALESCE(m.Promo, '') <> 'RAW_MATERIAL'";

        const [rows] = await db.query(
            `SELECT p.*, CAST(COALESCE(m.Stock, i.Stock, p.quantity, 0) AS SIGNED) AS remainingStock
             FROM products p
             LEFT JOIN Menu m ON m.Product_ID = p.id
             LEFT JOIN Inventory i ON i.Product_ID = p.id
             ${whereClause}`
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'DB error', error: err.message });
    }
});

// ADD product
router.post("/", async (req, res) => {
    try {
        const { name, price, quantity, description, category, raw_material } = req.body;
        const [result] = await db.query(
            "INSERT INTO products (name, price, quantity, description) VALUES (?,?,?,?)",
            [name, price || 0, quantity || 0, description || null]
        );

        const newId = result.insertId;
        const normalizedCategory = String(category || "").toLowerCase().trim();
        const promoTag = raw_material
            ? "RAW_MATERIAL"
            : normalizedCategory.includes("suppl")
                ? "SUPPLIES"
                : "FINISHED_GOODS";

        // also insert into Menu so that inventory batches can reference this product
        // we explicitly set Product_ID to keep both tables aligned. If the
        // Menu table has an auto-increment counter lower than newId this will
        // bump it automatically.
        await db.query(
            "INSERT INTO Menu (Product_ID, Product_Name, Category_Name, Price, Stock, Promo) VALUES (?,?,?,?,?,?)",
            [newId, name, category || null, price || 0, quantity || 0, promoTag]
        );

        res.status(201).json({ message: "Product added", id: newId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'DB error', error: err.message });
    }
});

// DELETE product
router.delete("/:id", async (req, res) => {
    try {
        const productId = Number(req.params.id);
        if (!Number.isFinite(productId) || productId <= 0) {
            return res.status(400).json({ message: "Invalid product ID" });
        }

        // Temporarily disable foreign key checks to allow cascading deletes
        await db.query("SET FOREIGN_KEY_CHECKS=0");

        try {
            // Delete batches associated with this product
            await db.query("DELETE FROM Batches WHERE product_id = ?", [productId]);

            // Delete inventory entries
            await db.query("DELETE FROM Inventory WHERE Product_ID = ?", [productId]);

            // Delete stock status entries
            await db.query("DELETE FROM Stock_Status WHERE Product_ID = ?", [productId]);

            // Delete menu entries
            await db.query("DELETE FROM Menu WHERE Product_ID = ?", [productId]);

            // Delete from products table
            await db.query("DELETE FROM products WHERE id = ?", [productId]);

            res.json({ message: "Product deleted successfully" });
        } finally {
            // Re-enable foreign key checks
            await db.query("SET FOREIGN_KEY_CHECKS=1");
        }
    } catch (err) {
        console.error("DELETE /products/:id error:", err);
        res.status(500).json({ message: 'DB error', error: err.message });
    }
});

module.exports = router;