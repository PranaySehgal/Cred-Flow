import logging
from typing import Literal

from sqlalchemy import create_engine, text
from dotenv import get_key
from fastapi import Body, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, model_validator
from loginAccount import loginAccount
from signupAccount import signupAccount as normalSignup
from signupAccountAgent import signupAccount as agentSignup
from editInventory import adjustInventory, getInventory
from mfa import sendOTP
from assignAgent import *
from getLenderInfo import *
from getMerchantInfo import *
from issues import *
from updateContract import *
from addContract import *
from addTransactions import *
from mfa_challenges import createMfaChallenge, resendMfaChallenge, verifyMfaChallenge
from auth_sessions import createAuthSession, getAuthSession, revokeAuthSession
from superadmin_service import (
    createManagedContract,
    decideAccountRequest,
    getIssueOwner,
    getManagedAccounts,
    getPendingAccountRequests,
    getPendingIssues,
)

app = FastAPI()
logger = logging.getLogger(__name__)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
DATABASE_URL = get_key("./.env", "DATABASE_PATH").strip()
conn = create_engine(DATABASE_URL).connect()
bearer_scheme = HTTPBearer(auto_error=False)


class AccountCredentials(BaseModel):
    username: str
    password: str
    atype: str


class MfaVerification(BaseModel):
    challenge_id: str = Field(min_length=1, max_length=128)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class MfaResend(BaseModel):
    challenge_id: str = Field(min_length=1, max_length=128)


class AgentDecisionRequest(BaseModel):
    lat: float
    long: float
    date: str
    oname: str
    ocontact: str
    status: Literal["accepted", "declined"]


class IssueResolution(BaseModel):
    issue_id: str = Field(min_length=1, max_length=255)


class AccountRequestDecision(BaseModel):
    user_id: str = Field(min_length=1, max_length=255)
    atype: Literal["merchant", "lender"]
    decision: Literal["approved", "rejected"]


class ContractCreate(BaseModel):
    merchant_id: str = Field(min_length=1, max_length=255)
    lender_id: str = Field(min_length=1, max_length=255)
    amount: int = Field(gt=0)
    tenure: int = Field(gt=0)


class InventoryItem(BaseModel):
    product: str = Field(min_length=1, max_length=255)
    price: float = Field(ge=0)
    quantity: int = Field(ge=0)


class InventoryUpdate(BaseModel):
    items: list[InventoryItem] = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def validate_products(self):
        products = [item.product.strip() for item in self.items]
        if any(not product for product in products):
            raise ValueError("Product names cannot be blank.")
        if len(products) != len(set(products)):
            raise ValueError("Each product can only appear once per update.")
        return self


