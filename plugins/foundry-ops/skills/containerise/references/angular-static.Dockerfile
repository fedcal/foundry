# syntax=docker/dockerfile:1
#
# Angular built to static assets, served by a non-root web server.
# Resolve every <PLACEHOLDER>:
#   docker buildx imagetools inspect node:<TAG>  --format '{{ .Manifest.Digest }}'
#   docker buildx imagetools inspect <SERVER-IMAGE>:<TAG> --format '{{ .Manifest.Digest }}'
#
# Before choosing this: if the target is a CDN or a static-hosting PaaS, you do
# not need a container at all. Ask cloud-architect. Level 0 beats level 2.

# ---------------------------------------------------------------- deps ----
FROM node:<TAG>@sha256:<DIGEST> AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --no-audit --no-fund

# --------------------------------------------------------------- build ----
FROM node:<TAG>@sha256:<DIGEST> AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Angular's production configuration enables optimisation and output hashing.
# Output hashing is what lets you cache assets immutably at the edge.
RUN npm run build -- --configuration production

# ----------------------------------------------------------------- dev ----
FROM node:<TAG>@sha256:<DIGEST> AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 4200
# --host 0.0.0.0 or the dev server is unreachable from outside the container.
# --poll only if your bind mount does not deliver inotify events (common on some hosts).
CMD ["npm", "start", "--", "--host", "0.0.0.0", "--port", "4200"]

# ------------------------------------------------------------- runtime ----
# Use a server image that already runs unprivileged and listens on a high port;
# the "unprivileged" variants of common web servers exist precisely for this.
FROM <SERVER-IMAGE>:<SERVER-TAG>@sha256:<SERVER-DIGEST> AS runtime

# Config first (changes rarely), assets last (change every build): correct layer
# ordering for cache hits.
COPY --chown=10001:10001 <SERVER-CONFIG-PATH> /etc/<SERVER>/conf.d/default.conf
COPY --from=build --chown=10001:10001 /app/dist/<PROJECT-NAME>/browser /usr/share/<SERVER>/html

USER 10001:10001
EXPOSE 8080

LABEL org.opencontainers.image.source="<REPO-URL>" \
      org.opencontainers.image.revision="<GIT-SHA>" \
      org.opencontainers.image.licenses="<SPDX-ID>"

# The server config must:
#   - listen on 8080 (not 80: that needs CAP_NET_BIND_SERVICE)
#   - write temp/pid files under a writable mounted path, so the container works
#     with readOnlyRootFilesystem: true
#   - serve index.html for unknown routes (SPA fallback) but NOT for /assets/*,
#     otherwise a missing asset returns 200 with HTML and the browser fails obscurely
#   - set long immutable cache headers for hashed files and no-cache for index.html
