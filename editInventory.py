from sqlalchemy import text


def adjustInventory(connection, products: list, prices: list, qtys: list, user_id: str):
    if not (len(products) == len(prices) == len(qtys)):
        raise ValueError("Each inventory product must have a price and quantity.")

    try:
        for product, price, quantity in zip(products, prices, qtys):
            product_id = str(product)
            query = text(
                'SELECT "p_id" FROM "Inventory" '
                'WHERE "p_id" = :p_id AND "m_id" = :m_id'
            )
            values = {
                "p_id": product_id,
                "m_id": user_id,
                "price": str(price),
                "quantity": str(quantity),
            }
            res = connection.execute(
                query, {"p_id": product_id, "m_id": user_id}
            ).fetchone()
            if res:
                query = text(
                    'UPDATE "Inventory" SET "ppp" = :price, "qty_left" = :quantity '
                    'WHERE "p_id" = :p_id AND "m_id" = :m_id'
                )
            else:
                query = text(
                    'INSERT INTO "Inventory"("p_id", "m_id", "ppp", "qty_left") '
                    "VALUES(:p_id, :m_id, :price, :quantity)"
                )
            connection.execute(query, values)
        connection.commit()
    except Exception:
        connection.rollback()
        raise


def getInventory(connection, user_id: str):
    rows = (
        connection.execute(
            text(
                'SELECT "p_id", "ppp", "qty_left" FROM "Inventory" '
                'WHERE "m_id" = :m_id ORDER BY "p_id"'
            ),
            {"m_id": user_id},
        )
        .mappings()
        .all()
    )
    return [
        {
            "product": row["p_id"],
            "price": row["ppp"],
            "quantity": row["qty_left"],
        }
        for row in rows
    ]
