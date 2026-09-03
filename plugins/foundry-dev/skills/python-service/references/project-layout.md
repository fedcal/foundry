# Project layout template

`src`-layout skeleton for a new FastAPI service. Directory names in `<angle brackets>` are
placeholders — substitute the real service and package name.

```
<service-name>/
├── pyproject.toml
├── alembic.ini
├── Dockerfile
├── .env.example
├── alembic/
│   ├── env.py
│   └── versions/
├── src/
│   └── <package_name>/
│       ├── __init__.py
│       ├── main.py              # FastAPI() instance, lifespan, router registration
│       ├── settings.py          # BaseSettings, one object, validated at import time
│       ├── db.py                # engine, async_sessionmaker, get_db_session dependency
│       ├── exceptions.py        # domain exception hierarchy + exception_handler wiring
│       ├── api/
│       │   ├── __init__.py
│       │   ├── deps.py          # shared Depends() functions (repository, service, current_user)
│       │   └── routes_<slice>.py
│       ├── models/
│       │   └── <slice>.py       # SQLAlchemy declarative models
│       ├── schemas/
│       │   └── <slice>.py       # Pydantic request/response models
│       └── services/
│           └── <slice>.py       # business logic, owns the transaction boundary
└── tests/
    ├── conftest.py              # app fixture, dependency_overrides, async client fixture
    ├── unit/
    └── integration/
```

## `pyproject.toml` skeleton

Dependency **names** only — no version numbers. Resolve and pin the actual current versions
with the project's packaging tool (`uv add <pkg>`, `poetry add <pkg>`); never copy a number
from this file or from memory.

```toml
[project]
name = "<service-name>"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi",
    "uvicorn[standard]",
    "pydantic",
    "pydantic-settings",
    "sqlalchemy",
    "asyncpg",
    "alembic",
]

[project.optional-dependencies]
dev = [
    "pytest",
    "pytest-asyncio",
    "httpx",
    "mypy",
    "ruff",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"

[tool.mypy]
strict = true
packages = ["src"]
```

## `settings.py` skeleton

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None)  # never load .env on the prod code path

    database_url: str
    environment: str = "development"


settings = Settings()  # fails the process at import time on a missing/invalid value
```

## `main.py` skeleton — `lifespan` and two health endpoints

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .db import engine, get_db_session


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(lifespan=lifespan)


@app.get("/healthz")
async def liveness() -> dict[str, str]:
    return {"status": "ok"}  # never queries the database


@app.get("/readyz")
async def readiness(session=Depends(get_db_session)) -> dict[str, str]:
    await session.execute(text("SELECT 1"))
    return {"status": "ready"}
```

## Dockerfile skeleton — multi-stage, non-root

```dockerfile
FROM python:3-slim AS build
WORKDIR /app
COPY pyproject.toml ./
RUN pip install --no-cache-dir .

FROM python:3-slim AS runtime
RUN useradd --create-home appuser
WORKDIR /app
COPY --from=build /usr/local/lib/python3*/site-packages /usr/local/lib/python3*/site-packages
COPY src ./src
USER appuser
CMD ["uvicorn", "src.<package_name>.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Pin the base image tag to a verified digest before shipping — `python:3-slim` above is a
placeholder, not a production pin.
