from sqlalchemy import text
from accountTypes import (
    getAccountTypes,
    normalizeAccountType,
)
from checkPass import checkPass


def loginAccount(connection, username: str, password: str, atype: str):
    account_type = normalizeAccountType(atype)
    if account_type is None:
        return {"STATUS": "Invalid Username Or Password"}

    user = connection.execute(
        text(
            'SELECT "Password", "AType" FROM "Users" '
            'WHERE "user_id" = :username'
        ),
        {"username": username},
    ).mappings().first()
    if not user or checkPass(user["Password"], password).get("STATUS") != "SUCCESS":
        connection.commit()
        return {"STATUS": "Invalid Username Or Password"}

    account_types = getAccountTypes(
        connection, username, user["AType"]
    )
    role_status = connection.execute(
        text(
            'SELECT "status" FROM "UserRoles" '
            'WHERE "user_id" = :username AND lower("AType") = :atype'
        ),
        {"username": username, "atype": account_type},
    ).scalar_one_or_none()
    connection.commit()
    if account_type not in account_types:
        return {"STATUS": "Invalid Username Or Password"}
    if role_status == "pending":
        return {"STATUS": "PENDING_APPROVAL"}
    if role_status == "rejected":
        return {"STATUS": "ACCOUNT_REJECTED"}
    if role_status != "approved":
        return {"STATUS": "Invalid Username Or Password"}

    return {"STATUS": "SUCCESS"}
