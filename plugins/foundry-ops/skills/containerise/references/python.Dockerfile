# syntax=docker/dockerfile:1
#
# Python service. Resolve every <PLACEHOLDER>:
#   docker buildx imagetools inspect python:<TAG> --format '{{ .Manifest.Digest }}'
# TAG: read the required version from pyproject.toml (requires-python), not from habit.

# --------------------------------------------------------------- build ----
FROM python:<TAG>@sha256:<DIGEST> AS build
WORKDIR /app

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_COMPILE=0 \
    PYTHONDONTWRITEBYTECODE=1

# Build a virtualenv that the runtime stage copies wholesale. This is the
# cleanest way to leave the compiler and headers behind.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Build dependencies for packages with C extensions. Single RUN, index cleaned in
# the same layer - a later `rm` would not shrink anything.
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential <EXTRA-BUILD-DEPS> \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
# --require-hashes refuses to install anything not pinned by hash in the file.
# Generate it with pip-compile --generate-hashes (or your resolver's equivalent).
# This is what makes the install reproducible rather than merely repeatable.
RUN --mount=type=cache,target=/root/.cache/pip,sharing=locked \
    pip install --require-hashes -r requirements.txt

COPY . .

# ----------------------------------------------------------------- dev ----
FROM build AS dev
ENV PYTHONUNBUFFERED=1
RUN --mount=type=cache,target=/root/.cache/pip,sharing=locked \
    pip install -r requirements-dev.txt
EXPOSE 8000
CMD ["python", "-m", "<DEV-SERVER-MODULE>", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ------------------------------------------------------------- runtime ----
FROM python:<TAG>-slim@sha256:<SLIM-DIGEST> AS runtime
WORKDIR /app

# PYTHONUNBUFFERED: without it, stdout is block-buffered when not a TTY and your
# logs disappear when the process is killed - including the crash you need to read.
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TMPDIR=/tmp

# Runtime-only shared libraries, if any. Keep this list minimal and justified.
RUN apt-get update \
 && apt-get install -y --no-install-recommends <RUNTIME-LIBS> \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 10001 app \
 && useradd  --system --uid 10001 --gid 10001 --no-create-home app

COPY --from=build --chown=10001:10001 /opt/venv /opt/venv
COPY --from=build --chown=10001:10001 /app/<PACKAGE-DIR> ./<PACKAGE-DIR>

USER 10001:10001
EXPOSE 8000

LABEL org.opencontainers.image.source="<REPO-URL>" \
      org.opencontainers.image.revision="<GIT-SHA>" \
      org.opencontainers.image.licenses="<SPDX-ID>"

# Exec form, and the server must be configured to handle SIGTERM by finishing
# in-flight requests before exiting. Check your ASGI/WSGI server's graceful
# timeout setting and keep it below terminationGracePeriodSeconds.
ENTRYPOINT ["<SERVER-BINARY>", "<APP-MODULE>", "--host", "0.0.0.0", "--port", "8000"]
