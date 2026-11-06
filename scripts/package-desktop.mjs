// Builds release/Gaskin-desktop.zip: the single-file app, the Claude Desktop extension and three
// double-click launchers that serve the folder on http://127.0.0.1 (a secure origin, so installing
// as an app and saving to a folder work) and open the browser.
//
//   npm run build && (cd mcp-server && npm run bundle) && node scripts/package-desktop.mjs
//
// Contents (all at the top of the zip, inside a Gaskin/ folder):
//   Gaskin.html                    the app (dist/index.html)
//   gaskin.mcpb                    Claude Desktop extension (mcp-server/dist/gaskin.mcpb)
//   START-HERE.txt                 plain steps
//   Open Gaskin (Windows).bat      Python 3, else PowerShell, else Node, else opens Gaskin.html
//   Open Gaskin (Mac).command      Python 3, else Node, else opens Gaskin.html   (chmod +x)
//   Open Gaskin (Linux).sh         Python 3, else Node, else opens Gaskin.html   (chmod +x)
//   app/                           what the launchers need: serve.py, serve.js, serve.ps1, and the
//                                  installable-app files (sw.js, manifest.webmanifest, icons)
//
// Every server binds 127.0.0.1 only, picks a free port, serves only files in this folder (no
// directory listings, no paths outside it), and sends Gaskin.html for "/".
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outDir = join(root, 'release');
const stage = join(outDir, 'stage', 'Gaskin');
const zip = join(outDir, 'Gaskin-desktop.zip');

const need = (p, how) => {
  if (!existsSync(p)) {
    console.error(`Missing ${p}. ${how}`);
    process.exit(1);
  }
  return p;
};
const html = need(join(root, 'dist', 'index.html'), 'Run npm run build first.');
const mcpb = need(join(root, 'mcp-server', 'dist', 'gaskin.mcpb'), 'Run (cd mcp-server && npm run bundle) first.');

rmSync(join(outDir, 'stage'), { recursive: true, force: true });
mkdirSync(join(stage, 'app'), { recursive: true });
copyFileSync(html, join(stage, 'Gaskin.html'));
copyFileSync(mcpb, join(stage, 'gaskin.mcpb'));
for (const f of ['sw.js', 'manifest.webmanifest', 'icon.svg', 'icon-maskable.svg', 'favicon.svg']) {
  const p = join(root, 'dist', f);
  if (existsSync(p)) copyFileSync(p, join(stage, 'app', f));
}

// ---------------------------------------------------------------------------
// Servers. Each takes the folder to serve as its first argument.
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
};

// URL path -> file in the folder. "/" is the app; the installable-app files live in app/.
const ROUTES = {
  '/': 'Gaskin.html',
  '/index.html': 'Gaskin.html',
  '/Gaskin.html': 'Gaskin.html',
  '/sw.js': 'app/sw.js',
  '/manifest.webmanifest': 'app/manifest.webmanifest',
  '/icon.svg': 'app/icon.svg',
  '/icon-maskable.svg': 'app/icon-maskable.svg',
  '/favicon.svg': 'app/favicon.svg',
  '/gaskin.mcpb': 'gaskin.mcpb',
};

writeFileSync(
  join(stage, 'app', 'serve.py'),
  `# Gaskin local server (Python 3, standard library only). Serves this folder on 127.0.0.1 only.
# Usage: python3 serve.py <folder> [--no-open]
import http.server, json, os, socket, sys, threading, webbrowser

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..'))
ROUTES = ${JSON.stringify(ROUTES)}
MIME = ${JSON.stringify(MIME)}

class Handler(http.server.BaseHTTPRequestHandler):
    server_version = 'Gaskin'
    sys_version = ''
    def do_HEAD(self):
        self.send(head=True)
    def do_GET(self):
        self.send(head=False)
    def send(self, head):
        path = self.path.split('?', 1)[0].split('#', 1)[0]
        rel = ROUTES.get(path)
        if rel is None:
            self.send_error(404, 'Not found')
            return
        full = os.path.join(ROOT, rel)
        try:
            with open(full, 'rb') as f:
                body = f.read()
        except OSError:
            self.send_error(404, 'Not found')
            return
        ext = os.path.splitext(full)[1]
        self.send_response(200)
        self.send_header('Content-Type', MIME.get(ext, 'application/octet-stream'))
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        if ext == '.html':
            self.send_header('X-Frame-Options', 'DENY')
        self.end_headers()
        if not head:
            self.wfile.write(body)
    def log_message(self, *args):
        pass

def free_port():
    # Same port each time when it is free, so the browser keeps the same records and app install.
    for port in [17654, 17655, 17656, 17657, 0]:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            s.bind(('127.0.0.1', port))
            p = s.getsockname()[1]
            s.close()
            return p
        except OSError:
            s.close()
    raise SystemExit('No free port')

port = free_port()
httpd = http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler)
url = 'http://127.0.0.1:%d/' % port
print('Gaskin is running at ' + url)
print('Keep this window open while you use Gaskin. Close it to stop.')
sys.stdout.flush()
if '--no-open' not in sys.argv:
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    pass
`,
);

