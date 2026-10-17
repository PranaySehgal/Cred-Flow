from sqlalchemy import text


def adjustInventory(connection, products: list, prices: list, qtys: list, user_id: int):
    for i, j, k in zip(products, prices, qtys):
        query = text("SELECT pid FROM INVENTORY WHERE pid = :pid AND uid = :uid")
        res = connection.execute(query, {"pid": i, "uid": user_id}).fetchone()
        if res:
            query = text(
                "UPDATE INVENTORY SET ppp = :price, qty = :quantity WHERE pid=:pid AND uid = :uid"
            )
        else:
            query = text(
                "INSERT INTO INVENTORY(pid,uid,ppp,qty) VALUES(:pid,:uid,:price,:quantity)"
            )
        connection.execute(query, {"pid": i, "uid": user_id, "price": j, "quantity": k})
        connection.commit()
