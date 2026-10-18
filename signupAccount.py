from sqlalchemy import text
from argon2 import PasswordHasher
from accountTypes import (
    getAccountTypes,
    normalizeAccountType,
    ensureAccountTypesTable,
)
from checkPass import checkPass


def signupAccount(connection, username: str, password: str, atype: str):
    account_type = normalizeAccountType(atype)
    if account_type not in {"merchant", "lender", "agent"}:
        return {"STATUS": "ACCESS DENIED"}

    ensureAccountTypesTable(connection)
    existing_user = connection.execute(
        text(
            'SELECT "Password", "AType" FROM "Users" '
            'WHERE "user_id" = :username'
        ),
        {"username": username},
    ).mappings().first()
    connection.commit()

    if existing_user:
        if checkPass(existing_user["Password"], password).get("STATUS") != "SUCCESS":
            return {"STATUS": "Invalid Username Or Password"}

        account_types = getAccountTypes(
            connection, username, existing_user["AType"]
        )
        if account_type in account_types:
            role_status = connection.execute(
                text(
                    'SELECT "status" FROM "UserRoles" '
                    'WHERE "user_id" = :username AND "AType" = :atype'
                ),
                {"username": username, "atype": account_type},
            ).scalar_one()
            if role_status == "rejected":
                connection.execute(
                    text(
                        'UPDATE "UserRoles" SET "status" = :status '
                        'WHERE "user_id" = :username AND "AType" = :atype'
                    ),
                    {
                        "status": "pending" if account_type in {"merchant", "lender"} else "approved",
                        "username": username,
                        "atype": account_type,
                    },
                )
                connection.commit()
                return {
                    "STATUS": "SUCCESS",
                    "message": "Your account type request has been resubmitted for super-admin approval.",
                }
            connection.commit()
            return {"STATUS": "ACCOUNT TYPE ALREADY EXISTS"}

        connection.execute(
            text(
                'INSERT INTO "UserRoles" ("user_id", "AType", "status") '
                'VALUES (:username, :atype, :status)'
            ),
            {
                "username": username,
                "atype": account_type,
                "status": "pending" if account_type in {"merchant", "lender"} else "approved",
            },
        )
        connection.commit()
        return {
            "STATUS": "SUCCESS",
            "message": (
                f"Your {account_type} access request was sent to the super admin for approval."
                if account_type in {"merchant", "lender"}
                else f"{account_type.title()} access added to your existing account."
            ),
        }

    hashed_password = PasswordHasher().hash(password)
    connection.execute(
        text(
            'INSERT INTO "Users"("user_id", "AType", "Password", "rating") '
            'VALUES(:username, :atype, :password, 5)'
        ),
        {
            "username": username,
            "password": hashed_password,
            "atype": account_type,
        },
    )
    connection.execute(
        text(
            'INSERT INTO "UserRoles" ("user_id", "AType", "status") '
            'VALUES (:username, :atype, :status)'
        ),
        {
            "username": username,
            "atype": account_type,
            "status": "pending" if account_type in {"merchant", "lender"} else "approved",
        },
    )
    connection.commit()
    return {
        "STATUS": "SUCCESS",
        "message": (
            "Your account request was sent to the super admin for approval."
            if account_type in {"merchant", "lender"}
            else "Account created successfully."
        ),
    }
