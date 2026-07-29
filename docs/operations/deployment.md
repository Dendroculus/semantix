# Hardened deployment

This deployment path is optional for local development and required before Semantix is shared with untrusted users. It is a single-instance baseline, not a multi-tenant platform or multi-replica architecture.

## Deployment boundary

`docker-compose.prod.yml` publishes only the frontend gateway. The backend is reachable only on the internal `edge` network. PostgreSQL is reachable only on the internal `data` network. The frontend gateway proxies `/api`, `/health`, and `/ready` to the backend.

`docker-compose.prod.yml` uses the explicit Compose project name `semantix-prod`. Its PostgreSQL volume is therefore isolated from the local development volume and from volumes created by earlier versions of the default development stack.

The default host binding is:

```env
SEMANTIX_BIND_ADDRESS=127.0.0.1
SEMANTIX_PORT=8080
```

Run a TLS reverse proxy on the host and forward to `127.0.0.1:8080`. Public plaintext HTTP is unsupported.

## Access tokens

The backend stores only SHA-256 token digests in configuration. Users enter the original token at runtime. The browser keeps it in `sessionStorage`; it is not compiled into the frontend bundle.

Production deployments must use HTTPS. Generate a token and digest with
Python:

```bash
python -c "import hashlib,secrets; t=secrets.token_urlsafe(32); print('token='+t); print('sha256='+hashlib.sha256(t.encode()).hexdigest())"
```

Windows PowerShell 5.1 or later:

```powershell
$RandomBytes = New-Object byte[] 32
$Random = [Security.Cryptography.RandomNumberGenerator]::Create()
$Random.GetBytes($RandomBytes)
$Random.Dispose()
$Token = [Convert]::ToBase64String($RandomBytes)
$Bytes = [Text.Encoding]::UTF8.GetBytes($Token)
$Sha256 = [Security.Cryptography.SHA256]::Create()
$HashBytes = $Sha256.ComputeHash($Bytes)
$Sha256.Dispose()
$Hash = -join ($HashBytes | ForEach-Object { $_.ToString("x2") })
"token=$Token"
"sha256=$Hash"
```

Linux/macOS shell:

```bash
Token=$(openssl rand -base64 32)
Hash=$(echo -n "$Token" | openssl dgst -sha256 -hex | sed 's/^.* //')
echo "token=$Token"
echo "sha256=$Hash"
```

Set up an operator token as follows:

1. Generate a high-entropy random token using one of the commands above.
2. Calculate its lowercase SHA-256 digest.
3. Store only the digest in `AUTH_PRINCIPALS`.
4. Give the original token to the authorized operator through a secure
   channel. Never store the plaintext token in `AUTH_PRINCIPALS`.
5. Set `AUTH_MODE=token`.
6. Recreate the backend container so it receives the changed environment.
7. Verify that `/api/v1/auth/config` reports authentication as required.
8. Test one wrong token, then authenticate with the valid original token.

The relevant environment values are:

```env
AUTH_MODE=token
AUTH_PRINCIPALS=[{"name":"ops-admin","token_sha256":"<64-lowercase-hex>","role":"admin","namespaces":["*"]},{"name":"team-reader","token_sha256":"<64-lowercase-hex>","role":"viewer","namespaces":["team-a"]}]
```

Keep the original tokens in a secret manager. Rotating a token means generating
a new token, replacing its digest, and recreating the backend container.

For local Docker development, `docker-compose.dev.yml` reads both values from
`backend/.env`. After changing any value in that file, recreate the backend
container so Compose supplies the new environment. A plain container restart
does not reload changed environment values. An image rebuild is not required
for environment-only changes.

From the repository root in Windows PowerShell:

```powershell
docker compose `
  -f docker-compose.dev.yml `
  --profile pgvector `
  up -d --force-recreate backend
```

Verify the container and public authentication configuration:

```powershell
docker compose -f docker-compose.dev.yml --profile pgvector exec backend printenv AUTH_MODE
```

```powershell
Invoke-RestMethod http://localhost:8000/api/v1/auth/config
```

Token mode reports:

```text
authentication_required
-----------------------
True
```

Test a rejected token and then the valid original token:

```powershell
$WrongHeaders = @{ Authorization = "Bearer intentionally-wrong-token" }
try {
    Invoke-RestMethod http://localhost:8000/api/v1/auth/session -Headers $WrongHeaders
} catch {
    $_.Exception.Response.StatusCode.value__
}

