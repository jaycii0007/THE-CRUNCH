const router = require("express").Router();
const db = require("../config/db");

function normalizeOrderType(value) {
    if (!value) return "dine-in";
    const v = String(value).toLowerCase();
    return v === "take-out" ? "take-out" : "dine-in";
}

function isPreparingStatus(value) {
    const v = String(value || "").toLowerCase();
    return v === "preparing" || v === "in progress";
}

function isFinishedStatus(value) {
    const v = String(value || "").toLowerCase();
    return v === "completed" || v === "cancelled";
}

// list all orders (with optional items) for dashboard
router.get("/", async (req, res) => {
    try {
        const [orders] = await db.query(
            `SELECT o.Order_ID as id, o.Total_Amount as total, o.Status as status, o.Order_Date as date,
                    o.Order_Type as orderType, p.Payment_Type as paymentMethod,
                    oi.Product_ID as productId, oi.Quantity as quantity, oi.Subtotal as subtotal,
                    m.Product_Name as productName, m.Price as price
             FROM orders o
             LEFT JOIN order_item oi ON o.Order_ID = oi.Order_ID
             LEFT JOIN menu m ON m.Product_ID = oi.Product_ID
             LEFT JOIN (
                SELECT p1.Order_ID, p1.Payment_Type
                FROM payments p1
                INNER JOIN (
                    SELECT Order_ID, MAX(Payment_ID) as maxPaymentId
                    FROM payments
                    GROUP BY Order_ID
                ) latest ON latest.maxPaymentId = p1.Payment_ID
             ) p ON p.Order_ID = o.Order_ID`);
        // the above returns flat rows; frontend can reshape as needed
        res.json(orders);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'DB error', error: err.message });
    }
});

// queue view for kitchen/order page
router.get("/queue", async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT o.Order_ID as id, o.Status as status, o.Order_Type as orderType,
                    o.Order_Date as createdAt,
                    oi.Quantity as quantity, m.Product_Name as productName
             FROM orders o
             LEFT JOIN order_item oi ON oi.Order_ID = o.Order_ID
             LEFT JOIN menu m ON m.Product_ID = oi.Product_ID
             WHERE LOWER(COALESCE(o.Status, '')) NOT IN ('completed', 'cancelled')
             ORDER BY o.Order_ID DESC`
        );

        const grouped = {};
        for (const r of rows) {
            if (!grouped[r.id]) {
                grouped[r.id] = {
                    id: String(r.id),
                    orderNumber: `#${r.id}`,
                    tableNumber: 0,
                    status: normalizeOrderType(r.orderType),
                    items: [],
                    isPreparing: isPreparingStatus(r.status),
                    isFinished: isFinishedStatus(r.status),
                    startedAt: r.createdAt ? new Date(r.createdAt).getTime() : undefined,
                };
            }

            if (r.productName) {
                grouped[r.id].items.push({
                    quantity: Number(r.quantity) || 0,
                    name: r.productName,
                });
            }
        }

        res.json(Object.values(grouped));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'DB error', error: err.message });
    }
});

// place a new order (old schema)
router.post("/", async (req, res) => {
    let conn;
    try {
        const {
            items,
            total,
            customerId,
            cashierId,
            orderType,
            order_type,
            paymentMethod,
            payment_method,
        } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "Order items are required" });
        }

        const finalOrderType = normalizeOrderType(order_type || orderType);
        const finalPaymentMethod = String(payment_method || paymentMethod || "cash");

        conn = await db.getConnection();
        await conn.beginTransaction();

        // create order record in existing `orders` table
        const [orderResult] = await conn.query(
            "INSERT INTO orders (Total_Amount, Customer_ID, Cashier_ID, Order_Type, Status) VALUES (?,?,?,?,?)",
            [total, customerId || null, cashierId || null, finalOrderType, 'Pending']
        );

        const orderId = orderResult.insertId;

        // insert each item and decrement stock from Menu table used by current schema
        for (const item of items) {
            const [menuRows] = await conn.query(
                'SELECT Product_ID FROM Menu WHERE Product_ID = ?',
                [item.product_id]
            );

            if (menuRows.length === 0) {
                const [productRows] = await conn.query(
                    'SELECT name, price, quantity FROM products WHERE id = ?',
                    [item.product_id]
                );

                if (productRows.length > 0) {
                    const p = productRows[0];
                    await conn.query(
                        'INSERT INTO Menu (Product_ID, Product_Name, Price, Stock) VALUES (?,?,?,?)',
                        [item.product_id, p.name, Number(p.price) || 0, Number(p.quantity) || 0]
                    );
                } else if (item.name) {
                    await conn.query(
                        'INSERT INTO Menu (Product_ID, Product_Name, Price, Stock) VALUES (?,?,?,?)',
                        [item.product_id, item.name, Number(item.price) || 0, 0]
                    );
                } else {
                    throw new Error(`Unknown product_id ${item.product_id}`);
                }
            }

            await conn.query(
                "INSERT INTO order_item (Order_ID, Product_ID, Quantity, Subtotal) VALUES (?,?,?,?)",
                [orderId, item.product_id, item.qty, item.subtotal]
            );

            await conn.query(
                "UPDATE Menu SET Stock = GREATEST(Stock - ?, 0) WHERE Product_ID = ?",
                [item.qty, item.product_id]
            );

            // Keep legacy products stock in sync when table exists/row is present.
            await conn.query(
                "UPDATE products SET quantity = GREATEST(quantity - ?, 0) WHERE id = ?",
                [item.qty, item.product_id]
            );
        }

        await conn.query(
            "INSERT INTO Payments (Order_ID, Payment_Type, Payment_Status, ProcessBy) VALUES (?,?,?,?)",
            [orderId, finalPaymentMethod, 'Pending', cashierId || null]
        );

        await conn.commit();

        res.json({ message: "Order placed", orderId });
    } catch (err) {
        if (conn) await conn.rollback();
        console.error(err);
        res.status(500).json({ message: 'DB error', error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// update order status for live kitchen/dashboard updates
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ message: 'Status is required' });
        }

        await db.query('UPDATE Orders SET Status = ? WHERE Order_ID = ?', [status, id]);

        if (String(status).toLowerCase() === 'completed') {
            await db.query(
                'UPDATE Payments SET Payment_Status = ? WHERE Order_ID = ?',
                ['Completed', id]
            );
        }

        res.json({ message: 'Order updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'DB error', error: err.message });
    }
});

module.exports = router;