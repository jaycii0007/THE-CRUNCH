const router = require("express").Router();
const db = require("../config/db");

router.post("/", async (req, res) => {
    const { items, total } = req.body;

    const [order] = await db.query(
        "INSERT INTO orders(total) VALUES(?)",
        [total]
    );

    const orderId = order.insertId;

    for(const item of items){
        await db.query(
            "INSERT INTO order_items(order_id,product_id,quantity,subtotal) VALUES (?,?,?,?)",
            [orderId,item.product_id,item.qty,item.subtotal]
        );

        await db.query(
            "UPDATE products SET stock = stock - ? WHERE id=?",
            [item.qty,item.product_id]
        );
    }

    res.json({message:"Order placed"});
});

module.exports = router;
