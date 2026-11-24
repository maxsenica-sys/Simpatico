#!/usr/bin/env bash
# Deploy without a remote builder or network access inside Docker: build the app here,
# then ship a runtime-only image (used from the Claude cloud environment, whose proxy
# Fly's Depot builder rejects). Elsewhere, plain `fly deploy --ha=false` works.
set -euo pipefail
FLY=${FLY:-flyctl}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
STAGE=$(mktemp -d)
cd "$ROOT"
rm -rf .next && NEXT_TELEMETRY_DISABLED=1 npx next build
cp -r .next public package.json package-lock.json next.config.mjs server.ts server shared scripts fly.toml "$STAGE/"
rm -rf "$STAGE/.next/cache"
(cd "$STAGE" && npm ci --omit=dev --no-audit --no-fund)
cat > "$STAGE/Dockerfile" <<'DOCKER'
FROM mirror.gcr.io/library/node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 NEXT_TELEMETRY_DISABLED=1
COPY . .
EXPOSE 8080
CMD ["node_modules/.bin/tsx", "server.ts"]
DOCKER
# Only the running servers; the parked ones (iad lax gru jnb sin nrt) stay stopped. To turn them on:
# DEPLOY_REGIONS=fra,syd,iad,lax,gru,jnb,sin,nrt, then fly machine uncordon + start (docs/launch-steps.md).
(cd "$STAGE" && "$FLY" deploy --local-only --ha=false --yes --regions "${DEPLOY_REGIONS:-fra,syd}")
rm -rf "$STAGE"
