# Phase 1 Implementation Notes

## Maintainer decisions

- Maximum decoded provider response: 4 MiB (`4,194,304` bytes).
- Configuration: one shared backend setting,
  `PROVIDER_MAX_RESPONSE_BYTES=4194304`.
- Retryability: oversized responses are non-retryable.
- Compressed responses: request `Accept-Encoding: identity` and reject an
  encoded success response before reading its body.
- Declared size: reject before reading when a trustworthy `Content-Length`
  exceeds the configured limit.
- Public error: reuse `invalid_upstream_response`.
- Placement: enforce the limit only in shared provider transport. Provider
  instances carry the resolved setting to that transport.

## Ceiling review

The repository's decoded generation response is limited to 100,000 characters
by `MAX_RESPONSE_LENGTH`. Even if every non-BMP character is represented as a
12-byte JSON surrogate-pair escape, the response text occupies at most
1,200,000 bytes before the provider envelope, below 4 MiB.

Documented embedding configurations use 384 dimensions for Hugging Face and
mock providers and 768 dimensions for Ollama. At a conservative 32 bytes per
numeric component, a 768-dimension vector occupies 24,576 bytes before its
small JSON envelope, also well below 4 MiB.

The code-level embedding dimension fields currently validate only that values
are positive; they have no finite upper bound. Consequently, no finite
transport ceiling can preserve every theoretical configured dimension.
Minimal JSON vectors containing one-byte zero values first cross 4 MiB at:

| Provider response shape | First dimension over 4 MiB |
| --- | ---: |
| Hugging Face direct vector | 2,097,152 |
| OpenAI embedding envelope | 2,097,140 |
| Gemini embedding envelope | 2,097,140 |
| Ollama embedding envelope | 2,097,144 |

The maintainer-approved 4 MiB value is therefore the effective transport
ceiling. Adding a separate embedding-dimension maximum would be a breaking
configuration-policy change outside `REL-001` and is not included in this
phase.

## Implementation result

The provider factory binds the resolved `Settings` limit to each provider
instance, which passes it to the shared transport for every logical request.
The transport requests identity encoding and rejects an unexpected encoded
success response before iterating its body, preventing HTTPX from decompressing
an oversized representation before the size check. It checks a valid decimal
`Content-Length`, streams identity-encoded bytes in bounded chunks, stops before
appending a chunk that would cross the ceiling, and parses JSON only after the
complete response is within the limit.

Size violations use an internal subtype of `InvalidProviderResponseError`.
This preserves the public `invalid_upstream_response` error and makes the
violation non-retryable under the existing retry policy, which retries only
`ProviderRetryableError`.
