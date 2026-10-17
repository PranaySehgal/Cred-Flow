from sqlalchemy import text
from argon2 import PasswordHasher


def signupAccount(connection, username: str, password: str, atype: str):
    hashedPassword = PasswordHasher().hash(password)
    query = text(
        "INSERT INTO Users(username,password,AType) values(:username,:password,'Agent')"
    )
    connection.execute(query, {"username": username, "password": hashedPassword})
    connection.commit()
    return {"message": "Account created successfully"}