writeFileSync(
  join(stage, 'app', 'serve.js'),
  `// Gaskin local server (Node 18 or newer, no packages). Serves this folder on 127.0.0.1 only.
// Usage: node serve.js <folder> [--no-open]
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const ROUTES = ${JSON.stringify(ROUTES)};
const MIME = ${JSON.stringify(MIME)};
const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.writeHead(405).end();
  const rel = ROUTES[(req.url || '/').split('?')[0].split('#')[0]];
  if (!rel) return res.writeHead(404).end('Not found');
  fs.readFile(path.join(ROOT, rel), (err, body) => {
    if (err) return res.writeHead(404).end('Not found');
    const ext = path.extname(rel);
    const h = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': body.length, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Opener-Policy': 'same-origin' };
    if (ext === '.html') h['X-Frame-Options'] = 'DENY';
    res.writeHead(200, h);
    res.end(req.method === 'HEAD' ? undefined : body);
  });
});
const ports = [17654, 17655, 17656, 17657, 0];
const listen = (i) => {
  server.once('error', () => listen(i + 1));
  server.listen(ports[i], '127.0.0.1', () => {
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    console.log('Gaskin is running at ' + url);
    console.log('Keep this window open while you use Gaskin. Close it to stop.');
    if (process.argv.includes('--no-open')) return;
    const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref(); } catch {}
  });
};
listen(0);
`,
);

writeFileSync(
  join(stage, 'app', 'serve.ps1'),
  `# Gaskin local server for Windows PowerShell (no Python or Node needed). 127.0.0.1 only.
param([string]$Root = (Join-Path $PSScriptRoot '..'))
$Root = (Resolve-Path $Root).Path
$routes = @{ ${Object.entries(ROUTES).map(([k, v]) => `'${k}' = '${v.replace(/\//g, '\\')}'`).join('; ')} }
$mime = @{ ${Object.entries(MIME).map(([k, v]) => `'${k}' = '${v}'`).join('; ')} }
$listener = $null
foreach ($port in 17654, 17655, 17656, 17657, 17658) {
  try {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://127.0.0.1:$port/")
    $l.Start()
    $listener = $l
    break
  } catch { }
}
if (-not $listener) { Write-Host 'No free port.'; exit 1 }
$url = $listener.Prefixes | Select-Object -First 1
Write-Host "Gaskin is running at $url"
Write-Host 'Keep this window open while you use Gaskin. Close it to stop.'
Start-Process $url
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $path = $ctx.Request.Url.AbsolutePath
  $res = $ctx.Response
  try {
    if ($routes.ContainsKey($path)) {
      $file = Join-Path $Root $routes[$path]
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ext = [System.IO.Path]::GetExtension($file)
      $res.ContentType = $(if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' })
      $res.Headers.Add('Cache-Control', 'no-cache')
      $res.Headers.Add('X-Content-Type-Options', 'nosniff')
      $res.ContentLength64 = $bytes.Length
      if ($ctx.Request.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
    } else { $res.StatusCode = 404 }
  } catch { $res.StatusCode = 404 }
  $res.Close()
}
`,
);

// ---------------------------------------------------------------------------
// Launchers
// ---------------------------------------------------------------------------

const unix = (os) => `#!/bin/sh
# Open Gaskin (${os}): serves this folder on http://127.0.0.1 and opens your browser.
# Uses Python 3, else Node. With neither, opens Gaskin.html directly, which still works.
cd "$(dirname "$0")" || exit 1
HERE="$(pwd)"
if command -v python3 >/dev/null 2>&1 && python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 7) else 1)' 2>/dev/null; then
  exec python3 "$HERE/app/serve.py" "$HERE" "$@"
fi
if command -v node >/dev/null 2>&1; then
  exec node "$HERE/app/serve.js" "$HERE" "$@"
fi
echo "Python 3 and Node were not found, so Gaskin opens straight from the file."
echo "It works, but cannot install as an app or save into a folder of your choice."
${os === 'Mac' ? 'open "$HERE/Gaskin.html"' : 'xdg-open "$HERE/Gaskin.html" 2>/dev/null || sensible-browser "$HERE/Gaskin.html"'}
`;

writeFileSync(join(stage, 'Open Gaskin (Mac).command'), unix('Mac'));
writeFileSync(join(stage, 'Open Gaskin (Linux).sh'), unix('Linux'));
chmodSync(join(stage, 'Open Gaskin (Mac).command'), 0o755);
chmodSync(join(stage, 'Open Gaskin (Linux).sh'), 0o755);

