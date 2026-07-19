import hashlib

from app.cache.domain.namespaces import DEFAULT_CACHE_NAMESPACE


def prompt_cache_key(
    prompt: str,
    *,
    namespace: str = DEFAULT_CACHE_NAMESPACE,
) -> str:
    digest = hashlib.sha256()
    digest.update(namespace.encode("utf-8"))
    digest.update(b"\0")
    digest.update(prompt.encode("utf-8"))
    return digest.hexdigest()
