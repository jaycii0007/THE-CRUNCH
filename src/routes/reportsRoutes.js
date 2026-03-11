const router = require("express").Router();
const db = require("../config/db");

async function reportTypeColumn() {
  const [rows] = await db.query("SHOW COLUMNS FROM Reports");
  const columns = new Set(rows.map((r) => String(r.Field).toLowerCase()));
  if (columns.has("report_type")) return "Report_Type";
  if (columns.has("repport_type")) return "Repport_Type";
  return "NULL";
}

// GET /api/reports
router.get("/", async (req, res) => {
  try {
    const typeColumn = await reportTypeColumn();
    const [rows] = await db.query(
      `SELECT
         Report_ID AS report_id,
         ${typeColumn} AS report_type,
         Total_Sales AS total_sales,
         Total_Transaction AS total_transaction,
         GeneratedAt AS generated_at
       FROM Reports
       ORDER BY GeneratedAt DESC, Report_ID DESC`
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching reports:", err);
    res.status(500).json({ message: "DB error", error: err.message });
  }
});

module.exports = router;
