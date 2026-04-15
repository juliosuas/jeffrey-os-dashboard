#!/bin/bash
# install-autostart.sh — Instala el dashboard como servicio permanente en macOS
# Ejecuta UNA VEZ: chmod +x install-autostart.sh && ./install-autostart.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST="$HOME/Library/LaunchAgents/com.jeffrey.dashboard.plist"

echo "═══════════════════════════════════════════════════════"
echo "  JEFFREY OS DASHBOARD — Instalando autostart"
echo "═══════════════════════════════════════════════════════"

# Crear el plist
cat > "$PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.jeffrey.dashboard</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>${SCRIPT_DIR}/server.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${SCRIPT_DIR}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/jeffrey-dashboard.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/jeffrey-dashboard-error.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/Users/magi/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>HOME</key>
    <string>/Users/magi</string>
  </dict>
</dict>
</plist>
EOF

echo "  ✓ Plist creado en $PLIST"

# Descargar si ya existía
launchctl unload "$PLIST" 2>/dev/null

# Cargar el servicio
launchctl load "$PLIST"
echo "  ✓ Servicio cargado en launchd"

# Esperar que arranque
sleep 2

# Verificar
if lsof -i:8080 | grep -q LISTEN; then
  echo "  ✓ Servidor corriendo en puerto 8080"
  echo ""
  echo "  DASHBOARD: http://localhost:8080"
  echo ""
  # Abrir Chrome
  open -a "Google Chrome" "http://localhost:8080"
else
  # Intentar con la ruta de homebrew node
  PLIST_TMP="$HOME/Library/LaunchAgents/com.jeffrey.dashboard.plist"
  sed -i '' 's|/usr/local/bin/node|/Users/magi/homebrew/bin/node|g' "$PLIST_TMP" 2>/dev/null || true
  launchctl unload "$PLIST" 2>/dev/null
  launchctl load "$PLIST"
  sleep 2
  if lsof -i:8080 | grep -q LISTEN; then
    echo "  ✓ Servidor corriendo (homebrew node)"
    open -a "Google Chrome" "http://localhost:8080"
  else
    echo "  ⚠ El servidor no arrancó automáticamente."
    echo "    Iniciando directamente..."
    cd "$SCRIPT_DIR" && node server.js &
    sleep 2
    open -a "Google Chrome" "http://localhost:8080"
  fi
fi

echo ""
echo "  Desde ahora arranca automáticamente en cada login."
echo "═══════════════════════════════════════════════════════"
