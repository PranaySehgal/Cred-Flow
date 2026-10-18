from sqlalchemy import text
from argon2 import PasswordHasher


def signupAccount(connection, username: str, password: str):
    hashedPassword = PasswordHasher().hash(password)
    query = text(
        """INSERT INTO "Users"("user_id","Password","AType") values(:username,:password,'Agent')"""
    )
    connection.execute(query, {"username": username, "password": hashedPassword})
    connection.commit()
    return {"message": "Account created successfully"}
