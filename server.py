#!/usr/bin/env python3
"""Jeffrey OS Dashboard — Local HTTP Server
Serves dashboard + state.json API with background state regeneration.
Access from any device on local network: http://192.168.1.66:8080
"""
import http.server, json, os, subprocess, sys, socketserver, threading, time
from urllib.parse import urlparse

PORT = 8080
DIR = os.path.dirname(os.path.abspath(__file__))
STATE_FILE = os.path.join(DIR, 'state.json')
REGEN_INTERVAL = 30  # seconds between background regenerations

def regen_state_sync():
    """Run update-state.py (blocking)."""
    try:
        subprocess.run([sys.executable, os.path.join(DIR, 'update-state.py')],
                       capture_output=True, timeout=15)
    except Exception:
        pass

def background_regenerator():
    """Background thread: regenerate state.json every REGEN_INTERVAL seconds."""
    while True:
        regen_state_sync()
        time.sleep(REGEN_INTERVAL)

class DashboardHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def do_GET(self):
        clean_path = urlparse(self.path).path
        if clean_path in ('/api/state', '/state.json'):
            # Serve pre-generated state.json instantly
            self.path = '/state.json'
        elif clean_path in ('/', '/index.html'):
            self.path = '/dashboard.html'
        return super().do_GET()

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store')
        super().end_headers()

    def log_message(self, format, *args):
        pass  # Quiet logging

class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == '__main__':
    # Generate initial state before accepting requests
    print("⏳ Generating initial state...")
    regen_state_sync()
    print("✅ State ready.")

    # Start background regenerator
    t = threading.Thread(target=background_regenerator, daemon=True)
    t.start()

    with ThreadedHTTPServer(('0.0.0.0', PORT), DashboardHandler) as httpd:
        print(f"🖥️  Jeffrey OS Dashboard running on:")
        print(f"   Local:   http://localhost:{PORT}")
        print(f"   Network: http://192.168.1.66:{PORT}")
        print(f"   Auto-refresh: every {REGEN_INTERVAL}s")
        print(f"   Press Ctrl+C to stop")
        httpd.serve_forever()
