from sqlalchemy import create_engine, text
from dotenv import get_key
from fastapi import FastAPI
from loginAccount import loginAccount
from signupAccount import signupAccount as normalSignup
from signupAccountAgent import signupAccount as agentSignup
from editInventory import adjustInventory

app = FastAPI()
DATABASE_URL = get_key("./.env", "DATABASE_PATH")
conn = create_engine(DATABASE_URL).connect()


@app.get("/")
def init():
    return {"message": "Hello World"}


@app.post("/login")
def login(username: str, password: str, atype: str):
    return loginAccount(
        conection=conn, username=username, password=password, atype=atype
    )


@app.post("/createAccount")
def manageAccountLender(username: str, password: str, atype: str) -> dict:
    return normalSignup(
        connection=conn, username=username, password=password, atype=atype
    )


@app.post("/createAccountAgent")
def manageAccountAgent(username: str, password: str):
    return agentSignup(connection=conn, username=username, password=password)


@app.post("/editInventory")
def editInventory(products: list, prices: list, qtys: list, user_id: int):
    adjustInventory(
        connection=conn, products=products, prices=prices, qtys=qtys, user_id=user_id
    )
