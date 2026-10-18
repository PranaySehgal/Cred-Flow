import hashlib
import secrets
import time

from sqlalchemy import text
from sqlalchemy.engine import Connection

from accountTypes import getApprovedAccountTypes


SESSION_LIFETIME_SECONDS = 12 * 60 * 60


def ensureAuthSessionsTable(connection: Connection):
    connection.execute(
        text(
            'CREATE TABLE IF NOT EXISTS "AuthSessions" ('
            '"token_hash" TEXT PRIMARY KEY, '
            '"user_id" TEXT NOT NULL, '
            '"AType" TEXT NOT NULL, '
            '"expires_at" REAL NOT NULL'
            ')'
        )
    )


def createAuthSession(connection: Connection, username: str, atype: str) -> str:
    ensureAuthSessionsTable(connection)
    token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    connection.execute(
        text(
            'INSERT INTO "AuthSessions" ("token_hash", "user_id", "AType", "expires_at") '
            'VALUES (:token_hash, :user_id, :atype, :expires_at)'
        ),
        {
            "token_hash": token_hash,
            "user_id": username,
            "atype": atype,
            "expires_at": time.time() + SESSION_LIFETIME_SECONDS,
        },
    )
    connection.commit()
    return token


def getAuthSession(connection: Connection, token: str):
    ensureAuthSessionsTable(connection)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    result = connection.execute(
        text(
            'SELECT "user_id", "AType", "expires_at" FROM "AuthSessions" '
            'WHERE "token_hash" = :token_hash'
        ),
        {"token_hash": token_hash},
    ).mappings().first()
    if not result:
        connection.commit()
        return None

    if result["expires_at"] <= time.time():
        connection.execute(
            text('DELETE FROM "AuthSessions" WHERE "token_hash" = :token_hash'),
            {"token_hash": token_hash},
        )
        connection.commit()
        return None

    user_id = result["user_id"]
    account_types = getApprovedAccountTypes(connection, user_id)
    connection.commit()
    atype = result["AType"]
    if atype not in account_types:
        return None
    return {"user_id": user_id, "atype": atype}


def revokeAuthSession(connection: Connection, token: str):
    ensureAuthSessionsTable(connection)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    connection.execute(
        text('DELETE FROM "AuthSessions" WHERE "token_hash" = :token_hash'),
        {"token_hash": token_hash},
    )
    connection.commit()
