const router = require("express").Router();
const db = require("../config/db");

async function getSuppliersColumns() {
  const [rows] = await db.query("SHOW COLUMNS FROM Suppliers");
  return new Set(rows.map((r) => String(r.Field).toLowerCase()));
}

// GET /api/suppliers
router.get("/", async (req, res) => {
  try {
    const columns = await getSuppliersColumns();
    const hasEmail = columns.has("email");
    const hasProductsSupplied = columns.has("products_supplied");

    const [rows] = await db.query(
      `SELECT
         Supplier_ID AS supplier_id,
         SupplierName AS supplier_name,
         Contact_Number AS contact_number,
         Delivery_Schedule AS delivery_schedule,
         Product_ID AS product_id,
         ${hasEmail ? "Email" : "NULL"} AS email,
         ${hasProductsSupplied ? "Products_Supplied" : "NULL"} AS products_supplied
       FROM Suppliers
       ORDER BY Supplier_ID ASC`
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching suppliers:", err);
    res.status(500).json({ message: "DB error", error: err.message });
  }
});

// POST /api/suppliers
router.post("/", async (req, res) => {
  try {
    const {
      supplier_name,
      contact_number,
      delivery_schedule,
      product_id,
      email,
      products_supplied,
    } = req.body;

    if (!supplier_name) {
      return res.status(400).json({ message: "supplier_name is required" });
    }

    const columns = await getSuppliersColumns();
    const fieldNames = ["SupplierName", "Contact_Number", "Delivery_Schedule", "Product_ID"];
    const values = [
      supplier_name,
      contact_number ?? null,
      delivery_schedule ?? null,
      product_id ?? null,
    ];

    if (columns.has("email")) {
      fieldNames.push("Email");
      values.push(email ?? null);
    }

    if (columns.has("products_supplied")) {
      fieldNames.push("Products_Supplied");
      values.push(products_supplied ?? null);
    }

    const placeholders = fieldNames.map(() => "?").join(", ");
    const [result] = await db.query(
      `INSERT INTO Suppliers (${fieldNames.join(", ")}) VALUES (${placeholders})`,
      values
    );

    const [createdRows] = await db.query(
      `SELECT
         Supplier_ID AS supplier_id,
         SupplierName AS supplier_name,
         Contact_Number AS contact_number,
         Delivery_Schedule AS delivery_schedule,
         Product_ID AS product_id,
         ${columns.has("email") ? "Email" : "NULL"} AS email,
         ${columns.has("products_supplied") ? "Products_Supplied" : "NULL"} AS products_supplied
       FROM Suppliers
       WHERE Supplier_ID = ?`,
      [result.insertId]
    );

    res.status(201).json(createdRows[0]);
  } catch (err) {
    console.error("Error creating supplier:", err);
    res.status(500).json({ message: "DB error", error: err.message });
  }
});

// DELETE /api/suppliers/:supplier_id
router.delete("/:supplier_id", async (req, res) => {
  try {
    const supplierId = Number(req.params.supplier_id);
    if (!Number.isFinite(supplierId) || supplierId <= 0) {
      return res.status(400).json({ message: "Invalid supplier_id" });
    }

    const [result] = await db.query("DELETE FROM Suppliers WHERE Supplier_ID = ?", [supplierId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting supplier:", err);
    res.status(500).json({ message: "DB error", error: err.message });
  }
});

module.exports = router;
