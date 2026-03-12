#!/usr/bin/env bash
# VibeScholar — One-command production deploy
# Usage: bash scripts/deploy_prod.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${VIBECR_PORT:-8007}"
HOST="${VIBECR_HOST:-127.0.0.1}"

echo "═══ VibeScholar Production Deploy ═══"

# 1. Kill any existing server on the port
if lsof -i :"$PORT" -t >/dev/null 2>&1; then
  echo "→ Stopping existing process on port $PORT..."
  kill $(lsof -i :"$PORT" -t) 2>/dev/null || true
  sleep 1
fi

# 2. Build frontend
echo "→ Building frontend..."
cd "$ROOT/frontend"
npm install --silent 2>/dev/null
npm run build

# 3. Start backend (serves built frontend)
echo "→ Starting production server on $HOST:$PORT..."
cd "$ROOT"
exec python3 -m uvicorn backend.app.main:app \
  --host "$HOST" --port "$PORT" \
  --log-level info