class ProfileDetails(BaseModel):
    user_id: str = Field(min_length=1, max_length=255)
    owner_name: str | None = Field(default=None, max_length=255)
    shop_name: str | None = Field(default=None, max_length=255)
    mobile_number: str | None = Field(default=None, max_length=32)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def validate_coordinates(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Enter both latitude and longitude, or leave both blank.")
        return self


def authenticatedSession(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    if not credentials:
        raise HTTPException(status_code=401, detail="Sign in is required.")
    session = getAuthSession(conn, credentials.credentials)
    if not session:
        raise HTTPException(status_code=401, detail="Your session has expired. Sign in again.")
    return {**session, "token": credentials.credentials}


def requireSuperAdmin(session=Depends(authenticatedSession)):
    if session["atype"] != "superadmin":
        raise HTTPException(status_code=403, detail="Super-admin access is required.")
    return session


def requireContractCreator(session=Depends(authenticatedSession)):
    if session["atype"] not in {"lender", "superadmin"}:
        raise HTTPException(status_code=403, detail="Only lenders or super admins can create contracts.")
    return session


def requireLender(session=Depends(authenticatedSession)):
    if session["atype"] != "lender":
        raise HTTPException(status_code=403, detail="Lender access is required.")
    return session


def requireMerchant(session=Depends(authenticatedSession)):
    if session["atype"] != "merchant":
        raise HTTPException(status_code=403, detail="Merchant access is required.")
    return session


@app.post("/auth/login-with-ranking")
def authenticateAndRank(credentials: AccountCredentials):
    return startMfaLogin(credentials.username, credentials.password, credentials.atype)


def startMfaLogin(username: str, password: str, atype: str):
    result = loginAccount(
        connection=conn,
        username=username,
        password=password,
        atype=atype,
    )
    conn.commit()
    if not result or result.get("STATUS") != "SUCCESS":
        return result or {"STATUS": "Invalid Username Or Password"}

    try:
        challenge_id, code = createMfaChallenge(
            conn, username, atype.strip().lower()
        )
        sendOTP(username, code)
    except Exception as error:
        logger.exception("Could not send a multi-factor authentication code.")
        if "challenge_id" in locals():
            conn.execute(
                text('DELETE FROM "MFAChallenges" WHERE "challenge_id" = :challenge_id'),
                {"challenge_id": challenge_id},
            )
            conn.commit()
        detail = (
            str(error)
            if isinstance(error, (RuntimeError, ValueError))
            else "The mail service could not send a sign-in code. Check its configuration and sending logs."
        )
        raise HTTPException(status_code=503, detail=detail) from error

    return {
        "STATUS": "MFA_REQUIRED",
        "challenge_id": challenge_id,
        "message": "A verification code was sent to your email address.",
    }


def rankAuthenticatedUser(username: str, atype: str):
    if atype.strip().lower() not in {"merchant", "lender"}:
        return None
    try:
        from ranking_service import updateUserRanking

        return updateUserRanking(conn, username)
    except Exception:
        logger.exception("Could not run ranking after a verified login.")
        return {
            "status": "failed",
            "message": "Ranking could not be updated. Check the server configuration and try again at your next login.",
        }


@app.post("/auth/verify-otp")
def verifyOtp(verification: MfaVerification):
    result = verifyMfaChallenge(conn, verification.challenge_id, verification.code)
    if result["STATUS"] != "SUCCESS":
        return result
    ranking = rankAuthenticatedUser(result["username"], result["atype"])
    access_token = createAuthSession(conn, result["username"], result["atype"])
    return {
        "STATUS": "SUCCESS",
        "ranking": ranking,
        "access_token": access_token,
        "token_type": "bearer",
    }


@app.post("/auth/logout")
def logout(session=Depends(authenticatedSession)):
    revokeAuthSession(conn, session["token"])
    return {"STATUS": "SUCCESS"}


@app.post("/superadmin/accounts")
def listManagedAccounts(session=Depends(requireSuperAdmin)):
    return {"accounts": getManagedAccounts(conn)}


@app.post("/superadmin/account-requests")
def listPendingAccountRequests(session=Depends(requireSuperAdmin)):
    return {"requests": getPendingAccountRequests(conn)}


@app.post("/superadmin/account-requests/decision")
def reviewAccountRequest(
    request: AccountRequestDecision,
    session=Depends(requireSuperAdmin),
):
    try:
        return decideAccountRequest(conn, request.user_id, request.atype, request.decision)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/superadmin/accounts/update")
def updateManagedAccount(
    profile: ProfileDetails, session=Depends(requireSuperAdmin)
):
    from userProfile import updateUserProfile

    try:
        return updateUserProfile(
            connection=conn,
            user_id=profile.user_id,
            owner_name=profile.owner_name,
            shop_name=profile.shop_name,
            mobile_number=profile.mobile_number,
            latitude=profile.latitude,
            longitude=profile.longitude,
        )
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/superadmin/issues")
def listPendingIssues(session=Depends(requireSuperAdmin)):
    return {"issues": getPendingIssues(conn)}


@app.post("/superadmin/issues/resolve")
def resolveManagedIssue(issue: IssueResolution, session=Depends(requireSuperAdmin)):
    try:
        return setIssue(conn, issue.issue_id)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/superadmin/contracts")
def createSuperAdminContract(
    contract: ContractCreate, session=Depends(requireSuperAdmin)
):
    try:
        return createManagedContract(
            conn,
            contract.merchant_id,
            contract.lender_id,
            contract.amount,
            contract.tenure,
        )
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post("/auth/resend-otp")
def resendOtp(request: MfaResend):
    challenge = resendMfaChallenge(conn, request.challenge_id)
    if not challenge:
        raise HTTPException(
            status_code=410,
            detail="This verification request expired. Sign in again to get a new code.",
        )
    username, code = challenge
    if username is None:
        raise HTTPException(
            status_code=429,
            detail="Too many new codes were requested. Sign in again to start a new verification.",
        )
    try:
        sendOTP(username, code)
    except Exception as error:
        logger.exception("Could not resend a multi-factor authentication code.")
        detail = (
            str(error)
            if isinstance(error, (RuntimeError, ValueError))
            else "The mail service could not send a verification code. Check its configuration and sending logs."
        )
        raise HTTPException(status_code=503, detail=detail) from error
    return {"STATUS": "SUCCESS", "message": "A new verification code was sent."}


@app.post("/getUserProfile")
def getProfile(user_id: str, session=Depends(authenticatedSession)):
    from userProfile import getUserProfile

    if session["atype"] != "superadmin" and session["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="You can only view your own account.")
    profile = getUserProfile(conn, user_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="User account not found.")
    return profile


@app.post("/updateUserProfile")
def updateProfile(profile: ProfileDetails, session=Depends(authenticatedSession)):
    from userProfile import updateUserProfile

    if session["atype"] != "superadmin" and session["user_id"] != profile.user_id:
        raise HTTPException(status_code=403, detail="You can only update your own account.")
    try:
        return updateUserProfile(
            connection=conn,
            user_id=profile.user_id,
            owner_name=profile.owner_name,
            shop_name=profile.shop_name,
            mobile_number=profile.mobile_number,
            latitude=profile.latitude,
            longitude=profile.longitude,
        )
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/auth/login")
def authenticateAccount(credentials: AccountCredentials):
    return startMfaLogin(credentials.username, credentials.password, credentials.atype)


@app.post("/auth/createAccount")
def createAccount(credentials: AccountCredentials):
    return normalSignup(
        connection=conn,
        username=credentials.username,
        password=credentials.password,
        atype=credentials.atype,
    )


@app.get("/")
def init():
    return {"message": "Hello World"}


@app.post("/loginAccount")
def login(username: str, password: str, atype: str):
    return startMfaLogin(username, password, atype)


@app.post("/createAccount")
def manageAccountLender(username: str, password: str, atype: str) -> dict:
    return normalSignup(
        connection=conn, username=username, password=password, atype=atype
    )


@app.post("/createAccountAgent")
def manageAccountAgent(username: str, password: str):
    return agentSignup(connection=conn, username=username, password=password)


@app.post("/editInventory")
def editInventory(
    products: list,
    prices: list,
    qtys: list,
    user_id: str,
    session=Depends(requireMerchant),
):
    if user_id != session["user_id"]:
        raise HTTPException(status_code=403, detail="You can only update your own inventory.")
    try:
        adjustInventory(conn, products, prices, qtys, user_id)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return {"STATUS": "SUCCESS"}


@app.post("/merchant/inventory/list")
def listMerchantInventory(session=Depends(requireMerchant)):
    return {"inventory": getInventory(conn, session["user_id"])}


@app.post("/merchant/inventory/update")
def updateMerchantInventory(
    inventory: InventoryUpdate,
    session=Depends(requireMerchant),
):
    adjustInventory(
        conn,
        [item.product.strip() for item in inventory.items],
        [item.price for item in inventory.items],
        [item.quantity for item in inventory.items],
        session["user_id"],
    )
    return {"STATUS": "SUCCESS", "message": "Inventory saved successfully."}


@app.post("/sendOTP")
def send(username: str):
    raise HTTPException(
        status_code=410,
        detail="Use the sign-in verification flow to request a one-time code.",
    )


@app.post("/addContract")
def createC(
    mid: str,
    lid: str,
    amount: int = Query(gt=0),
    tenure: int = Query(gt=0),
    session=Depends(requireContractCreator),
):
    if session["atype"] == "lender" and session["user_id"] != lid:
        raise HTTPException(
            status_code=403, detail="Lenders can only create contracts for their own account."
        )
    try:
        return createManagedContract(conn, mid, lid, amount, tenure)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post("/addTransactions")
def createT(mid, amount, transact_id, method):
    return addTransaction(conn, transact_id, mid, amount, method)


@app.post("/assignAgent")
def assiAgent(aid, lat, long, date, oname, ocontact):
    return assignAgent(conn, aid, lat, long, date, oname, ocontact)


@app.post("/setDecision")
def decisAgent(aid, lat, long, date, oname, ocontact, status):
    return agentDecision(conn, aid, lat, long, date, oname, ocontact, status)


@app.post("/agent/tasks")
def listAgentTasks(agent_id: str, session=Depends(authenticatedSession)):
    if session["atype"] != "agent" or session["user_id"] != agent_id:
        raise HTTPException(status_code=403, detail="You can only view your own assignments.")
    return getAgentTasks(conn, agent_id)


@app.post("/agent/tasks/decision")
def decideAgentTask(
    agent_id: str,
    decision: AgentDecisionRequest,
    session=Depends(authenticatedSession),
):
    if session["atype"] != "agent" or session["user_id"] != agent_id:
        raise HTTPException(status_code=403, detail="You can only respond to your own assignments.")
    try:
        return agentDecision(
            conn,
            agent_id,
            decision.lat,
            decision.long,
            decision.date,
            decision.oname,
            decision.ocontact,
            decision.status,
        )
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/infoLender")
def infoLender(user_id: str):
    return getLenderInfo(conn, user_id)


@app.post("/infoMerchant")
def infoMerchant(user_id: str):
    return getMerchantInfo(conn, user_id)


@app.post("/createIssue")
def cIssue(user_id: str, desc: str, session=Depends(authenticatedSession)):
    if session["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Issues can only be created for your own account.")
    return createIssue(conn, user_id, desc)


@app.post("/getIssues")
def gIssue(user_id: str | None = None, session=Depends(authenticatedSession)):
    if user_id is None and session["atype"] != "superadmin":
        raise HTTPException(status_code=403, detail="Super-admin access is required to list all issues.")
    if user_id is not None and session["user_id"] != user_id and session["atype"] != "superadmin":
        raise HTTPException(status_code=403, detail="You can only view your own issues.")
    return getIssues(conn, user_id)


@app.post("/setIssues")
def sIssue(issue_id: str, session=Depends(authenticatedSession)):
    owner_id = getIssueOwner(conn, issue_id)
    if owner_id is None:
        raise HTTPException(status_code=404, detail="Issue not found.")
    if session["user_id"] != owner_id and session["atype"] != "superadmin":
        raise HTTPException(status_code=403, detail="You can only resolve your own issues.")
    try:
        return setIssue(conn, issue_id)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/updateContract")
def updateC(
    mid: str,
    lid: str,
    amountPaid: int,
    dop: str,
    session=Depends(requireLender),
):
    if session["user_id"] != lid:
        raise HTTPException(
            status_code=403, detail="Lenders can only update repayments for their own account."
        )
    return updateContract(conn, mid, lid, amountPaid, dop)