writeFileSync(
  join(stage, 'Open Gaskin (Windows).bat'),
  [
    '@echo off',
    'rem Open Gaskin (Windows): serves this folder on http://127.0.0.1 and opens your browser.',
    'rem Uses Python 3, else PowerShell, else Node. With none of them, opens Gaskin.html directly.',
    'title Gaskin',
    'cd /d "%~dp0"',
    'set "HERE=%~dp0."',
    '',
    'where py >nul 2>nul',
    'if not errorlevel 1 (',
    '  py -3 -c "import sys" >nul 2>nul',
    '  if not errorlevel 1 goto python_launcher',
    ')',
    'where python >nul 2>nul',
    'if not errorlevel 1 (',
    '  python -c "import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)" >nul 2>nul',
    '  if not errorlevel 1 goto python_plain',
    ')',
    'where powershell >nul 2>nul',
    'if not errorlevel 1 goto powershell',
    'where node >nul 2>nul',
    'if not errorlevel 1 goto node',
    'echo Python, PowerShell and Node were not found, so Gaskin opens straight from the file.',
    'start "" "%HERE%\\Gaskin.html"',
    'goto :eof',
    '',
    ':python_launcher',
    'py -3 "%HERE%\\app\\serve.py" "%HERE%"',
    'goto :eof',
    ':python_plain',
    'python "%HERE%\\app\\serve.py" "%HERE%"',
    'goto :eof',
    ':powershell',
    'powershell -NoProfile -ExecutionPolicy Bypass -File "%HERE%\\app\\serve.ps1" -Root "%HERE%"',
    'goto :eof',
    ':node',
    'node "%HERE%\\app\\serve.js" "%HERE%"',
    'goto :eof',
    '',
  ].join('\r\n'),
);

writeFileSync(
  join(stage, 'START-HERE.txt'),
  [
    'GASKIN ON YOUR COMPUTER',
    '',
    'Gaskin runs on this computer with no internet and no installation. Your records stay here.',
    '',
    'To start',
    '1. Unzip this folder somewhere you can find it, for example Documents or a USB stick.',
    '2. Double-click the launcher for your computer:',
    '     Windows:  Open Gaskin (Windows).bat',
    '     Mac:      Open Gaskin (Mac).command   (the first time, right-click it and choose Open)',
    '     Linux:    Open Gaskin (Linux).sh',
    '3. Your browser opens Gaskin. Keep the small black window open while you work.',
    '   Close it when you finish.',
    '',
    'The launcher starts a small web server that only this computer can reach (address 127.0.0.1).',
    'It needs Python 3, PowerShell (built into Windows) or Node. If none is there, it opens',
    'Gaskin.html directly. That also works, but Gaskin cannot then install as an app or save into',
    'a folder you choose: records stay in the browser and Gaskin downloads backup files instead.',
    'You can always double-click Gaskin.html yourself.',
    '',
    'Where your records are kept',
    '- In Chrome or Edge, Gaskin can save into a folder you choose, for example GASKIN-DATA on a',
    '  USB stick. It writes gaskin-data.json after every change and keeps ten backups.',
    '- In other browsers, records stay in the browser on this computer, and Gaskin downloads a',
    '  backup file every few days. Settings > Storage and backup has Export and Import.',
    '- Use the same browser and the same launcher each time: the browser keeps records per address.',
    '',
    'Install as an app (optional)',
    'In Chrome or Edge, press the install icon at the right of the address bar. Gaskin then opens',
    'in its own window. Start the launcher first each time.',
    '',
    'Connect your AI assistant (optional)',
    'gaskin.mcpb is an extension for Claude Desktop. Double-click it, or drag it onto Claude Desktop,',
    'and choose the folder that holds gaskin-data.json. Names are removed before anything reaches',
    'the assistant unless you switch that off.',
    '',
    'Safety',
    'Gaskin supports health workers. It is not a doctor. In an emergency, call your local',
    'emergency number and go to the nearest hospital.',
    '',
    'More help: docs/run-anywhere.md in the Gaskin source code (AGPL-3.0).',
    '',
  ].join('\r\n'),
);

// ---------------------------------------------------------------------------
// Zip (Info-ZIP keeps the executable bits on the .sh and .command files)
// ---------------------------------------------------------------------------

rmSync(zip, { force: true });
execFileSync('zip', ['-r', '-X', '-q', zip, 'Gaskin'], { cwd: join(outDir, 'stage') });
rmSync(join(outDir, 'stage'), { recursive: true, force: true });
const list = execFileSync('unzip', ['-Z', '-l', zip], { encoding: 'utf8' });
console.log(list.trim());
console.log(`\n${zip} ${(statSync(zip).size / 1024 / 1024).toFixed(2)} MB`);
