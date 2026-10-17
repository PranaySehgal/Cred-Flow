from sqlalchemy import text, create_engine
from dotenv import get_key
from .checkPass import checkPass


def loginAccount(connection, username: str, password: str, atype: str):
    query = text("SELECT * FROM USERS WHERE username = :username and AType = :atype")
    res = connection.execute(
        query, {"username": username, "password": password, "atype": atype}
    )
    res = res.fetchone()
    if res:
        return checkPass(res[1], password)