$ValidHeaders = @{ Authorization = "Bearer $Token" }
Invoke-RestMethod http://localhost:8000/api/v1/auth/session -Headers $ValidHeaders
```

### Progressive authentication lockouts

Only failed authentication attempts against `/api/v1/auth/session` advance
the lockout. The first three failures lock that client address for 30 seconds.
After the lock expires, three additional failures lock it for 60 seconds.
After that lock expires, three additional failures lock it for 3,600 seconds.
Later stages remain at 3,600 seconds. A successful authentication completely
resets the client to the initial stage.

Requests made during an active lock receive HTTP `429`, a `Retry-After`
header, and the standard `authentication_temporarily_locked` error. They do
not extend the lock or count as additional failures. Authentication failures
on other protected endpoints do not advance this state.

Lockout state is held in memory, is process-local, and resets when the backend
process restarts. The supplied single-process deployment therefore enforces
the progression within that process. Multiple backend workers or replicas
would each have independent state and require a shared lockout store before
being treated as equivalent protection.

## Roles

| Role | Allowed operations |
|---|---|
| `viewer` | Read permitted cache metadata, threshold state, and benchmark datasets |
| `operator` | All viewer operations plus provider-backed queries and benchmark runs |
| `admin` | All operator operations plus cache deletion, namespace clear, and administration |

Updating the global similarity threshold and reading process-wide runtime
metrics require an `admin` principal with `namespaces:["*"]`. A namespace
administrator remains limited to its authorized cache operations and receives
`403 Forbidden` from `/api/v1/metrics`.

## Namespace authorization

Every principal receives one or more namespaces. A non-global principal cannot query, inspect, delete, or clear another namespace.

When a principal has exactly one namespace, cache list/stat requests without a namespace are automatically scoped to it. Principals with multiple namespaces must select one. Only `namespaces:["*"]` can perform global operations.

This is server-side authorization. Frontend controls are not treated as a security boundary.

## Proxy-aware client addresses

The limiter trusts forwarded addresses only when the direct peer belongs to `TRUSTED_PROXY_CIDRS`. Spoofed `X-Forwarded-For` from any other peer is ignored.

The production Compose network uses `172.28.0.0/24`, so the default is:

```env
TRUSTED_PROXY_CIDRS=["172.28.0.0/24"]
```

When another trusted TLS proxy adds forwarding headers before the frontend gateway, add that proxy's source CIDR as well. Do not add broad public ranges.

The supplied backend runs one process. Rate-limit state remains process-local. Multiple workers or replicas require shared limiter storage before deployment.

## URL configuration validation

`ALLOWED_ORIGINS` entries must be bare HTTP or HTTPS origins: a host
(including `localhost` or a bracketed IPv6 host) and an optional valid port.
A single trailing slash is normalized away. Credentials, paths, parameters,
queries, fragments, and malformed ports are rejected.

`DATABASE_URL` continues to accept PostgreSQL DSNs with optional valid ports,
query parameters, IPv6 hosts, and percent-encoded credentials. Malformed ports
now fail during startup validation. This intentionally rejects configurations
that were previously accepted even though they were not usable URLs.

## Request-size limits

The frontend gateway enforces `client_max_body_size 64k`. The backend independently enforces `MAX_REQUEST_BODY_BYTES=65536` before JSON parsing.

The ASGI limit handles both declared `Content-Length` and streamed/chunked request bodies. Oversized requests return HTTP `413` with the standard JSON error structure.

Keep the proxy and backend values aligned. The backend limit is the final authority when requests bypass or are forwarded by another proxy.

## Liveness and readiness

`GET /health` confirms the process can answer and reports only configured provider types. It is cheap and unrate-limited.

`GET /ready` verifies the active cache dependency. It does not call hosted embedding or generation providers. A later pgvector outage produces HTTP `503`, preventing the Compose frontend from starting against an unavailable backend.

## Database roles and migrations

The production database has two roles. Use URL-safe random passwords for the Compose example, or percent-encode credentials before placing them in a PostgreSQL URL.

- `POSTGRES_MIGRATION_USER` owns extension/schema migration work;
- `POSTGRES_RUNTIME_USER` receives only schema usage and DML privileges on the runtime cache tables.

The initialization script creates the runtime login. The one-shot `migrate` service connects with `MIGRATION_DATABASE_URL`, installs pgvector, applies versioned migrations, grants runtime privileges, and exits. The backend starts only after that job succeeds.

Applied migrations record a SHA-256 checksum. Startup rejects a packaged
migration whose contents no longer match its recorded checksum. A legacy
`0001` row without a checksum is backfilled only after the released cache
tables and required columns are verified; later checksum-less versions fail
closed and require operator review.

The backend receives only `DATABASE_URL` for the runtime role and sets:

```env
DATABASE_MIGRATION_MODE=external
```

Local development keeps:

```env
DATABASE_MIGRATION_MODE=auto
```

Never pass the migration DSN to the production backend service.

Changing Compose password variables does not update roles in an existing
volume. Follow [Operations and recovery](recovery.md) for credential rotation,
backup, restore, destructive rebuild, migration rollback, and incident response.

## Static server behavior

The production frontend image:

- runs `npm ci` and `npm run build` in a Node build stage;
- copies only `dist/` into an unprivileged Nginx runtime;
- provides SPA fallback for client-side routes;
- compresses text assets;
- gives fingerprinted assets immutable caching;
- prevents caching of `index.html`;
- adds CSP, frame, referrer, MIME-sniffing, and permissions headers.

`vite preview` is not used as a production server.

## Validation

```bash
docker compose -f docker-compose.dev.yml config --quiet
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
docker compose -f docker-compose.dev.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml build
```

Verify the production runtime:

```bash
curl -i http://127.0.0.1:8080/health
curl -i http://127.0.0.1:8080/ready
curl -i http://127.0.0.1:8080/cache
```

The `/cache` request must return the SPA entry document. An API request without a token must return `401`. A viewer token must not delete or globally clear cache data. Inspect the running frontend container and confirm its user is non-root.
