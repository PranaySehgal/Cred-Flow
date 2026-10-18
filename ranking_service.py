import json
import logging
import os
from pathlib import Path

from dotenv import get_key
from sqlalchemy import text
from sqlalchemy.engine import Connection

logger = logging.getLogger(__name__)
PROJECT_ROOT = Path(__file__).resolve().parent


def updateUserRanking(connection: Connection, user_id: str) -> dict:
    profile = connection.execute(
        text(
            'SELECT "SName", "lat", "long", "rating" FROM "Users" '
            'WHERE "user_id" = :user_id'
        ),
        {"user_id": user_id},
    ).mappings().first()
    connection.commit()

    if profile is None:
        return {"status": "failed", "message": "User account not found."}

    shop_name = profile["SName"]
    if (
        not shop_name
        or profile["lat"] is None
        or profile["long"] is None
        or str(profile["lat"]).strip() == ""
        or str(profile["long"]).strip() == ""
    ):
        return {
            "status": "needs_profile",
            "message": "Add a shop name and both coordinates to calculate a rank.",
            "rating": profile["rating"],
        }

    api_key = (
        os.environ.get("TINYFISH_API_KEY")
        or get_key(str(PROJECT_ROOT / ".env"), "TINYFISH_API_KEY")
        or os.environ.get("TINYFISH_API")
        or get_key(str(PROJECT_ROOT / ".env"), "TINYFISH_API")
    )
    if not api_key:
        logger.error("TinyFish ranking skipped: TINYFISH_API_KEY is not configured.")
        return {
            "status": "failed",
            "message": "TinyFish ranking is not configured on the server.",
            "rating": profile["rating"],
        }

    try:
        from generateRanking import evaluate_merchant_with_tinyfish

        result = evaluate_merchant_with_tinyfish(
            merchant_shop_name=shop_name,
            latitude=float(profile["lat"]),
            longitude=float(profile["long"]),
        )
        if isinstance(result, str):
            result = json.loads(result)
        if not isinstance(result, dict):
            raise ValueError("TinyFish returned an invalid ranking response.")

        score = result.get("calculated_rating")
        if isinstance(score, bool) or not isinstance(score, int) or not 0 <= score <= 100:
            raise ValueError("TinyFish returned a rating outside the valid 0–100 range.")

        connection.execute(
            text('UPDATE "Users" SET "rating" = :rating WHERE "user_id" = :user_id'),
            {"rating": score, "user_id": user_id},
        )
        connection.commit()
        return {"status": "updated", "rating": score, "result": result}
    except Exception as error:
        logger.exception("TinyFish ranking failed.")
        return {
            "status": "failed",
            "message": "TinyFish could not update this account's rank. Check the server log and try again at your next login.",
            "rating": profile["rating"],
        }
