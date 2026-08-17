#!/usr/bin/env bash
#
# Boot the Django backend for E2E: a FRESH, disposable SQLite database seeded
# with the `demo` tenant (login demo/demo, 40 known products). It never touches
# a real database — DATABASE_URL is forced to a local sqlite file that is
# recreated on every run, so tests start from a known state.
#
# The backend repo is assumed to be a sibling (../alrahmah); override BACKEND_DIR.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="${BACKEND_DIR:-$HERE/../../alrahmah}"
cd "$BACKEND_DIR"

# Prefer the backend's own virtualenv; fall back to system python3.
PY="python3"
[ -x ".venv/bin/python" ] && PY=".venv/bin/python"

DB_FILE="$HERE/.e2e-db.sqlite3"
export DATABASE_URL="sqlite:///$DB_FILE"
export REDIS_URL=""
export SECRET_KEY="${SECRET_KEY:-e2e-test-secret}"
export DEBUG="1"
export ALLOWED_HOSTS="*"

rm -f "$DB_FILE" 2>/dev/null || true
"$PY" manage.py migrate --noinput
"$PY" manage.py seed_demo --reset --seed 1 --customers 40 --debts 60 --sales 120

echo "E2E backend ready on http://127.0.0.1:8000  (login demo/demo)"
exec "$PY" manage.py runserver 127.0.0.1:8000 --noreload
