import secrets
import time

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy import text

from otp_generator import otp


CHALLENGE_LIFETIME_SECONDS = 300
MAX_ATTEMPTS = 5
MAX_RESENDS = 3
OTP_HASHER = PasswordHasher()


def ensureMfaChallengesTable(connection):
    connection.execute(
        text(
            'CREATE TABLE IF NOT EXISTS "MFAChallenges" ('
            '"challenge_id" TEXT PRIMARY KEY, '
            '"user_id" TEXT NOT NULL, '
            '"AType" TEXT NOT NULL, '
            '"code_hash" TEXT NOT NULL, '
            '"expires_at" REAL NOT NULL, '
            '"attempts" INTEGER NOT NULL, '
            '"resends" INTEGER NOT NULL DEFAULT 0'
            ')'
        )
    )


def createMfaChallenge(connection, username: str, atype: str):
    ensureMfaChallengesTable(connection)
    challenge_id = secrets.token_urlsafe(32)
    code = otp()
    code_hash = OTP_HASHER.hash(f"{challenge_id}:{code}")
    connection.execute(
        text(
            'INSERT INTO "MFAChallenges" '
            '("challenge_id", "user_id", "AType", "code_hash", "expires_at", "attempts") '
            'VALUES (:challenge_id, :user_id, :atype, :code_hash, :expires_at, 0)'
        ),
        {
            "challenge_id": challenge_id,
            "user_id": username,
            "atype": atype,
            "code_hash": code_hash,
            "expires_at": time.time() + CHALLENGE_LIFETIME_SECONDS,
        },
    )
    connection.commit()
    return challenge_id, code


def resendMfaChallenge(connection, challenge_id: str):
    ensureMfaChallengesTable(connection)
    challenge = connection.execute(
        text(
            'SELECT "user_id", "expires_at", "resends" FROM "MFAChallenges" '
            'WHERE "challenge_id" = :challenge_id'
        ),
        {"challenge_id": challenge_id},
    ).mappings().first()
    if not challenge or challenge["expires_at"] <= time.time():
        connection.execute(
            text('DELETE FROM "MFAChallenges" WHERE "challenge_id" = :challenge_id'),
            {"challenge_id": challenge_id},
        )
        connection.commit()
        return None

    if challenge["resends"] >= MAX_RESENDS:
        connection.commit()
        return (None, None)

    code = otp()
    code_hash = OTP_HASHER.hash(f"{challenge_id}:{code}")
    connection.execute(
        text(
            'UPDATE "MFAChallenges" SET "code_hash" = :code_hash, '
            '"expires_at" = :expires_at, "attempts" = 0, '
            '"resends" = "resends" + 1 '
            'WHERE "challenge_id" = :challenge_id'
        ),
        {
            "challenge_id": challenge_id,
            "code_hash": code_hash,
            "expires_at": time.time() + CHALLENGE_LIFETIME_SECONDS,
        },
    )
    connection.commit()
    return challenge["user_id"], code


def verifyMfaChallenge(connection, challenge_id: str, code: str):
    ensureMfaChallengesTable(connection)
    challenge = connection.execute(
        text(
            'SELECT "user_id", "AType", "code_hash", "expires_at", "attempts" '
            'FROM "MFAChallenges" WHERE "challenge_id" = :challenge_id'
        ),
        {"challenge_id": challenge_id},
    ).mappings().first()
    if not challenge:
        connection.commit()
        return {"STATUS": "OTP_EXPIRED"}

    if challenge["expires_at"] <= time.time():
        connection.execute(
            text('DELETE FROM "MFAChallenges" WHERE "challenge_id" = :challenge_id'),
            {"challenge_id": challenge_id},
        )
        connection.commit()
        return {"STATUS": "OTP_EXPIRED"}

    if challenge["attempts"] >= MAX_ATTEMPTS:
        connection.execute(
            text('DELETE FROM "MFAChallenges" WHERE "challenge_id" = :challenge_id'),
            {"challenge_id": challenge_id},
        )
        connection.commit()
        return {"STATUS": "OTP_LOCKED"}

    try:
        is_valid = OTP_HASHER.verify(
            challenge["code_hash"], f"{challenge_id}:{code}"
        )
    except VerifyMismatchError:
        is_valid = False
    if not is_valid:
        attempts = challenge["attempts"] + 1
        connection.execute(
            text(
                'UPDATE "MFAChallenges" SET "attempts" = :attempts '
                'WHERE "challenge_id" = :challenge_id'
            ),
            {"challenge_id": challenge_id, "attempts": attempts},
        )
        if attempts >= MAX_ATTEMPTS:
            connection.execute(
                text('DELETE FROM "MFAChallenges" WHERE "challenge_id" = :challenge_id'),
                {"challenge_id": challenge_id},
            )
            connection.commit()
            return {"STATUS": "OTP_LOCKED"}
        connection.commit()
        return {"STATUS": "OTP_INVALID"}

    connection.execute(
        text('DELETE FROM "MFAChallenges" WHERE "challenge_id" = :challenge_id'),
        {"challenge_id": challenge_id},
    )
    connection.commit()
    return {
        "STATUS": "SUCCESS",
        "username": challenge["user_id"],
        "atype": challenge["AType"],
    }
