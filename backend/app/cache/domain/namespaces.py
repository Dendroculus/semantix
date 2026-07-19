"""Cache namespace validation and defaults."""

from typing import Annotated

from pydantic import StringConstraints

DEFAULT_CACHE_NAMESPACE = "default"
MAX_CACHE_NAMESPACE_LENGTH = 64
CACHE_NAMESPACE_PATTERN = (
    rf"^[A-Za-z0-9][A-Za-z0-9._:-]"
    rf"{{0,{MAX_CACHE_NAMESPACE_LENGTH - 1}}}$"
)

CacheNamespace = Annotated[
    str,
    StringConstraints(
        min_length=1,
        max_length=MAX_CACHE_NAMESPACE_LENGTH,
        pattern=CACHE_NAMESPACE_PATTERN,
    ),
]
