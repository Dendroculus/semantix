from app.core.limits import MAX_RESPONSE_PREVIEW_LENGTH


def response_preview(response: str) -> str:
    if len(response) <= MAX_RESPONSE_PREVIEW_LENGTH:
        return response
    return response[: MAX_RESPONSE_PREVIEW_LENGTH - 3] + "..."
