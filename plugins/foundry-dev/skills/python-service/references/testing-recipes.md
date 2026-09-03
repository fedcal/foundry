# Testing recipes

## Async client fixture (`tests/conftest.py`)

```python
import pytest
from httpx import ASGITransport, AsyncClient

from src.<package_name>.main import app
from src.<package_name>.db import get_db_session


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()  # never leak an override into the next test


@pytest.fixture
def override_db_session(fake_session):
    app.dependency_overrides[get_db_session] = lambda: fake_session
```

## Slice test — happy path, validation failure, auth

```python
async def test_create_returns_201(client, override_db_session):
    resp = await client.post("/widgets", json={"name": "a"})
    assert resp.status_code == 201
    assert resp.json()["name"] == "a"


async def test_create_rejects_client_supplied_id(client, override_db_session):
    resp = await client.post("/widgets", json={"id": "attacker-chosen", "name": "a"})
    assert resp.status_code == 422  # schema has no "id" field to accept


async def test_create_requires_auth(client):
    resp = await client.post("/widgets", json={"name": "a"})
    assert resp.status_code == 401


async def test_validation_error_shape(client, override_db_session):
    resp = await client.post("/widgets", json={})
    assert resp.status_code == 422
    body = resp.json()
    assert "detail" in body  # confirm this matches the project's actual error contract
```

## Cleanup-runs-on-exception test — proves the `yield`-dependency finally block fires

```python
async def test_session_closed_even_when_handler_raises(client, monkeypatch):
    closed = {"value": False}

    async def fake_close():
        closed["value"] = True

    # patch the fake session's close to observe it, then trigger a handler exception
    ...
    assert closed["value"] is True
```

## Integration test against real Postgres (Testcontainers)

```python
import pytest
from testcontainers.postgres import PostgresContainer


@pytest.fixture(scope="session")
def postgres_container():
    with PostgresContainer("postgres") as pg:  # pin the major version to match production
        yield pg


@pytest.fixture(scope="session")
def migrated_database_url(postgres_container):
    url = postgres_container.get_connection_url().replace("psycopg2", "asyncpg")
    import subprocess
    subprocess.run(["alembic", "upgrade", "head"], env={"DATABASE_URL": url}, check=True)
    return url
```

Reuse the container for the whole session — starting one per test turns a fast suite into a
slow one. Never substitute SQLite for this: it accepts SQL Postgres rejects and enforces
different constraints and locking, so a green SQLite test is not evidence for a Postgres
service. SQLite is acceptable only for genuinely engine-agnostic unit tests of pure logic that
touch no SQL dialect feature.

## Statement-count check (N+1 smoke test)

```python
async def test_list_endpoint_does_not_scale_with_row_count(client, override_db_session, query_counter):
    await client.get("/widgets?size=50")
    assert query_counter.count <= 3  # fixed number of statements regardless of row count
```

If the count scales with the number of returned rows, the response mapping is doing an
implicit per-row lazy load — fix the relationship loading strategy (`selectin`/`joinedload`)
before shipping.
