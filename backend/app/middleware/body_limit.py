import json
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class RequestBodyTooLargeError(Exception):
    pass


class RequestBodyLimitMiddleware:
    def __init__(self, app: ASGIApp, max_body_bytes: int) -> None:
        self._app = app
        self._max_body_bytes = max_body_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return

        declared_length = self._content_length(scope)
        if declared_length is None:
            await self._run_with_stream_limit(scope, receive, send)
            return
        if declared_length < 0:
            await self._send_error(
                send,
                400,
                "invalid_content_length",
                "Invalid Content-Length header.",
            )
            return
        if declared_length > self._max_body_bytes:
            await self._send_too_large(send)
            return
        await self._run_with_stream_limit(scope, receive, send)

    def _content_length(self, scope: Scope) -> int | None:
        for name, value in scope.get("headers", []):
            if name.lower() != b"content-length":
                continue
            try:
                return int(value.decode("ascii"))
            except (UnicodeDecodeError, ValueError):
                return -1
        return None

    async def _run_with_stream_limit(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        consumed = 0
        response_started = False

        async def limited_receive() -> Message:
            nonlocal consumed
            message = await receive()
            if message["type"] == "http.request":
                consumed += len(message.get("body", b""))
                if consumed > self._max_body_bytes:
                    raise RequestBodyTooLargeError
            return message

        async def tracked_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self._app(scope, limited_receive, tracked_send)
        except RequestBodyTooLargeError:
            if response_started:
                raise
            await self._send_too_large(send)

    async def _send_too_large(self, send: Send) -> None:
        await self._send_error(
            send,
            413,
            "request_too_large",
            f"Request body exceeds the {self._max_body_bytes}-byte limit.",
        )

    @staticmethod
    async def _send_error(
        send: Send,
        status_code: int,
        error: str,
        detail: str,
    ) -> None:
        body = json.dumps({"error": error, "detail": detail}).encode("utf-8")
        await send(
            {
                "type": "http.response.start",
                "status": status_code,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode("ascii")),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})
