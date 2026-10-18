from sqlalchemy import text
from sqlalchemy.engine import Connection
from datetime import datetime


def addTransaction(
    connection: Connection, transact_id: str, mid: str, amount: float, method: str
):
    try:
        query = text(
            'INSERT INTO "Transactions" VALUES(:mid,:tid,:amount,:date,:method)'
        )
        connection.execute(
            query,
            {
                "mid": mid,
                "tid": transact_id,
                "amount": amount,
                "method": method,
                "date": datetime.now(),
            },
        )
        connection.commit()
        return {"message": "Transaction added successfully"}
    except Exception as e:
        return {"message": f"Transaction failed to add due to error: {e}"}
