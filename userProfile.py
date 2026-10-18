from sqlalchemy import text
from sqlalchemy.engine import Connection
from accountTypes import getAccountTypes


def getUserProfile(connection: Connection, user_id: str):
    result = connection.execute(
        text(
            'SELECT "user_id", "AType", "OName", "SName", "MobileNum", "lat", "long", "rating" '
            'FROM "Users" WHERE "user_id" = :user_id'
        ),
        {"user_id": user_id},
    ).mappings().first()
    connection.commit()
    if not result:
        return None

    profile = dict(result)
    profile["account_types"] = sorted(
        getAccountTypes(connection, user_id, profile["AType"])
    )
    connection.commit()
    return profile


def updateUserProfile(
    connection: Connection,
    user_id: str,
    owner_name: str | None,
    shop_name: str | None,
    mobile_number: str | None,
    latitude: float | None,
    longitude: float | None,
):
    if (latitude is None) != (longitude is None):
        raise ValueError("Enter both latitude and longitude, or leave both blank.")

    result = connection.execute(
        text(
            'UPDATE "Users" SET "OName" = :owner_name, "SName" = :shop_name, '
            '"MobileNum" = :mobile_number, "lat" = :latitude, "long" = :longitude '
            'WHERE "user_id" = :user_id'
        ),
        {
            "user_id": user_id,
            "owner_name": owner_name,
            "shop_name": shop_name,
            "mobile_number": mobile_number,
            "latitude": str(latitude) if latitude is not None else None,
            "longitude": str(longitude) if longitude is not None else None,
        },
    )
    if result.rowcount == 0:
        raise LookupError("User account not found.")
    connection.commit()
    return getUserProfile(connection, user_id)
