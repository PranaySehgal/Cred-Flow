from sqlalchemy import text
from sqlalchemy.engine import Connection
from json import dumps


def getLenderInfo(conn: Connection, user_id: str):
    lends = list(
        conn.execute(
            text(
                'SELECT "m_id","amount","paid_amount" FROM "Contracts" where "l_id"=:lid'
            ),
            {"lid": user_id},
        )
        .mappings()
        .all()
    )
    return {
        "lends": [dict(row) for row in lends],
    }
