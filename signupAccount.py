from sqlalchemy import text
from argon2 import PasswordHasher


def signupAccount(connection, username: str, password: str, atype: str):
    hashedPassword = PasswordHasher().hash(password)
    if atype == "agent":
        return {"STATUS": "ACCESS DENIED"}
    query = text(
        "INSERT INTO Users(username,password,AType) values(:username,:password,:atype)"
    )
    connection.execute(
        query, {"username": username, "password": hashedPassword, "atype": atype}
    )
    connection.commit()
    return {"message": "Account created successfully"}
