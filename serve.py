import http.server, json, subprocess, os, sys

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/api/state'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            r = subprocess.run([sys.executable, 'api/state'], capture_output=True, text=True, timeout=15)
            self.wfile.write(r.stdout.encode())
        else:
            super().do_GET()

    def log_message(self, *a): pass

os.chdir(os.path.dirname(os.path.abspath(__file__)))
http.server.HTTPServer(('', 8090), Handler).serve_forever()
