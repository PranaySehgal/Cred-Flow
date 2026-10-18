from sqlalchemy import text
from sqlalchemy.engine import Connection
from uuid import uuid4


def createIssue(connection: Connection, user_id: str, desc: str):
    try:
        query = text(
            """INSERT INTO "Issues" VALUES(:issue_id,:user_id,:desc,'pending')"""
        )
        connection.execute(
            query, {"user_id": user_id, "desc": desc, "issue_id": uuid4()}
        )
        connection.commit()
        return {"message": "Issue added successfully"}
    except Exception as e:
        return {"message": f"Error in adding issue: {e}"}


def getIssues(connection: Connection, mid: str | None):
    try:
        if not mid:
            query = text("""SELECT * FROM "Issues" WHERE status = 'pending'""")
            res = connection.execute(query)
        else:
            query = text('SELECT * FROM "Issues" WHERE user_id = :mid')
            res = connection.execute(query, {"mid": mid})
        return {"issues": [dict(row) for row in res.mappings().all()]}
    except Exception as e:
        return {"message": f"Error in getting issues: {e}"}


def setIssue(connection: Connection, issueId: str):
    query = text('DELETE FROM "Issues" where "issue_id" = :issue_id')
    result = connection.execute(query, {"issue_id": issueId})
    connection.commit()
    if result.rowcount == 0:
        raise LookupError("Issue not found.")
    return {"message": "Issue resolved."}
