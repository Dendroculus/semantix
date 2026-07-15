import json
import logging
from datetime import UTC, datetime
from typing import Final


class RedactingJsonFormatter(logging.Formatter):
    def __init__(self, secrets: tuple[str, ...]) -> None:
        super().__init__()
        self._secrets: Final[tuple[str, ...]] = tuple(secret for secret in secrets if secret)

    def _redact(self, value: str) -> str:
        redacted = value
        for secret in self._secrets:
            redacted = redacted.replace(secret, "[REDACTED]")
        return redacted

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, str] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": self._redact(record.getMessage()),
        }
        if record.exc_info is not None:
            payload["exception"] = self._redact(self.formatException(record.exc_info))
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(level: str, secrets: tuple[str, ...]) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(RedactingJsonFormatter(secrets))
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(level)
