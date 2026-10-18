import re

import requests
from dotenv import get_key

SANDBOX_DOMAIN = (
    "Mailgun Sandbox <postmaster@sandbox35b80552eb4b4e8e9214919f75d36b5f.mailgun.org>"
)


def sendOTP(username: str, code: str):
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", username):
        raise ValueError(
            "This account's username must be a valid email address to receive a sign-in code."
        )

    api_key = get_key("./.env", "MAILGUN")
    if not api_key:
        raise RuntimeError(
            "The MAILGUN setting is missing from the backend environment."
        )
    print(username)
    response = requests.post(
        f"https://api.mailgun.net/v3/sandbox35b80552eb4b4e8e9214919f75d36b5f.mailgun.org/messages",
        auth=("api", api_key),
        data={
            "from": "Mailgun Sandbox <postmaster@sandbox35b80552eb4b4e8e9214919f75d36b5f.mailgun.org>",
            "to": username,
            "subject": "Multi-Factor Authentication",
            "text": f"Your CreditFlow sign-in code is {code}. It expires in 5 minutes.",
        },
    )

    if not response.ok:
        if (
            response.status_code == 400
            and "authorized recipients" in response.text.lower()
        ):
            raise RuntimeError(
                "Mailgun sandbox rejected this recipient. Authorize this email in Mailgun's sandbox settings, or configure a verified sending domain with MAILGUN_DOMAIN and MAILGUN_FROM."
            )
        if response.status_code in (401, 403):
            raise RuntimeError(
                "Mailgun rejected the API credentials or sender domain. Check MAILGUN, MAILGUN_DOMAIN, and MAILGUN_FROM."
            )
        raise RuntimeError(
            f"Mailgun could not send the sign-in code (HTTP {response.status_code}). Check the Mailgun sending logs and domain configuration."
        )

    try:
        result = response.json()
    except requests.exceptions.JSONDecodeError as error:
        raise RuntimeError(
            "Mailgun returned an unexpected response to the send request."
        ) from error

    if result.get("message") != "Queued. Thank you.":
        raise RuntimeError("Mailgun did not confirm that the sign-in code was queued.")
