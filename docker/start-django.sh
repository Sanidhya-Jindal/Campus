#!/usr/bin/env bash
# Ensure the DatabaseCache table exists (idempotent), then run gunicorn.
# createcachetable is a no-op if the table is already there, so it is safe to
# run on every boot and means a fresh database needs no manual setup step.
set -e
cd /app/Backend
python manage.py createcachetable || true
exec gunicorn CampusSentinal.wsgi:application \
    --bind 127.0.0.1:8000 --workers 2 --threads 4 --timeout 180
