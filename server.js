const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const DIR = path.join(process.env.HOME, 'jeffrey/workspace/projects/jeffrey-os-dashboard');
const PORT = 8080;

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml'
};

// Regenerate state every 15s
let stateGenerating = false;
function regenState() {
  if (stateGenerating) return;
  stateGenerating = true;
  try {
    execSync('python3 update-state.py', { cwd: DIR, timeout: 12000, stdio: 'ignore' });
  } catch (e) {
    console.error(`[${new Date().toISOString()}] State generation failed:`, e.message);
  } finally {
    stateGenerating = false;
  }
}
regenState();
setInterval(regenState, 15000);

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];

  // /api/health endpoint
  if (urlPath === '/api/health') {
    const stateFile = path.join(DIR, 'state.json');
    let stateAge = -1;
    try {
      const stat = fs.statSync(stateFile);
      stateAge = Math.round((Date.now() - stat.mtimeMs) / 1000);
    } catch (e) { /* no state file yet */ }
    const health = {
      status: stateAge >= 0 && stateAge < 60 ? 'healthy' : 'degraded',
      stateAgeSeconds: stateAge,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(health));
    return;
  }

  // Route mapping
  if (urlPath === '/api/state' || urlPath === '/state.json') urlPath = '/state.json';
  else if (urlPath === '/' || urlPath === '/dashboard.html') urlPath = '/index.html';

  // Prevent path traversal
  const filePath = path.join(DIR, path.normalize(urlPath));
  if (!filePath.startsWith(DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'text/plain',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store'
    });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Jeffrey OS Dashboard v6.0 running on http://0.0.0.0:${PORT}`);
  console.log(`State refresh: 15s | Health: http://0.0.0.0:${PORT}/api/health`);
});
