#!/bin/zsh

set -e

cd "$(dirname "$0")"

# Stop any existing Vite server on port 3000 so the local launcher is repeatable.
PIDS=$(lsof -ti tcp:3000 || true)
if [[ -n "$PIDS" ]]; then
  echo "$PIDS" | xargs kill -9
fi

npx vite --open
