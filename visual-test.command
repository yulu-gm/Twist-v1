#!/bin/zsh

set -e

cd "$(dirname "$0")"

DEV_PORT="${VITE_PORT:-5173}"
PIDS=$(lsof -ti tcp:"$DEV_PORT" || true)
if [[ -n "$PIDS" ]]; then
  echo "$PIDS" | xargs kill -9
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[launcher] Node.js was not found in PATH."
  echo "[launcher] Install Node.js and try again."
  exit 1
fi

node scripts/launch-dev.mjs visual
