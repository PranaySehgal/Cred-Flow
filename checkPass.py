from argon2 import PasswordHasher


def checkPass(hashed_password: str, password: str):
    ph = PasswordHasher()
    try:
        ph.verify(hashed_password, password)
        return {"STATUS": "SUCCESS"}
    except:
        return {"STATUS": "Invalid Username Or Password"}
