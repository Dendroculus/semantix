FROM ghcr.io/astral-sh/uv:0.11.33@sha256:77280f2f771df71f90786c314fe1bbc1e023feac652969bbf139c280babf2eb7 AS uv

FROM python:3.14-slim@sha256:cea0e6040540fb2b965b6e7fb5ffa00871e632eef63719f0ea54bca189ce14a6 AS builder

COPY --from=uv /uv /uvx /bin/

ENV UV_NO_CACHE=1 \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY app ./app
RUN uv sync --locked --no-dev --no-editable

FROM python:3.14-slim@sha256:cea0e6040540fb2b965b6e7fb5ffa00871e632eef63719f0ea54bca189ce14a6 AS runtime

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN addgroup --system app \
    && adduser --system --ingroup app app \
    && SYSTEM_SITE_PACKAGES="$(python -c 'import site; print(site.getsitepackages()[0])')" \
    && rm -rf "$SYSTEM_SITE_PACKAGES"/pip* \
        "$SYSTEM_SITE_PACKAGES"/setuptools* \
        "$SYSTEM_SITE_PACKAGES"/wheel* \
    && rm -f /usr/local/bin/pip* /usr/bin/openssl

COPY --from=builder --chown=app:app /app/.venv /app/.venv

USER app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
