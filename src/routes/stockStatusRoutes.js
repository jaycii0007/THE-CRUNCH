const router = require("express").Router();
const db = require("../config/db");

// GET /api/stock-status/today
router.get("/today", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         ss.Status_ID AS status_id,
         ss.Product_ID AS product_id,
         COALESCE(m.Product_Name, 'Unknown Product') AS product_name,
         LOWER(COALESCE(ss.Type, 'initial')) AS type,
         COALESCE(ss.Quantity, 0) AS quantity,
         ss.Status_Date AS status_date,
         ss.RecordedBy AS recorded_by
       FROM Stock_Status ss
       LEFT JOIN Menu m ON m.Product_ID = ss.Product_ID
       WHERE DATE(ss.Status_Date) = CURDATE()
       ORDER BY ss.Status_Date DESC, ss.Status_ID DESC`
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching today's stock status:", err);
    res.status(500).json({ message: "DB error", error: err.message });
  }
});

// POST /api/stock-status
router.post("/", async (req, res) => {
  try {
    const { product_id, type, quantity, recorded_by } = req.body;
    const qty = Number(quantity) || 0;

    if (!Number.isFinite(Number(product_id)) || qty <= 0 || !type) {
      return res.status(400).json({ message: "product_id, type, and quantity are required" });
    }

    const [result] = await db.query(
      `INSERT INTO Stock_Status (Product_ID, Type, Quantity, Status_Date, RecordedBy)
       VALUES (?, ?, ?, NOW(), ?)`,
      [product_id, String(type).toLowerCase(), qty, recorded_by ?? null]
    );

    const [createdRows] = await db.query(
      `SELECT
         ss.Status_ID AS status_id,
         ss.Product_ID AS product_id,
         COALESCE(m.Product_Name, 'Unknown Product') AS product_name,
         LOWER(COALESCE(ss.Type, 'initial')) AS type,
         COALESCE(ss.Quantity, 0) AS quantity,
         ss.Status_Date AS status_date,
         ss.RecordedBy AS recorded_by
       FROM Stock_Status ss
       LEFT JOIN Menu m ON m.Product_ID = ss.Product_ID
       WHERE ss.Status_ID = ?`,
      [result.insertId]
    );

    res.status(201).json(createdRows[0]);
  } catch (err) {
    console.error("Error creating stock status:", err);
    res.status(500).json({ message: "DB error", error: err.message });
  }
});

// POST /api/stock-status/spoilage
router.post("/spoilage", async (req, res) => {
  let conn;
  try {
    const { product_id, quantity, recorded_by } = req.body;
    const qty = Number(quantity) || 0;

    if (!Number.isFinite(Number(product_id)) || qty <= 0) {
      return res.status(400).json({ message: "product_id and quantity are required" });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO Stock_Status (Product_ID, Type, Quantity, Status_Date, RecordedBy)
       VALUES (?, 'spoilage', ?, NOW(), ?)`,
      [product_id, qty, recorded_by ?? null]
    );

    await conn.query(
      `INSERT INTO Inventory (Product_ID, Quantity, Stock, Item_Purchased)
       SELECT m.Product_ID, m.Stock, m.Stock, m.Product_Name
       FROM Menu m
       WHERE m.Product_ID = ?
         AND NOT EXISTS (SELECT 1 FROM Inventory i WHERE i.Product_ID = m.Product_ID)`,
      [product_id]
    );

    await conn.query(
      `UPDATE Inventory
       SET Stock = GREATEST(COALESCE(Stock, 0) - ?, 0),
           Last_Update = NOW()
       WHERE Product_ID = ?`,
      [qty, product_id]
    );

    await conn.query(
      `UPDATE Menu
       SET Stock = GREATEST(COALESCE(Stock, 0) - ?, 0)
       WHERE Product_ID = ?`,
      [qty, product_id]
    );

    await conn.query(
      `UPDATE products
       SET quantity = GREATEST(COALESCE(quantity, 0) - ?, 0)
       WHERE id = ?`,
      [qty, product_id]
    );

    await conn.commit();

    res.status(201).json({ success: true });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error recording spoilage:", err);
    res.status(500).json({ message: "DB error", error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
