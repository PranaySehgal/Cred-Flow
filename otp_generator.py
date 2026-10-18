from secrets import randbelow


def otp() -> str:
    return str(randbelow(900_000) + 100_000)
