# Campus — one image, four services behind nginx on port 8080.
#
#   nginx :8080  ──┬─ /                      -> Next.js  :3000
#                  ├─ /api /users /admin     -> Django   :8000  (gunicorn)
#                  ├─ /identify-and-search/  -> face     :8001  (uvicorn)
#                  └─ /chat                  -> agent    :8090  (uvicorn)
#
# Single origin means the browser only ever talks to one host, so there is no
# CORS to configure and NEXT_PUBLIC_*_BASE can stay empty (relative URLs).

# ---------------------------------------------------------------- frontend ---
FROM node:20-slim AS frontend
WORKDIR /build

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# Empty bases => the app fetches same-origin paths (/api/..., /chat, ...).
ENV NEXT_PUBLIC_API_BASE="" \
    NEXT_PUBLIC_AGENT_BASE="" \
    NEXT_PUBLIC_FACE_BASE="" \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ----------------------------------------------------------------- runtime ---
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    TORCH_HOME=/opt/torch

# libpq for psycopg2, libgl/glib for pillow+torchvision, nginx + supervisor to
# run everything, node to serve the Next.js standalone output.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 libgomp1 libglib2.0-0 libgl1 \
        nginx supervisor curl ca-certificates gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update && apt-get install -y --no-install-recommends nodejs \
    && apt-get purge -y gnupg && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# PyTorch first, from the CPU index. The default PyPI wheel drags in ~2.5GB of
# CUDA libraries that are dead weight on Container Apps' CPU nodes.
RUN pip install --no-cache-dir \
        --index-url https://download.pytorch.org/whl/cpu \
        torch==2.8.0 torchvision==0.23.0

# psycopg2 (source) needs a compiler; drop it again in the same layer so the
# toolchain never reaches the final image.
COPY Backend/requirements.txt /tmp/backend-requirements.txt
COPY AI/requirements.txt /tmp/ai-requirements.txt
RUN grep -viE '^(torch|torchvision)==' /tmp/ai-requirements.txt > /tmp/ai-notorch.txt \
    && apt-get update && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && pip install --no-cache-dir -r /tmp/backend-requirements.txt \
    && pip install --no-cache-dir -r /tmp/ai-notorch.txt \
    && apt-get purge -y build-essential libpq-dev \
    && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

COPY Backend/ /app/Backend/
COPY AI/ /app/AI/
COPY docker/ /app/docker/

# Next.js standalone: server.js + the traced node_modules, plus the assets it
# does not inline itself.
COPY --from=frontend /build/.next/standalone/ /app/frontend/
COPY --from=frontend /build/.next/static/      /app/frontend/.next/static/
COPY --from=frontend /build/public/            /app/frontend/public/

# Bake the vggface2 weights (~107MB) so a cold start doesn't download them.
RUN python -c "from facenet_pytorch import InceptionResnetV1; InceptionResnetV1(pretrained='vggface2').eval()"

# collectstatic needs importable settings but no database.
RUN cd /app/Backend && SECRET_KEY=build-only DEBUG=False \
    python manage.py collectstatic --noinput

ENV DJANGO_SETTINGS_MODULE=CampusSentinal.settings \
    API_BASE_URL=http://127.0.0.1:8000 \
    DRF_SEARCH_URL=http://127.0.0.1:8000/api/search/face/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8080/ >/dev/null || exit 1

CMD ["supervisord", "-c", "/app/docker/supervisord.conf"]
