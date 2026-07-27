from app.core.exceptions import InvalidProviderResponseError
from app.core.limits import MAX_RESPONSE_LENGTH


def validate_generation_response(value: object) -> str:
    if (
        not isinstance(value, str)
        or not value.strip()
        or len(value) > MAX_RESPONSE_LENGTH
    ):
        raise InvalidProviderResponseError(
            "Generation provider returned an invalid response"
        )
    return value
