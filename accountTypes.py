from sqlalchemy import text
from sqlalchemy import inspect
from sqlalchemy.engine import Connection


ACCOUNT_TYPES = {"merchant", "lender", "agent", "superadmin"}


def normalizeAccountType(atype: str | None) -> str | None:
    normalized = atype.strip().lower() if atype else ""
    return normalized if normalized in ACCOUNT_TYPES else None


def ensureAccountTypesTable(connection: Connection):
    connection.execute(
        text(
            'CREATE TABLE IF NOT EXISTS "UserRoles" ('
            '"user_id" TEXT NOT NULL, '
            '"AType" TEXT NOT NULL, '
            '"status" TEXT NOT NULL DEFAULT \'approved\', '
            'PRIMARY KEY ("user_id", "AType")'
            ')'
        )
    )
    columns = {column["name"] for column in inspect(connection).get_columns("UserRoles")}
    if "status" not in columns:
        connection.execute(
            text(
                'ALTER TABLE "UserRoles" ADD COLUMN '
                '"status" TEXT NOT NULL DEFAULT \'approved\''
            )
        )


def getAccountTypes(
    connection: Connection, username: str, legacy_type: str | None = None
) -> set[str]:
    ensureAccountTypesTable(connection)
    account_types = {
        normalized
        for (atype,) in connection.execute(
            text('SELECT "AType" FROM "UserRoles" WHERE "user_id" = :username'),
            {"username": username},
        ).fetchall()
        if (normalized := normalizeAccountType(atype))
    }

    legacy_account_type = normalizeAccountType(legacy_type)
    if legacy_account_type and legacy_account_type not in account_types:
        connection.execute(
            text(
                'INSERT INTO "UserRoles" ("user_id", "AType") '
                'VALUES (:username, :atype)'
            ),
            {"username": username, "atype": legacy_account_type},
        )
        account_types.add(legacy_account_type)

    return account_types


def getApprovedAccountTypes(
    connection: Connection, username: str, legacy_type: str | None = None
) -> set[str]:
    getAccountTypes(connection, username, legacy_type)
    return {
        normalized
        for atype, status in connection.execute(
            text(
                'SELECT "AType", "status" FROM "UserRoles" '
                'WHERE "user_id" = :username'
            ),
            {"username": username},
        ).fetchall()
        if status == "approved"
        and (normalized := normalizeAccountType(atype))
    }
