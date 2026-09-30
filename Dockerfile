FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt-get/lists/*

# Install uv package manager
RUN pip install --no-cache-dir uv

# Copy application code
COPY backend /app/backend
COPY pyproject.toml README.md /app/

# Install python dependencies
RUN uv pip install --system -e .

EXPOSE 8000

ENV PORT=8000
ENV ENVIRONMENT=production

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
