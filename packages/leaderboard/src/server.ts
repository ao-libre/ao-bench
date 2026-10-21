import http from 'node:http';
import { handleGetLeaderboard, handleGetRunLog, handlePostBug, handlePostRun } from './api.js';

const PORT = process.env['PORT'] ?? '3000';

const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>aobench Leaderboard</title>
  <style>
    body { font-family: sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f4f4f4; font-weight: 600; }
    tr:hover { background: #fafafa; }
    .rank { font-weight: bold; color: #666; }
    .empty { color: #999; font-style: italic; padding: 20px 0; }
    select { margin: 10px 0; padding: 6px 10px; font-size: 14px; }
  </style>
</head>
<body>
  <h1>🏆 aobench Leaderboard</h1>
  <label for="task-select">Task:</label>
  <select id="task-select">
    <option value="magia-xp">magia-xp</option>
    <option value="melee-xp">melee-xp</option>
    <option value="arco-xp">arco-xp</option>
  </select>
  <div id="table-container"><p class="empty">Loading...</p></div>
  <script>
    const select = document.getElementById('task-select');
    const container = document.getElementById('table-container');

    async function loadLeaderboard(task) {
      container.innerHTML = '<p class="empty">Loading...</p>';
      try {
        const res = await fetch('/api/leaderboard/' + encodeURIComponent(task));
        const rows = await res.json();
        if (!rows.length) {
          container.innerHTML = '<p class="empty">No runs recorded for this task yet.</p>';
          return;
        }
        let html = '<table><thead><tr><th>#</th><th>Model</th><th>Best XP/s</th><th>Best XP</th><th>Runs</th></tr></thead><tbody>';
        rows.forEach((row, i) => {
          html += '<tr>'
            + '<td class="rank">' + (i + 1) + '</td>'
            + '<td>' + escHtml(row.model) + '</td>'
            + '<td>' + Number(row.best_rate).toFixed(2) + '</td>'
            + '<td>' + row.best_xp + '</td>'
            + '<td>' + row.runs + '</td>'
            + '</tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;
      } catch (e) {
        container.innerHTML = '<p class="empty">Failed to load leaderboard.</p>';
      }
    }

    function escHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    select.addEventListener('change', () => loadLeaderboard(select.value));
    loadLeaderboard(select.value);
  </script>
</body>
</html>`;

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function extractBearer(req: http.IncomingMessage): string {
  const auth = req.headers['authorization'] ?? '';
  const match = /^Bearer (.+)$/i.exec(auth);
  return match?.[1] ?? '';
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

const server = http.createServer(async (req, res) => {
  const method = req.method ?? 'GET';
  const url = req.url ?? '/';
  const path = url.split('?')[0] ?? '/';

  try {
    // POST /api/runs
    if (method === 'POST' && path === '/api/runs') {
      const body = await readBody(req);
      const result = handlePostRun(body, extractBearer(req));
      sendJson(res, result.status, result.body);
      return;
    }

    // GET /api/leaderboard/:task
    const leaderboardMatch = /^\/api\/leaderboard\/([^/]+)$/.exec(path);
    if (method === 'GET' && leaderboardMatch) {
      const task = decodeURIComponent(leaderboardMatch[1] ?? '');
      const result = handleGetLeaderboard(task);
      sendJson(res, result.status, result.body);
      return;
    }

    // GET /api/runs/:runId/log
    const logMatch = /^\/api\/runs\/([^/]+)\/log$/.exec(path);
    if (method === 'GET' && logMatch) {
      const runId = decodeURIComponent(logMatch[1] ?? '');
      const result = handleGetRunLog(runId);
      sendJson(res, result.status, result.body);
      return;
    }

    // POST /api/bugs
    if (method === 'POST' && path === '/api/bugs') {
      const body = await readBody(req);
      const result = handlePostBug(body);
      sendJson(res, result.status, result.body);
      return;
    }

    // GET /health
    if (method === 'GET' && path === '/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    // GET / — HTML leaderboard page
    if (method === 'GET' && path === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(HTML_PAGE);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    sendJson(res, 400, { error: message });
  }
});

server.listen(parseInt(PORT, 10), () => {
  console.log(`[leaderboard] Listening on port ${PORT}`);
});

export { server };
