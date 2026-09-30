# ================================================================
# NEXUS-FLEET BACKEND FASTAPI ENGINE DOCKERFILE
# ================================================================
FROM python:3.13-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and source code
COPY pyproject.toml /app/
COPY app /app/app
COPY tests /app/tests

# Install dependencies
RUN pip install --no-cache-dir uvicorn fastapi pydantic websockets google-genai pytest pytest-asyncio

EXPOSE 8000

ENV HOST=0.0.0.0
ENV PORT=8000
ENV ENVIRONMENT=production

# Healthcheck
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
