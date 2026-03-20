#!/usr/bin/env python3
"""Jeffrey OS Dashboard — Local HTTP Server
Serves dashboard + state.json API
Access from any device on local network: http://192.168.1.66:8080
"""
import http.server, json, os, subprocess, sys, socketserver, threading, time
from urllib.parse import urlparse

PORT = 8080
DIR = os.path.dirname(os.path.abspath(__file__))

# Thread-safe state regeneration with simple caching
_state_lock = threading.Lock()
_last_regen = 0
_REGEN_COOLDOWN = 5  # seconds — don't re-run update-state.py more often than this

def regen_state():
    """Run update-state.py if cooldown has passed."""
    global _last_regen
    now = time.time()
    with _state_lock:
        if now - _last_regen < _REGEN_COOLDOWN:
            return  # Use cached state.json
        _last_regen = now
    try:
        subprocess.run([sys.executable, os.path.join(DIR, 'update-state.py')],
                     capture_output=True, timeout=10)
    except Exception:
        pass  # Serve stale state.json on failure

class DashboardHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)
    
    def do_GET(self):
        # Strip query string for routing
        clean_path = urlparse(self.path).path
        if clean_path in ('/api/state', '/state.json'):
            regen_state()
            self.path = '/state.json'
        elif clean_path in ('/', '/index.html'):
            self.path = '/dashboard.html'
        return super().do_GET()
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    
    def log_message(self, format, *args):
        pass  # Quiet logging

class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == '__main__':
    with ThreadedHTTPServer(('0.0.0.0', PORT), DashboardHandler) as httpd:
        print(f"🖥️  Jeffrey OS Dashboard running on:")
        print(f"   Local:   http://localhost:{PORT}")
        print(f"   Network: http://192.168.1.66:{PORT}")
        print(f"   Press Ctrl+C to stop")
        httpd.serve_forever()
