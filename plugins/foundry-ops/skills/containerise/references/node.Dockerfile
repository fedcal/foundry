# syntax=docker/dockerfile:1
#
# Node service. Resolve every <PLACEHOLDER> before building:
#   DIGEST -> docker buildx imagetools inspect node:<TAG> --format '{{ .Manifest.Digest }}'
#   TAG    -> the Node major your repository declares (.nvmrc or package.json engines.node)
#
# Build:
#   docker build -t <IMAGE>:<TAG> .
# With a private registry token (never use ARG for secrets):
#   docker build --secret id=npmrc,src=$HOME/.npmrc -t <IMAGE>:<TAG> .

# ---------------------------------------------------------------- deps ----
FROM node:<TAG>@sha256:<DIGEST> AS deps
WORKDIR /app

# Manifests only. Copying source here would invalidate the install layer on
# every edit, which is the single most common cause of slow container builds.
COPY package.json package-lock.json ./

# Cache mount: the npm cache speeds up the build without entering a layer.
# sharing=locked prevents two concurrent builds corrupting it.
# Secret mount: credentials are never written into the image or `docker history`.
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false \
    npm ci --no-audit --no-fund

# --------------------------------------------------------------- build ----
FROM node:<TAG>@sha256:<DIGEST> AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Prune to production dependencies in the build stage, so the runtime stage
# copies an already-minimal tree instead of installing again.
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm prune --omit=dev

# ----------------------------------------------------------------- dev ----
# Target for docker compose. Never maintain a second Dockerfile for development:
# divergence between the dev image and the production image is how "works on my
# machine" is manufactured.
FROM node:<TAG>@sha256:<DIGEST> AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ------------------------------------------------------------- runtime ----
# Minimal base. Resolve the digest for the runtime variant you choose; a
# distroless-style base has no shell and no package manager, which is the point.
FROM <RUNTIME-BASE>:<RUNTIME-TAG>@sha256:<RUNTIME-DIGEST> AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    TMPDIR=/tmp

# Copy only what runs. Never COPY --from=build / /.
# --chown avoids a separate `RUN chown -R` layer that duplicates the whole tree.
COPY --from=build --chown=10001:10001 /app/node_modules ./node_modules
COPY --from=build --chown=10001:10001 /app/dist ./dist
COPY --from=build --chown=10001:10001 /app/package.json ./package.json

# NUMERIC uid:gid. `USER app` breaks Kubernetes runAsNonRoot: the kubelet cannot
# resolve names from inside the image, it only checks a numeric UID.
USER 10001:10001

# Ports below 1024 would need CAP_NET_BIND_SERVICE. Listen high and map instead.
EXPOSE 8080

# Traceability: a scanner report is useless if nobody can tell which repository
# and commit produced the image.
LABEL org.opencontainers.image.source="<REPO-URL>" \
      org.opencontainers.image.revision="<GIT-SHA>" \
      org.opencontainers.image.licenses="<SPDX-ID>"

# HEALTHCHECK deliberately omitted: the Kubernetes kubelet ignores it, and this
# base has no shell or curl to run one. Under docker compose, see compose.dev.yaml.

# EXEC FORM. Shell form ("CMD npm start") puts /bin/sh at PID 1, SIGTERM never
# reaches node, and every redeploy drops in-flight requests when the grace period
# expires. The application must handle SIGTERM: stop accepting, drain, exit 0.
ENTRYPOINT ["node", "dist/main.js"]
