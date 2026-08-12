FROM node:22-alpine
RUN apk add --no-cache poppler-utils

WORKDIR /app

# Copy manifests first for layer caching.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321

# Image metadata — surfaced in GHCR / Coolify.
# NOTE: runs as root (node:22-alpine default) because start.sh rebuilds the
# static site at container start (writes dist/ + clears .astro) and reads the
# content/media volumes mounted at runtime — both need root on those mounts.
LABEL org.opencontainers.image.title="1ed.ge"
LABEL org.opencontainers.image.description="Public trading journal — everything public, nothing hidden."
LABEL org.opencontainers.image.source="https://github.com/bhaveshdhaka/1ed-ge"
LABEL org.opencontainers.image.licenses=""

CMD ["sh", "scripts/start.sh"]