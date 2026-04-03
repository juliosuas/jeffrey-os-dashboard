#!/bin/bash
# start.sh — Start Jeffrey OS Dashboard server
# Usage: ./start.sh [port]
#
# Starts the Node.js server that serves the dashboard and auto-updates state.json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${1:-8080}"

echo "═══════════════════════════════════════════════════════════"
echo "  JEFFREY OS DASHBOARD — Starting up"
echo "  Dashboard: http://localhost:${PORT}"
echo "  LAN:       http://$(ipconfig getifaddr en0 2>/dev/null || echo '192.168.x.x'):${PORT}"
echo "═══════════════════════════════════════════════════════════"

# Kill any existing server on the port
lsof -ti:${PORT} | xargs kill -9 2>/dev/null && echo "  Killed existing process on :${PORT}"

cd "$SCRIPT_DIR"

# Update state.json before starting server
echo "  Generating initial state.json..."
python3 update-state.py 2>&1 | head -5

# Start the Node server
echo "  Starting server on :${PORT}..."
exec node server.js
