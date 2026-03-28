import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

function generateId(): string {
  return crypto.randomUUID()
}

function calculateEloChange(playerRating: number, opponentRating: number, actualScore: number): number {
  const K = 32
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400))
  return Math.round(K * (actualScore - expectedScore))
}

function layout(content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🏓 Lindy Pong</title>
  <style>
    :root, [data-theme="light"] {
      --bg: #f5f5f5;
      --surface: #ffffff;
      --surface2: #f0f0f0;
      --border: #e0e0e0;
      --text: #1a1a1a;
      --muted: #666;
      --accent: #2563eb;
      --accent-hover: #1d4ed8;
      --green: #16a34a;
      --red: #dc2626;
      --gold: #d97706;
      --silver: #64748b;
      --bronze: #b45309;
      --radius: 12px;
      --shadow: rgba(0,0,0,0.06);
    }
    [data-theme="dark"] {
      --bg: #0f0f0f;
      --surface: #1a1a1a;
      --surface2: #242424;
      --border: #2e2e2e;
      --text: #e8e8e8;
      --muted: #888;
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --green: #22c55e;
      --red: #ef4444;
      --gold: #f59e0b;
      --silver: #94a3b8;
      --bronze: #d97706;
      --shadow: rgba(0,0,0,0.3);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg); color: var(--text);
      min-height: 100vh; padding: 16px;
    }
    .container { max-width: 480px; margin: 0 auto; }
    header { text-align: center; padding: 24px 0 20px; }
    header h1 { font-size: 1.5rem; font-weight: 700; }
    header p { color: var(--muted); font-size: 0.8rem; margin-top: 4px; }
    .card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius); overflow: hidden; margin-bottom: 16px;
      box-shadow: 0 1px 3px var(--shadow);
    }
    .card-header {
      padding: 12px 16px; font-size: 0.75rem; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--muted); border-bottom: 1px solid var(--border);
      display: flex; justify-content: space-between; align-items: center;
    }
    .card-body { padding: 16px; }
    select, input {
      width: 100%; padding: 10px 12px; border: 1px solid var(--border);
      border-radius: 8px; background: var(--surface2); color: var(--text);
      font-size: 1rem; font-family: inherit; outline: none;
      -webkit-appearance: none; appearance: none;
    }
    select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23888'%3E%3Cpath d='M6 8L1 3h10z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; }
    select:focus, input:focus { border-color: var(--accent); }
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 10px 16px; border: none; border-radius: 8px;
      font-size: 0.9rem; font-weight: 600; font-family: inherit;
      cursor: pointer; transition: all 0.15s; width: 100%;
    }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-primary:active { transform: scale(0.98); }
    .btn-danger { background: var(--red); color: #fff; width: auto; padding: 6px 12px; font-size: 0.8rem; }
    .btn-ghost { background: transparent; color: var(--muted); padding: 6px 10px; font-size: 0.8rem; width: auto; }
    .btn-ghost:hover { color: var(--text); }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
    .form-group { margin-bottom: 12px; }
    .form-group:last-child { margin-bottom: 0; }
    .form-label { display: block; font-size: 0.75rem; color: var(--muted); margin-bottom: 6px; font-weight: 500; }
    .score-row { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
    .score-row label { font-size: 0.8rem; color: var(--muted); white-space: nowrap; }
    .score-input { width: 60px; text-align: center; padding: 8px; font-size: 1.1rem; font-weight: 600; }
    .score-separator { color: var(--muted); font-weight: 600; }
    .score-presets { display: flex; gap: 6px; margin-bottom: 12px; }
    .score-preset {
      flex: 1; padding: 6px; border: 1px solid var(--border); border-radius: 6px;
      background: var(--surface2); color: var(--muted); font-size: 0.75rem;
      text-align: center; cursor: pointer; font-family: inherit; font-weight: 500;
    }
    .score-preset:hover, .score-preset.active { border-color: var(--accent); color: var(--accent); }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 8px 12px; text-align: left; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
    td { padding: 10px 12px; border-top: 1px solid var(--border); font-size: 0.9rem; }
    tr:last-child td { border-bottom: none; }
    .rank-cell { font-size: 1.1rem; text-align: center; width: 40px; }
    .name-cell { font-weight: 600; }
    .record-cell { color: var(--muted); font-size: 0.85rem; }
    .winrate-cell { font-weight: 600; text-align: right; }
    .winrate-high { color: var(--green); }
    .winrate-mid { color: var(--gold); }
    .winrate-low { color: var(--red); }
    .unranked { opacity: 0.5; }
    .match-row { display: flex; align-items: center; padding: 10px 16px; border-top: 1px solid var(--border); gap: 8px; }
    .match-row:first-child { border-top: none; }
    .match-result { flex: 1; font-size: 0.9rem; }
    .match-winner { font-weight: 600; color: var(--green); }
    .match-vs { color: var(--muted); margin: 0 4px; font-size: 0.8rem; }
    .match-loser { color: var(--red); }
    .match-score { color: var(--accent); font-weight: 600; font-size: 0.8rem; margin-left: 6px; }
    .match-meta { display: flex; align-items: center; gap: 8px; }
    .match-date { color: var(--muted); font-size: 0.7rem; white-space: nowrap; }
    .delete-form { display: inline; }
    .delete-btn { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.8rem; padding: 4px; line-height: 1; }
    .delete-btn:hover { color: var(--red); }
    .toggle-section { display: none; }
    .toggle-section.show { display: block; }
    .toggle-link { color: var(--accent); cursor: pointer; font-size: 0.8rem; font-weight: 500; text-decoration: none; }
    .toggle-link:hover { text-decoration: underline; }
    .theme-toggle {
      position: fixed; top: 16px; right: 16px; z-index: 100;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 20px; padding: 6px 12px; cursor: pointer;
      font-size: 1.1rem; line-height: 1; box-shadow: 0 2px 8px var(--shadow);
      transition: all 0.2s;
    }
    .theme-toggle:hover { border-color: var(--accent); }
    .fab {
      position: fixed; bottom: 24px; right: 24px; z-index: 100;
      width: 56px; height: 56px; border-radius: 50%;
      background: var(--accent); color: #fff; border: none;
      font-size: 1.8rem; cursor: pointer; display: flex;
      align-items: center; justify-content: center;
      box-shadow: 0 4px 16px rgba(59,130,246,0.4);
      transition: all 0.2s;
    }
    .fab:hover { transform: scale(1.08); background: var(--accent-hover); }
    .fab:active { transform: scale(0.95); }
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      z-index: 200; display: none; align-items: flex-end; justify-content: center;
      backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
    }
    .modal-overlay.show { display: flex; }
    .modal {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 16px 16px 0 0; width: 100%; max-width: 480px;
      padding: 24px 20px; padding-bottom: max(24px, env(safe-area-inset-bottom));
      animation: slideUp 0.25s ease-out;
    }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    .modal-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 20px;
    }
    .modal-header h2 { font-size: 1.1rem; font-weight: 700; }
    .modal-close {
      background: none; border: none; color: var(--muted); font-size: 1.5rem;
      cursor: pointer; padding: 4px; width: auto; line-height: 1;
    }
    .modal-close:hover { color: var(--text); }
    .empty { text-align: center; padding: 24px 16px; color: var(--muted); font-size: 0.9rem; }
    .flash { padding: 10px 16px; font-size: 0.85rem; border-radius: 8px; margin-bottom: 12px; }
    .flash-error { background: #2d1515; border: 1px solid #5c2020; color: var(--red); }
  </style>
  <script>
    // Theme
    (function() {
      const saved = localStorage.getItem('theme') || 'light';
      document.documentElement.setAttribute('data-theme', saved);
    })();
    function toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      document.getElementById('theme-icon').textContent = next === 'dark' ? '☀️' : '🌙';
    }
    function toggleSection(id) {
      const el = document.getElementById(id);
      el.classList.toggle('show');
    }
    function setScore(w, l) {
      const ws = document.getElementById('winner-score');
      const ls = document.getElementById('loser-score');
      if (ws) ws.value = w;
      if (ls) ls.value = l;
    }
    function openModal() {
      document.getElementById('match-modal').classList.add('show');
      document.body.style.overflow = 'hidden';
    }
    function closeModal() {
      document.getElementById('match-modal').classList.remove('show');
      document.body.style.overflow = '';
    }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  </script>
