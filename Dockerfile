# ================================================================
# STAGE 1: BACKEND CONTAINER (FastAPI / Pytest Core)
# ================================================================
FROM python:3.13-slim AS backend

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy backend files
COPY backend /app/backend
COPY pyproject.toml /app/

# Install python dependencies via pip/uv
RUN pip install --no-cache-dir uvicorn fastapi pytest websockets pydantic

EXPOSE 8000

ENV HOST=0.0.0.0
ENV PORT=8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# ================================================================
# STAGE 2: FRONTEND BUILDER (Vite / React / Three.js)
# ================================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root workspace configs
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY artifacts /app/artifacts
COPY lib /app/lib

# Install node dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Build frontend asset bundle
ENV PORT=5173
ENV BASE_PATH=/
RUN pnpm --filter @workspace/nexus-fleet build

# ================================================================
# STAGE 3: FRONTEND NGINX RUNNER
# ================================================================
FROM nginx:alpine AS frontend

COPY --from=frontend-builder /app/artifacts/nexus-fleet/dist/public /usr/share/nginx/html

# Custom Nginx SPA Routing config
RUN echo 'server { \
    listen 5173; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
    } \
    location /api/ { \
        proxy_pass http://backend:8000/api/; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
    } \
    location /ws/ { \
        proxy_pass http://backend:8000/ws/; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]
