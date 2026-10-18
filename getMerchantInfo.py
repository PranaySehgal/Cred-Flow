from sqlalchemy import text
from sqlalchemy.engine import Connection
from json import dumps


def getMerchantInfo(conn: Connection, user_id: str):
    transactions = list(
        conn.execute(
            text(
                'SELECT "amount","date","method" FROM "Transactions" where "m_id"=:mid and "method" is not null;',
            ),
            {"mid": user_id},
        )
        .mappings()
        .all()
    )

    loans = list(
        conn.execute(
            text('SELECT l_id,amount,paid_amount FROM "Contracts" where m_id=:mid'),
            {"mid": user_id},
        )
        .mappings()
        .all()
    )
    return {
        "transactions": [dict(row) for row in transactions],
        "loans": [dict(row) for row in loans],
    }
