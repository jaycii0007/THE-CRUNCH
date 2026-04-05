const router = require("express").Router();
const db = require("../config/db");

async function getSuppliersColumns() {
  const [rows] = await db.query("SHOW COLUMNS FROM Suppliers");
  return new Set(rows.map((r) => String(r.Field).toLowerCase()));
}

// Helper to log supplier activity
async function logSupplierHistory({
  supplier_id,
  supplier_name,
  action,
  details,
  performed_by = null,
}) {
  try {
    await db.query(
      `INSERT INTO supplier_history (supplier_id, supplier_name, action, details, performed_by)
       VALUES (?, ?, ?, ?, ?)`,
      [supplier_id ?? 0, supplier_name, action, details ?? null, performed_by],
    );
  } catch (err) {
    console.error("Failed to log supplier history:", err.message);
    // Non-fatal — don't throw, just log
  }
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
       ORDER BY Supplier_ID ASC`,
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching suppliers:", err);
    res.status(500).json({ message: "DB error", error: err.message });
  }
});

// GET /api/suppliers/history  <-- must be BEFORE /:supplier_id
router.get("/history", async (req, res) => {
  try {
    const [history] = await db.query(
      `SELECT * FROM supplier_history ORDER BY created_at DESC LIMIT 200`,
    );
    res.json(history);
  } catch (err) {
    console.error("GET /suppliers/history error:", err);
    res.status(500).json({ error: err.message });
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
    const fieldNames = [
      "SupplierName",
      "Contact_Number",
      "Delivery_Schedule",
      "Product_ID",
    ];
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
      values,
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
      [result.insertId],
    );

    // ── Log the addition ──────────────────────────────────────────
    await logSupplierHistory({
      supplier_id: result.insertId,
      supplier_name,
      action: "Supplier Added",
      details:
        [
          contact_number ? `Contact: ${contact_number}` : null,
          email ? `Email: ${email}` : null,
          products_supplied ? `Products: ${products_supplied}` : null,
          delivery_schedule ? `Schedule: ${delivery_schedule}` : null,
        ]
          .filter(Boolean)
          .join(" | ") || null,
    });

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

    // ── Fetch name BEFORE deleting ────────────────────────────────
    const [[supplier]] = await db.query(
      `SELECT SupplierName AS supplier_name, Contact_Number AS contact_number
       FROM Suppliers WHERE Supplier_ID = ?`,
      [supplierId],
    );

    const [result] = await db.query(
      "DELETE FROM Suppliers WHERE Supplier_ID = ?",
      [supplierId],
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    // ── Log the removal ───────────────────────────────────────────
    if (supplier) {
      await logSupplierHistory({
        supplier_id: supplierId,
        supplier_name: supplier.supplier_name,
        action: "Supplier Removed",
        details: supplier.contact_number
          ? `Contact: ${supplier.contact_number}`
          : null,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting supplier:", err);
    res.status(500).json({ message: "DB error", error: err.message });
  }
});

module.exports = router;