</head>
<body>
  <button class="theme-toggle" onclick="toggleTheme()"><span id="theme-icon">🌙</span></button>
  <script>document.getElementById('theme-icon').textContent = (localStorage.getItem('theme') || 'light') === 'dark' ? '☀️' : '🌙';</script>
  <div class="container">
    <header>
      <h1>🏓 Lindy Pong</h1>
      <p>Office ping pong tracker</p>
    </header>
    ${content}
  </div>
</body>
</html>`
}

app.get('/', async (c) => {
  const db = c.env.DB

  const players = await db.prepare('SELECT * FROM players ORDER BY name').all()

  const leaderboard = await db.prepare(`
    SELECT p.id, p.name, p.elo_rating,
      COUNT(DISTINCT CASE WHEN m.winner_id = p.id THEN m.id END) as wins,
      COUNT(DISTINCT CASE WHEN m.loser_id = p.id THEN m.id END) as losses,
      (COUNT(DISTINCT CASE WHEN m.winner_id = p.id THEN m.id END) +
       COUNT(DISTINCT CASE WHEN m.loser_id = p.id THEN m.id END)) as total_games,
      CAST(COUNT(DISTINCT CASE WHEN m.winner_id = p.id THEN m.id END) AS FLOAT) * 100.0 /
        NULLIF((COUNT(DISTINCT CASE WHEN m.winner_id = p.id THEN m.id END) +
                COUNT(DISTINCT CASE WHEN m.loser_id = p.id THEN m.id END)), 0) as win_rate
    FROM players p
    LEFT JOIN matches m ON m.winner_id = p.id OR m.loser_id = p.id
    GROUP BY p.id, p.name, p.elo_rating
    ORDER BY
      CASE WHEN (COUNT(DISTINCT CASE WHEN m.winner_id = p.id THEN m.id END) +
                 COUNT(DISTINCT CASE WHEN m.loser_id = p.id THEN m.id END)) >= 3 THEN 0 ELSE 1 END,
      p.elo_rating DESC
  `).all()

  const matches = await db.prepare(`
    SELECT m.id, m.created_at, m.winner_score, m.loser_score,
      m.winner_elo_change, m.loser_elo_change,
      w.name as winner_name, l.name as loser_name
    FROM matches m
    JOIN players w ON m.winner_id = w.id
    JOIN players l ON m.loser_id = l.id
    ORDER BY m.created_at DESC LIMIT 30
  `).all()

  // Player options
  const opts = (players.results || []).map((p: any) =>
    `<option value="${p.id}">${p.name}</option>`
  ).join('')

  // Leaderboard rows
  let lbRows = ''
  let rank = 0
  for (const p of (leaderboard.results || []) as any[]) {
    const games = p.total_games as number
    const wr = p.win_rate as number | null
    const elo = (p.elo_rating as number) || 1000
    const ranked = games >= 3

    if (ranked) {
      rank++
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`
      lbRows += `<tr>
        <td class="rank-cell">${medal}</td>
        <td class="name-cell">${p.name}</td>
        <td class="record-cell">${p.wins}W ${p.losses}L</td>
        <td class="winrate-cell" style="font-weight:700">${Math.round(elo)}</td>
        <td class="winrate-cell" style="color:var(--muted);font-size:0.8rem">${wr?.toFixed(0)}%</td>
      </tr>`
    } else {
      lbRows += `<tr class="unranked">
        <td class="rank-cell">–</td>
        <td class="name-cell">${p.name}</td>
        <td class="record-cell">${p.wins}W ${p.losses}L</td>
        <td class="winrate-cell" style="color:var(--muted)">${Math.round(elo)}</td>
        <td class="winrate-cell" style="color:var(--muted);font-size:0.8rem">${games > 0 ? wr?.toFixed(0) + '%' : '—'}</td>
      </tr>`
    }
  }

  // Match history
  let matchRows = ''
  for (const m of (matches.results || []) as any[]) {
    const d = new Date((m.created_at as number) * 1000)
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const scoreStr = (m.winner_score != null && m.loser_score != null)
      ? `<span class="match-score">${m.winner_score}–${m.loser_score}</span>` : ''

    const winnerEloChange = m.winner_elo_change as number | null
    const loserEloChange = m.loser_elo_change as number | null
    const eloStr = (winnerEloChange != null && loserEloChange != null)
      ? `<span class="match-score" style="font-size:0.75rem;margin-left:6px;color:var(--muted)">(${winnerEloChange > 0 ? '+' : ''}${winnerEloChange} / ${loserEloChange > 0 ? '+' : ''}${loserEloChange})</span>`
      : ''

    matchRows += `<div class="match-row">
      <div class="match-result">
        <span class="match-winner">${m.winner_name}</span>
        <span class="match-vs">beat</span>
        <span class="match-loser">${m.loser_name}</span>
        ${scoreStr}${eloStr}
      </div>
      <div class="match-meta">
        <span class="match-date">${dateStr} ${timeStr}</span>
        <form method="POST" action="/matches/${m.id}/delete" class="delete-form">
          <button type="submit" class="delete-btn" title="Delete">✕</button>
        </form>
      </div>
    </div>`
  }

  const content = `
    <!-- FAB + Modal for Record Match -->
    <button class="fab" onclick="openModal()" title="Record Match">+</button>
    <div id="match-modal" class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-header">
          <h2>🎮 Record Match</h2>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        ${(players.results || []).length < 2
          ? '<p class="empty">Add at least 2 players first.</p>'
          : `<form method="POST" action="/matches">
              <div class="form-row">
                <div>
                  <label class="form-label">Winner 🏆</label>
                  <select name="winner_id" required><option value="">Select...</option>${opts}</select>
                </div>
                <div>
                  <label class="form-label">Loser 😔</label>
                  <select name="loser_id" required><option value="">Select...</option>${opts}</select>
                </div>
              </div>
              <div class="score-presets">
                <button type="button" class="score-preset" onclick="setScore(11,0)">11–0</button>
                <button type="button" class="score-preset" onclick="setScore(11,9)">11–9</button>
                <button type="button" class="score-preset" onclick="setScore(21,0)">21–0</button>
                <button type="button" class="score-preset" onclick="setScore(21,19)">21–19</button>
                <button type="button" class="score-preset" onclick="setScore('','')">No score</button>
              </div>
              <div class="score-row">
                <label>Score:</label>
                <input type="number" id="winner-score" name="winner_score" class="score-input" min="0" max="99" placeholder="–">
                <span class="score-separator">–</span>
                <input type="number" id="loser-score" name="loser_score" class="score-input" min="0" max="99" placeholder="–">
              </div>
              <button type="submit" class="btn btn-primary">Record Match</button>
            </form>`
        }
      </div>
    </div>

    <!-- Leaderboard -->
    <div class="card">
      <div class="card-header">🏆 Leaderboard</div>
      ${lbRows
        ? `<table><thead><tr><th style="width:40px;text-align:center">#</th><th>Player</th><th>Record</th><th style="text-align:right">Elo</th><th style="text-align:right">Win%</th></tr></thead><tbody>${lbRows}</tbody></table>`
        : '<p class="empty">No players yet</p>'
      }
    </div>

    <!-- Match History -->
    <div class="card">
      <div class="card-header">📜 Recent Matches</div>
      ${matchRows || '<p class="empty">No matches yet</p>'}
    </div>

    <!-- Admin: Add/Remove Players (hidden by default) -->
    <div style="text-align:center;margin:16px 0">
      <a class="toggle-link" onclick="toggleSection('admin')">⚙️ Manage Players</a>
    </div>
    <div id="admin" class="toggle-section">
      <div class="card">
        <div class="card-header">➕ Add Player</div>
        <div class="card-body">
          <form method="POST" action="/players" style="display:flex;gap:8px">
            <input type="text" name="name" required placeholder="Player name" maxlength="30" style="flex:1">
            <button type="submit" class="btn btn-primary" style="width:auto;padding:10px 20px">Add</button>
          </form>
        </div>
      </div>
      ${(players.results || []).length > 0 ? `
      <div class="card">
        <div class="card-header">🗑️ Remove Player</div>
        <div class="card-body">
          <form method="POST" action="/players/delete" style="display:flex;gap:8px">
            <select name="player_id" required style="flex:1"><option value="">Select player...</option>${opts}</select>
            <button type="submit" class="btn btn-danger" style="width:auto">Remove</button>
          </form>
        </div>
      </div>
      ` : ''}
    </div>
  `

  return c.html(layout(content))
})

app.post('/players', async (c) => {
  const formData = await c.req.parseBody()
  const name = (formData.name as string)?.trim()
  if (!name) return c.redirect('/')

  try {
    await c.env.DB.prepare('INSERT INTO players (id, name, elo_rating, created_at) VALUES (?, ?, 1000, unixepoch())')
      .bind(generateId(), name).run()
  } catch (e) { console.error('Add player error:', e) }

  return c.redirect('/')
})

app.post('/players/delete', async (c) => {
  const formData = await c.req.parseBody()
  const id = formData.player_id as string
  if (!id) return c.redirect('/')

  try {
    await c.env.DB.prepare('DELETE FROM matches WHERE winner_id = ? OR loser_id = ?').bind(id, id).run()
    await c.env.DB.prepare('DELETE FROM players WHERE id = ?').bind(id).run()
  } catch (e) { console.error('Delete player error:', e) }

  return c.redirect('/')
})

app.post('/matches', async (c) => {
  const formData = await c.req.parseBody()
  const winnerId = formData.winner_id as string
  const loserId = formData.loser_id as string
  const winnerScore = formData.winner_score ? parseInt(formData.winner_score as string) : null
  const loserScore = formData.loser_score ? parseInt(formData.loser_score as string) : null

  if (!winnerId || !loserId || winnerId === loserId) return c.redirect('/')

  try {
    // Get current Elo ratings
    const winner = await c.env.DB.prepare('SELECT elo_rating FROM players WHERE id = ?').bind(winnerId).first()
    const loser = await c.env.DB.prepare('SELECT elo_rating FROM players WHERE id = ?').bind(loserId).first()

    const winnerRating = (winner?.elo_rating as number) || 1000
    const loserRating = (loser?.elo_rating as number) || 1000

    // Calculate Elo changes
    const winnerEloChange = calculateEloChange(winnerRating, loserRating, 1)
    const loserEloChange = calculateEloChange(loserRating, winnerRating, 0)

    // Update player ratings
    await c.env.DB.prepare('UPDATE players SET elo_rating = ? WHERE id = ?')
      .bind(winnerRating + winnerEloChange, winnerId).run()
    await c.env.DB.prepare('UPDATE players SET elo_rating = ? WHERE id = ?')
      .bind(loserRating + loserEloChange, loserId).run()

    // Insert match with Elo changes
    await c.env.DB.prepare(
      'INSERT INTO matches (id, winner_id, loser_id, winner_score, loser_score, winner_elo_change, loser_elo_change, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())'
    ).bind(generateId(), winnerId, loserId, winnerScore, loserScore, winnerEloChange, loserEloChange).run()
  } catch (e) { console.error('Record match error:', e) }

  return c.redirect('/')
})

app.post('/matches/:id/delete', async (c) => {
  const id = c.req.param('id')
  try {
    // Get match data before deleting
    const match = await c.env.DB.prepare(
      'SELECT winner_id, loser_id, winner_elo_change, loser_elo_change FROM matches WHERE id = ?'
    ).bind(id).first()

    if (match) {
      const winnerEloChange = (match.winner_elo_change as number) || 0
      const loserEloChange = (match.loser_elo_change as number) || 0

      // Reverse Elo changes
      await c.env.DB.prepare('UPDATE players SET elo_rating = elo_rating - ? WHERE id = ?')
        .bind(winnerEloChange, match.winner_id).run()
      await c.env.DB.prepare('UPDATE players SET elo_rating = elo_rating - ? WHERE id = ?')
        .bind(loserEloChange, match.loser_id).run()
    }

    // Delete the match
    await c.env.DB.prepare('DELETE FROM matches WHERE id = ?').bind(id).run()
  } catch (e) { console.error('Delete match error:', e) }
  return c.redirect('/')
})

export default app
