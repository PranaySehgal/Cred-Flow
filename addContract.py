from sqlalchemy import text
from sqlalchemy.engine import Connection
from datetime import datetime


def addContract(connection: Connection, mid: str, lid: str, amount: int, tenure: int):
    try:
        query = text('INSERT INTO "Contracts" VALUES(:lid,:mid,:amount,:tenure,:doc)')
        connection.execute(
            query,
            {
                "lid": lid,
                "mid": mid,
                "amount": amount,
                "tenure": tenure,
                "doc": datetime.now(),
            },
        )
        connection.commit()
        return {"message": "Contract added successfully"}
    except Exception as e:
        return {"message": f"Error in adding contract due to error: {e}"}
