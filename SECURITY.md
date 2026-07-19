# Security Policy

Semantix is a local-first semantic-cache laboratory. It is not presented as a
production-ready multi-tenant gateway, but security reports are still taken
seriously.

## Supported versions

| Version | Supported |
|---|:---:|
| `main` branch | Yes |
| Latest tagged release, when available | Yes |
| Older releases and historical commits | No |
| Third-party forks | No |

Please reproduce reports against the latest supported version when possible.

## Reporting a vulnerability

Do **not** open a public GitHub issue for a suspected vulnerability.

Use the repository's private GitHub vulnerability-reporting flow:

1. Open the repository's **Security** tab.
2. Open **Advisories**.
3. Select **Report a vulnerability**.
4. Submit the report privately.

Include:

- the affected commit, branch, or release;
- the affected endpoint, provider, cache backend, or deployment mode;
- reproducible steps or a minimal proof of concept;
- expected and observed behavior;
- realistic security impact and required attack conditions;
- sanitized logs, stack traces, or screenshots;
- a suggested remediation, when known.

Remove API keys, tokens, database passwords, private prompts, complete
responses, personal data, and unrelated production information.

## Response targets

The maintainers aim to:

- acknowledge reports within 72 hours;
- provide an initial assessment within 7 days;
- provide updates at least every 14 days while remediation is active;
- coordinate disclosure after a fix or mitigation is available.

These are targets rather than service-level guarantees.

## In scope

Useful reports include concrete issues involving:

- exposure of provider credentials, prompts, or cached responses;
- cross-namespace or cross-embedding-space data leakage;
- SQL injection or unsafe pgvector/database operations;
- server-side request forgery through provider configuration;
- unsafe provider URL or credential validation;
- arbitrary file access or command execution;
- exploitable dependency vulnerabilities;
- CORS or request-validation flaws with demonstrated impact;
- practical denial-of-service paths that bypass documented limits;
- unintended exposure of cache-management operations;
- migration, Docker, or startup behavior that creates a security boundary
  failure.

## Known design limitations

The following are documented limitations when Semantix runs as intended on a
trusted local machine:

- cache-management endpoints are unauthenticated;
- Docker Compose uses development database credentials;
- rate limiting, metrics, and request coalescing are process-local;
- the supplied deployment is local-first and single-instance;
- hosted providers receive prompts selected by the operator;
- Ollama exposes an unauthenticated API unless its network boundary is secured;
- exposing the development stack publicly without authentication, TLS, secret
  management, and network hardening is unsupported.

A report may still be valid when implementation behavior exceeds these stated
limitations.

## Out of scope

Please avoid reports based only on:

- model accuracy, hallucination, bias, or semantic-cache quality;
- expected provider latency, pricing, quotas, or rate limits;
- documented missing production hardening;
- attacks requiring control of the trusted host or Docker daemon;
- dependency version findings without a demonstrated exploit path;
- scanner output without reproducible impact;
- testing against third-party provider infrastructure without authorization.

Do not perform destructive testing, access data that is not yours, degrade
services, or incur provider charges without explicit authorization.

## Coordinated disclosure and safe harbor

Please allow reasonable time for investigation and remediation before public
disclosure.

Good-faith research that follows this policy, avoids privacy violations and
service disruption, and reports findings privately will be treated as
authorized for the purpose of improving Semantix. This policy does not
authorize testing against third-party providers, GitHub, Docker, hosting
platforms, or infrastructure not owned by the Semantix maintainers.
