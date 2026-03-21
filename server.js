const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const DIR = path.join(process.env.HOME, 'jeffrey/workspace/projects/jeffrey-os-dashboard');
const PORT = 8080;

const MIME = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};

// Regenerate state every 30s in background
function regenState() {
  try { execSync('python3 update-state.py', {cwd: DIR, timeout: 15000, stdio: 'ignore'}); } catch(e) {}
}
regenState();
setInterval(regenState, 30000);

http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/api/state' || urlPath === '/state.json') urlPath = '/state.json';
  else if (urlPath === '/' || urlPath === '/index.html') urlPath = '/dashboard.html';
  
  const filePath = path.join(DIR, urlPath);
  const ext = path.extname(filePath);
  
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'text/plain',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store'
    });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Dashboard running on http://0.0.0.0:${PORT}`);
});
