from sqlalchemy import text
from sqlalchemy.engine import Connection
from datetime import datetime


def updateContract(
    connection: Connection, mid: str, lid: str, amountPaid: int, dop: str
):
    try:
        query = text(
            'Update "Contracts" SET "paid_amount"="paid_amount"+:amountPaid, "dop"=:dop where "l_id"=:lid and "m_id"=:mid'
        )
        connection.execute(
            query,
            {
                "lid": lid,
                "mid": mid,
                "dop": dop,
                "amountPaid": amountPaid,
            },
        )
        connection.commit()
        return {"message": "Contract added successfully"}
    except Exception as e:
        return {"message": f"Error in adding contract due to error: {e}"}
