import os
from pathlib import Path
from urllib.parse import quote

from dotenv import get_key
from tinyfish import TinyFish

# Initialize the TinyFish client (reads TINYFISH_API_KEY from environment)
ENV_FILE = str(Path(__file__).resolve().with_name(".env"))
API_KEY = (
    os.environ.get("TINYFISH_API_KEY")
    or get_key(ENV_FILE, "TINYFISH_API_KEY")
    or os.environ.get("TINYFISH_API")
    or get_key(ENV_FILE, "TINYFISH_API")
)
client = TinyFish(api_key=API_KEY)


def evaluate_merchant_with_tinyfish(
    merchant_shop_name: str,
    latitude: float,
    longitude: float,
    total_active_days: int = 0,
    repayment_success_rate: float = 100.0,
    default_days: int = 0,
) -> dict[str, Any]:
    """
    Sends the complete verification and risk-scoring goal to TinyFish using only lat/long.
    """

    goal = f"""
    You are an automated Credit Risk AI for a merchant-lender microfinance platform.
    
    TARGET MERCHANT DATA:
    - Shop Name: "{merchant_shop_name}"
    - Target Input Coordinates: Latitude {latitude}, Longitude {longitude}
    - Internal Ledger Stats: {total_active_days} active days, {repayment_success_rate}% repayment success rate, {default_days} recorded defaults.
    
    INSTRUCTIONS:
    1. Look at the map view centered at the provided coordinates ({latitude}, {longitude}).
    2. Search for "{merchant_shop_name}" around this location.
    3. Verify if the business actually exists there, calculate the exact physical distance (in meters) between your input coordinates and the found storefront's actual map pin, and extract its online reviews and star rating.
    4. Synthesize the web-scraped verification data with the provided internal ledger stats.
    5. Compute a deterministic credit score from 0 to 100, heavily weighting verification, distance offset, and payment history.
    6. Assign a risk tier ("Low Risk", "Moderate Risk", "High Risk", or "Unverified / Reject") and a loan multiplier.
    
    Return ONLY a valid JSON object with the following structure:
    {{
      "matched_business_name": "string or null",
      "is_verified": boolean,
      "distance_meters": number or null,
      "average_rating": number or null,
      "total_reviews": number or null,
      "calculated_rating": integer (0 to 100),
      "risk_tier": "Low Risk" | "Moderate Risk" | "High Risk" | "Unverified / Reject",
      "recommended_loan_multiplier": number,
      "risk_factors": ["string"],
      "source_url": "string or null"
    }}
    """

    # Center Google Maps directly on the lat/long coordinates and query the shop name
    maps_url = (
        f"https://www.google.com/maps/search/{quote(merchant_shop_name, safe='')}"
        f"/@{latitude},{longitude},16z"
    )

    response = client.agent.run(url=maps_url, goal=goal)

    return response.result
