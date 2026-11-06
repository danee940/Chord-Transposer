FROM python:3.15-slim

COPY --from=ghcr.io/astral-sh/uv:0.13.7 /uv /usr/local/bin/uv

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --locked --no-dev --no-cache

COPY src/app.py src/transpose.py src/seo.py src/gunicorn.conf.py ./
COPY src/templates ./templates
COPY src/static ./static

RUN useradd --create-home appuser
USER appuser

EXPOSE 8080

CMD ["gunicorn", "--config", "gunicorn.conf.py", "app:app"]
