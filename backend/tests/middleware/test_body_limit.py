import json
from collections import deque
from collections.abc import Sequence
from typing import cast

import pytest
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.middleware.body_limit import RequestBodyLimitMiddleware


async def run_request(
    headers: Sequence[tuple[bytes, bytes]],
    request_messages: Sequence[Message],
) -> list[Message]:
    sent: list[Message] = []
    messages = deque(request_messages)

    async def receive() -> Message:
        return messages.popleft()

    async def send(message: Message) -> None:
        sent.append(message)

    async def application(scope: Scope, receive: Receive, send: Send) -> None:
        while True:
            message = await receive()
            if not message.get("more_body", False):
                break
        await send({"type": "http.response.start", "status": 204, "headers": []})
        await send({"type": "http.response.body", "body": b""})

    middleware = RequestBodyLimitMiddleware(
        cast(ASGIApp, application),
        max_body_bytes=8,
    )
    scope = cast(
        Scope,
        {
            "type": "http",
            "method": "POST",
            "path": "/",
            "headers": list(headers),
        },
    )
    await middleware(scope, receive, send)
    return sent


@pytest.mark.asyncio
async def test_declared_oversized_body_is_rejected_before_the_app_runs() -> None:
    sent = await run_request(
        [(b"content-length", b"9")],
        [{"type": "http.request", "body": b"", "more_body": False}],
    )
    assert sent[0]["status"] == 413
    body = cast(bytes, sent[1]["body"])
    assert json.loads(body)["error"] == "request_too_large"


@pytest.mark.asyncio
async def test_chunked_oversized_body_is_rejected_while_streaming() -> None:
    sent = await run_request(
        [],
        [
            {"type": "http.request", "body": b"12345", "more_body": True},
            {"type": "http.request", "body": b"67890", "more_body": False},
        ],
    )
    assert sent[0]["status"] == 413
    body = cast(bytes, sent[1]["body"])
    assert json.loads(body)["error"] == "request_too_large"
