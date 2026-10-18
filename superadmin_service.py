from sqlalchemy import text
from sqlalchemy.engine import Connection

from accountTypes import (
    ensureAccountTypesTable,
    getApprovedAccountTypes,
)
from addContract import addContract


MANAGED_ACCOUNT_TYPES = {"agent", "lender", "merchant"}


def getManagedAccounts(connection: Connection):
    rows = connection.execute(
        text(
            'SELECT "user_id", "AType", "OName", "SName", "MobileNum", "lat", "long" '
            'FROM "Users" ORDER BY "user_id"'
        )
    ).mappings().all()
    accounts = []
    for row in rows:
        account = dict(row)
        roles = getApprovedAccountTypes(
            connection, account["user_id"], account["AType"]
        )
        managed_roles = sorted(roles & MANAGED_ACCOUNT_TYPES)
        if managed_roles:
            account["account_types"] = managed_roles
            accounts.append(account)
    connection.commit()
    return accounts


def getPendingAccountRequests(connection: Connection):
    ensureAccountTypesTable(connection)
    rows = connection.execute(
        text(
            'SELECT r."user_id", r."AType", u."OName", u."SName", u."MobileNum" '
            'FROM "UserRoles" AS r JOIN "Users" AS u ON u."user_id" = r."user_id" '
            'WHERE r."status" = :status AND r."AType" IN (:merchant, :lender) '
            'ORDER BY r."user_id", r."AType"'
        ),
        {"status": "pending", "merchant": "merchant", "lender": "lender"},
    ).mappings().all()
    connection.commit()
    return [dict(row) for row in rows]


def decideAccountRequest(
    connection: Connection, user_id: str, account_type: str, decision: str
):
    ensureAccountTypesTable(connection)
    if account_type not in {"merchant", "lender"}:
        raise ValueError("Only merchant and lender requests can be reviewed.")
    if decision not in {"approved", "rejected"}:
        raise ValueError("The decision must be approved or rejected.")

    result = connection.execute(
        text(
            'UPDATE "UserRoles" SET "status" = :decision '
            'WHERE "user_id" = :user_id AND "AType" = :atype AND "status" = :pending'
        ),
        {
            "decision": decision,
            "user_id": user_id,
            "atype": account_type,
            "pending": "pending",
        },
    )
    if result.rowcount != 1:
        connection.commit()
        raise LookupError("That pending account request was not found.")
    connection.commit()
    return {"STATUS": "SUCCESS", "message": f"Account request {decision}."}


def getPendingIssues(connection: Connection):
    rows = connection.execute(
        text('SELECT * FROM "Issues" WHERE status = :status ORDER BY "issue_id" DESC'),
        {"status": "pending"},
    ).mappings().all()
    connection.commit()
    return [dict(row) for row in rows]


def getIssueOwner(connection: Connection, issue_id: str):
    row = connection.execute(
        text('SELECT user_id FROM "Issues" WHERE "issue_id" = :issue_id'),
        {"issue_id": issue_id},
    ).first()
    connection.commit()
    return row[0] if row else None


def createManagedContract(
    connection: Connection, merchant_id: str, lender_id: str, amount: int, tenure: int
):
    account_roles = {}
    for user_id in {merchant_id, lender_id}:
        row = connection.execute(
            text('SELECT "AType" FROM "Users" WHERE "user_id" = :user_id'),
            {"user_id": user_id},
        ).first()
        if not row:
            connection.commit()
            raise LookupError(f"Account {user_id} does not exist.")
        account_roles[user_id] = getApprovedAccountTypes(connection, user_id, row[0])

    if "merchant" not in account_roles[merchant_id]:
        connection.commit()
        raise ValueError("The selected merchant account does not have merchant access.")
    if "lender" not in account_roles[lender_id]:
        connection.commit()
        raise ValueError("The selected lender account does not have lender access.")

    connection.commit()
    result = addContract(connection, merchant_id, lender_id, amount, tenure)
    if result.get("message", "").lower().startswith("error"):
        raise RuntimeError(result["message"])
    return result
