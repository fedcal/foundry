# Detection probes

Run before Step 2 of `python-service`. Each block maps its output to a concrete decision —
do not average two conventions found at once; follow the newest file and say which you picked.

## Interpreter and packaging tool

```bash
python3 --version
cat pyproject.toml 2>/dev/null | sed -n '1,60p'
grep -n 'requires-python' pyproject.toml 2>/dev/null
ls uv.lock poetry.lock requirements*.txt Pipfile.lock 2>/dev/null
grep -n '\[tool\.uv\]\|\[tool\.poetry\]\|\[tool\.hatch\]' pyproject.toml 2>/dev/null
```

| Found | Decision |
|---|---|
| `uv.lock` present | use `uv add <pkg>` / `uv sync` for every dependency change |
| `poetry.lock` present | use `poetry add <pkg>` / `poetry install` |
| only `requirements*.txt`, no lockfile tool | use `pip-compile` if present, else state the gap as a `finding.v1` before adding dependencies by hand |
| nothing present, empty repo | pick one per the criteria in `python-engineer`'s packaging section and record the choice as a T1 fact via `memory_write` |

## Pydantic v1 vs v2 API surface

```bash
python3 -c "from pydantic import field_validator, ConfigDict; print('v2')" 2>&1 | tail -1
python3 -c "from pydantic_settings import BaseSettings; print('pydantic-settings v2')" 2>&1 | tail -1
python3 -c "from pydantic import BaseSettings; print('v1 BaseSettings (core)')" 2>&1 | tail -1
```

If the first probe succeeds, use v2 idioms everywhere in new code (`ConfigDict`,
`field_validator`, `model_config`, `.model_dump()`). If it fails, use v1 idioms (`class Config`,
`@validator`, `.dict()`) and do not mix the two styles in one module.

## SQLAlchemy style and async support

```bash
python3 -c "from sqlalchemy.orm import Mapped, mapped_column; print('2.0-style available')" 2>&1 | tail -1
python3 -c "from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine; print('async available')" 2>&1 | tail -1
grep -rln "declarative_base\|DeclarativeBase" . --include=*.py | head -5
```

If `Mapped`/`mapped_column` is available and no existing model uses the classic `Column(...)`
style, use the 2.0 typed-declarative style for new models. If existing models use `Column(...)`
directly, match that style in the same module rather than mixing both inside one file.

## Existing router shape to copy from

```bash
grep -rln "APIRouter(" . --include=*.py | xargs ls -t 2>/dev/null | head -3
grep -rn "response_model=" . --include=*.py | head -10
grep -rn "@app.exception_handler\|add_exception_handler" . --include=*.py
```

Copy the most recently modified router's shape (DTO naming, response-model usage, error
handling wiring) rather than inventing a new one.

## Alembic

```bash
ls alembic.ini 2>/dev/null
cat alembic/env.py 2>/dev/null | grep -n "run_async_migrations\|asyncio\|run_migrations_online"
```

If `alembic.ini` is absent, this is a new service — Step 4 of `python-service` establishes the
baseline. If present but `env.py` has no async wiring while the app uses `AsyncSession`, flag
the mismatch as a `finding.v1`: migrations run synchronously against an async-only engine
configuration are a common source of "works locally, fails in CI" failures.

## Test layout

```bash
find . -maxdepth 4 \( -name 'test_*.py' -o -name '*_test.py' \) | head -10
grep -n '\[tool.pytest.ini_options\]' pyproject.toml 2>/dev/null
grep -rln "pytest-asyncio\|anyio" . --include=*.toml --include=*.cfg --include=*.ini 2>/dev/null
```
