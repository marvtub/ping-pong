import { Hono } from 'hono'
import { Resvg } from '@cf-wasm/resvg/workerd'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

type LeaderboardPlayer = {
  id: string
  name: string
  elo_rating: number
  wins: number
  losses: number
  total_games: number
  win_rate: number | null
}

function generateId(): string {
  return crypto.randomUUID()
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function calculateEloChange(playerRating: number, opponentRating: number, actualScore: number): number {
  const K = 32
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400))
  return Math.round(K * (actualScore - expectedScore))
}

function leaderboardQuery(db: D1Database) {
  return db.prepare(`
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
  `)
}

function formatRecord(player: LeaderboardPlayer): string {
  return `${player.wins}W ${player.losses}L`
}

function formatWinRate(player: LeaderboardPlayer): string {
  return player.win_rate == null ? '0%' : `${player.win_rate.toFixed(0)}%`
}

function layout(content: string, origin = '') {
  const imageUrl = `${origin}/og.png`
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lindy Pong Leaderboard</title>
  <meta name="description" content="Live office ping pong rankings, records, win rates, Elo ratings, and recent matches.">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Lindy Pong Leaderboard">
  <meta property="og:description" content="See the current Lindy Pong top rankings, records, win rates, and Elo ratings.">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Lindy Pong Leaderboard">
  <meta name="twitter:description" content="See the current Lindy Pong top rankings, records, win rates, and Elo ratings.">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
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
    .name-link { color: var(--text); text-decoration: none; }
    .name-link:hover { color: var(--accent); text-decoration: underline; }
    .record-cell { color: var(--muted); font-size: 0.85rem; }
    .winrate-cell { font-weight: 600; text-align: right; }
    .winrate-high { color: var(--green); }
    .winrate-mid { color: var(--gold); }
    .winrate-low { color: var(--red); }
    .unranked { opacity: 0.5; }
    .match-row { padding: 12px 16px; border-top: 1px solid var(--border); cursor: pointer; transition: background 0.15s; }
    .match-row:first-child { border-top: none; }
    .match-row:hover { background: var(--surface2); }
    .match-row-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .match-result { flex: 1; font-size: 0.9rem; line-height: 1.4; }
    .match-winner { font-weight: 600; }
    .match-vs { color: var(--muted); margin: 0 4px; font-size: 0.8rem; }
    .match-loser { font-weight: 600; }
    .match-score { font-weight: 600; }
    .match-time { color: var(--muted); font-size: 0.75rem; white-space: nowrap; }
    .match-elo { font-size: 0.75rem; color: var(--muted); }
    .delete-form { display: inline; }
    .delete-btn { background: var(--red); border: none; color: #fff; cursor: pointer; font-size: 0.9rem; padding: 10px 16px; border-radius: 8px; font-weight: 600; width: 100%; font-family: inherit; }
    .delete-btn:hover { opacity: 0.9; }
    .delete-btn:active { transform: scale(0.98); }
    .match-detail-content { text-align: center; }
    .match-detail-players { font-size: 1.3rem; margin-bottom: 16px; line-height: 1.6; }
    .match-detail-score { font-size: 2rem; font-weight: 700; margin-bottom: 16px; color: var(--accent); }
    .match-detail-elo { display: flex; justify-content: space-around; margin-bottom: 20px; padding: 16px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
    .match-detail-elo-item { display: flex; flex-direction: column; align-items: center; }
    .match-detail-elo-label { font-size: 0.75rem; color: var(--muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
    .match-detail-elo-value { font-size: 1.2rem; font-weight: 700; }
    .match-detail-elo-value.positive { color: var(--green); }
    .match-detail-elo-value.negative { color: var(--red); }
    .match-detail-date { color: var(--muted); font-size: 0.85rem; margin-bottom: 20px; }
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
    .back-link { display: inline-flex; align-items: center; color: var(--accent); text-decoration: none; font-size: 0.9rem; margin-bottom: 16px; font-weight: 500; }
    .back-link:hover { text-decoration: underline; }
    .profile-header { text-align: center; padding: 24px 0; }
    .profile-name { font-size: 1.8rem; font-weight: 700; margin-bottom: 8px; }
    .profile-elo { font-size: 1.2rem; color: var(--accent); font-weight: 600; margin-bottom: 4px; }
    .profile-record { color: var(--muted); font-size: 0.9rem; }
    .chart-container { padding: 20px; }
    .chart-title { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 12px; }
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
    function openModal(id) {
      id = id || 'match-modal';
      document.getElementById(id).classList.add('show');
      document.body.style.overflow = 'hidden';
      if (id === 'match-modal') applyRememberedWinner();
    }
    function closeModal(id) {
      id = id || 'match-modal';
      document.getElementById(id).classList.remove('show');
      document.body.style.overflow = '';
    }
    function selectFirstDifferent(select, value) {
      if (!select) return;
      for (const option of select.options) {
        if (option.value && option.value !== value) {
          select.value = option.value;
          return;
        }
      }
      select.value = '';
    }
    function preventDuplicatePlayers(changed) {
      const winner = document.getElementById('winner-select');
      const loser = document.getElementById('loser-select');
      if (!winner || !loser || !winner.value || winner.value !== loser.value) return;
      if (changed === loser) {
        selectFirstDifferent(winner, loser.value);
      } else {
        selectFirstDifferent(loser, winner.value);
      }
    }
    function applyRememberedWinner() {
      const winner = document.getElementById('winner-select');
      if (!winner || winner.value) return;
      const remembered = localStorage.getItem('lindy-pong:last-winner-id');
      if (!remembered) return;
      const option = Array.from(winner.options).find((o) => o.value === remembered);
      if (!option) return;
      winner.value = remembered;
      preventDuplicatePlayers(winner);
    }
    function setupMatchMemory() {
      const form = document.getElementById('match-form');
      const winner = document.getElementById('winner-select');
      const loser = document.getElementById('loser-select');
      if (!form || !winner || !loser) return;
      winner.addEventListener('change', () => {
        if (winner.value) localStorage.setItem('lindy-pong:last-winner-id', winner.value);
        preventDuplicatePlayers(winner);
      });
      loser.addEventListener('change', () => preventDuplicatePlayers(loser));
      form.addEventListener('submit', () => {
        if (winner.value) localStorage.setItem('lindy-pong:last-winner-id', winner.value);
      });
      applyRememberedWinner();
    }
    function timeAgo(timestamp) {
      const now = Math.floor(Date.now() / 1000);
      const diff = now - timestamp;
      if (diff < 60) return 'just now';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
      const d = new Date(timestamp * 1000);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal('match-modal');
        closeModal('match-detail-modal');
      }
    });
    document.addEventListener('DOMContentLoaded', setupMatchMemory);
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

async function generateOgSvg(db: D1Database): Promise<string> {
  const leaderboard = await leaderboardQuery(db).all<LeaderboardPlayer>()
  const playerCount = await db.prepare('SELECT COUNT(*) as count FROM players').first<{ count: number }>()
  const matchCount = await db.prepare('SELECT COUNT(*) as count FROM matches').first<{ count: number }>()
  const rankedPlayers = (leaderboard.results || []).filter((p) => p.total_games >= 3)
  const topThree = rankedPlayers.slice(0, 3)

  const rows = topThree.length > 0
    ? topThree.map((p, index) => {
        const y = 240 + index * 105
        const rankFill = index === 0 ? '#d97706' : index === 1 ? '#64748b' : '#b45309'
        return `
          <g>
            <circle cx="112" cy="${y - 8}" r="30" fill="${rankFill}"/>
            <text x="112" y="${y + 3}" text-anchor="middle" font-size="28" font-weight="800" fill="#ffffff">${index + 1}</text>
            <text x="165" y="${y - 18}" font-size="44" font-weight="800" fill="#111827">${escapeHtml(p.name)}</text>
            <text x="165" y="${y + 28}" font-size="28" font-weight="600" fill="#4b5563">${escapeHtml(formatRecord(p))} · ${escapeHtml(formatWinRate(p))} win rate · ${Math.round(p.elo_rating || 1000)} Elo</text>
          </g>`
      }).join('')
    : `
      <text x="80" y="270" font-size="52" font-weight="800" fill="#111827">No ranked players yet</text>
      <text x="80" y="330" font-size="30" font-weight="600" fill="#4b5563">Players need 3 matches to appear in the top rankings.</text>`

  const rankedText = rankedPlayers.length === 1 ? '1 ranked player' : `${rankedPlayers.length} ranked players`
  const playersText = (playerCount?.count || 0) === 1 ? '1 player' : `${playerCount?.count || 0} players`
  const matchesText = (matchCount?.count || 0) === 1 ? '1 match recorded' : `${matchCount?.count || 0} matches recorded`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
  <title id="title">Lindy Pong leaderboard top rankings</title>
  <desc id="desc">Current top three Lindy Pong players with record, win rate, and Elo.</desc>
  <rect width="1200" height="630" fill="#f8fafc"/>
  <rect x="28" y="28" width="1144" height="574" rx="34" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/>
  <circle cx="1020" cy="128" r="96" fill="#dbeafe"/>
  <circle cx="1070" cy="96" r="42" fill="#2563eb"/>
  <text x="80" y="118" font-size="30" font-weight="800" fill="#2563eb" letter-spacing="2">LINDY PONG</text>
  <text x="80" y="178" font-size="58" font-weight="900" fill="#111827">Live Leaderboard</text>
  ${rows}
  <rect x="80" y="535" width="1040" height="1" fill="#e5e7eb"/>
  <text x="80" y="575" font-size="26" font-weight="700" fill="#4b5563">${escapeHtml(rankedText)} · ${escapeHtml(playersText)} · ${escapeHtml(matchesText)}</text>
</svg>`
}

app.get('/og.png', async (c) => {
  const svg = await generateOgSvg(c.env.DB)
  const resvg = await Resvg.async(svg, {
    fitTo: { mode: 'original' },
    font: {
      loadSystemFonts: false,
      defaultFontFamily: 'Arial'
    }
  })
  const image = resvg.render()

  try {
    return c.body(image.asPng(), 200, {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=60'
    })
  } finally {
    image.free()
    resvg.free()
  }
})

app.get('/og.svg', async (c) => {
  const svg = await generateOgSvg(c.env.DB)

  return c.body(svg, 200, {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'public, max-age=60'
  })
})

app.get('/', async (c) => {
  const db = c.env.DB

  const players = await db.prepare('SELECT * FROM players ORDER BY name').all()

  const leaderboard = await leaderboardQuery(db).all<LeaderboardPlayer>()

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
    `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`
  ).join('')

  // Leaderboard rows
  let lbRows = ''
  let rank = 0
  for (const p of (leaderboard.results || []) as LeaderboardPlayer[]) {
    const games = p.total_games as number
    const elo = (p.elo_rating as number) || 1000
    const ranked = games >= 3

    if (ranked) {
      rank++
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`
      lbRows += `<tr>
        <td class="rank-cell">${medal}</td>
        <td class="name-cell"><a href="/players/${escapeHtml(p.id)}" class="name-link">${escapeHtml(p.name)}</a></td>
        <td class="record-cell">${escapeHtml(formatRecord(p))}</td>
        <td class="winrate-cell" style="font-weight:700">${Math.round(elo)}</td>
        <td class="winrate-cell" style="color:var(--muted);font-size:0.8rem">${escapeHtml(formatWinRate(p))}</td>
      </tr>`
    } else {
      lbRows += `<tr class="unranked">
        <td class="rank-cell">–</td>
        <td class="name-cell"><a href="/players/${escapeHtml(p.id)}" class="name-link">${escapeHtml(p.name)}</a></td>
        <td class="record-cell">${escapeHtml(formatRecord(p))}</td>
        <td class="winrate-cell" style="color:var(--muted)">${Math.round(elo)}</td>
        <td class="winrate-cell" style="color:var(--muted);font-size:0.8rem">${games > 0 ? escapeHtml(formatWinRate(p)) : '—'}</td>
      </tr>`
    }
  }

  // Match history
  let matchRows = ''
  for (const m of (matches.results || []) as any[]) {
    const scoreStr = (m.winner_score != null && m.loser_score != null)
      ? ` ${m.winner_score}–${m.loser_score}` : ''

    const winnerEloChange = m.winner_elo_change as number | null
    const loserEloChange = m.loser_elo_change as number | null
    const eloStr = (winnerEloChange != null && loserEloChange != null)
      ? `<div class="match-elo">${winnerEloChange > 0 ? '+' : ''}${winnerEloChange} / ${loserEloChange > 0 ? '+' : ''}${loserEloChange}</div>`
      : ''

    matchRows += `<div class="match-row" onclick="openModal('match-detail-${m.id}')">
      <div class="match-row-top">
        <div class="match-result">
          <span class="match-winner">${escapeHtml(m.winner_name)}</span>
          <span class="match-vs">beat</span>
          <span class="match-loser">${escapeHtml(m.loser_name)}</span>
          <span class="match-score">${scoreStr}</span>
        </div>
        <span class="match-time"><script>document.write(timeAgo(${m.created_at}))</script></span>
      </div>
      ${eloStr}
    </div>`
  }

  // Match detail modals
  let matchModals = ''
  for (const m of (matches.results || []) as any[]) {
    const d = new Date((m.created_at as number) * 1000)
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const scoreDisplay = (m.winner_score != null && m.loser_score != null)
      ? `<div class="match-detail-score">${m.winner_score} – ${m.loser_score}</div>` : ''

    const winnerEloChange = m.winner_elo_change as number | null
    const loserEloChange = m.loser_elo_change as number | null

    matchModals += `
    <div id="match-detail-${m.id}" class="modal-overlay" onclick="if(event.target===this)closeModal('match-detail-${m.id}')">
      <div class="modal">
        <div class="modal-header">
          <h2>Match Details</h2>
          <button class="modal-close" onclick="closeModal('match-detail-${m.id}')">×</button>
        </div>
        <div class="match-detail-content">
          <div class="match-detail-players">
            <div style="font-weight:700;color:var(--green);margin-bottom:4px">${escapeHtml(m.winner_name)}</div>
            <div style="color:var(--muted);font-size:0.9rem;margin-bottom:4px">beat</div>
            <div style="font-weight:700;color:var(--red)">${escapeHtml(m.loser_name)}</div>
          </div>
          ${scoreDisplay}
          ${winnerEloChange != null && loserEloChange != null ? `
          <div class="match-detail-elo">
            <div class="match-detail-elo-item">
              <div class="match-detail-elo-label">${escapeHtml(m.winner_name)}</div>
              <div class="match-detail-elo-value positive">${winnerEloChange > 0 ? '+' : ''}${winnerEloChange}</div>
            </div>
            <div class="match-detail-elo-item">
              <div class="match-detail-elo-label">${escapeHtml(m.loser_name)}</div>
              <div class="match-detail-elo-value negative">${loserEloChange > 0 ? '+' : ''}${loserEloChange}</div>
            </div>
          </div>
          ` : ''}
          <div class="match-detail-date">${dateStr} at ${timeStr}</div>
          <form method="POST" action="/matches/${m.id}/delete">
            <button type="submit" class="delete-btn">Delete Match</button>
          </form>
        </div>
      </div>
    </div>`
  }

  const content = `
    <!-- FAB + Modal for Record Match -->
    <button class="fab" onclick="openModal('match-modal')" title="Record Match">+</button>
    <div id="match-modal" class="modal-overlay" onclick="if(event.target===this)closeModal('match-modal')">
      <div class="modal">
        <div class="modal-header">
          <h2>🎮 Record Match</h2>
          <button class="modal-close" onclick="closeModal('match-modal')">×</button>
        </div>
        ${(players.results || []).length < 2
          ? '<p class="empty">Add at least 2 players first.</p>'
          : `<form id="match-form" method="POST" action="/matches">
              <div class="form-row">
                <div>
                  <label class="form-label">Winner 🏆</label>
                  <select id="winner-select" name="winner_id" required><option value="">Select...</option>${opts}</select>
                </div>
                <div>
                  <label class="form-label">Loser 😔</label>
                  <select id="loser-select" name="loser_id" required><option value="">Select...</option>${opts}</select>
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

    <!-- Match Detail Modals -->
    ${matchModals}

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

  return c.html(layout(content, new URL(c.req.url).origin))
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

app.get('/players/:id', async (c) => {
  const playerId = c.req.param('id')
  const db = c.env.DB

  // Get player info
  const player = await db.prepare('SELECT * FROM players WHERE id = ?').bind(playerId).first()
  if (!player) return c.redirect('/')

  // Get player stats
  const stats = await db.prepare(`
    SELECT
      COUNT(DISTINCT CASE WHEN m.winner_id = ? THEN m.id END) as wins,
      COUNT(DISTINCT CASE WHEN m.loser_id = ? THEN m.id END) as losses
    FROM matches m
    WHERE m.winner_id = ? OR m.loser_id = ?
  `).bind(playerId, playerId, playerId, playerId).first()

  const wins = (stats?.wins as number) || 0
  const losses = (stats?.losses as number) || 0
  const totalGames = wins + losses
  const winRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : '0.0'

  // Get all matches for this player ordered by date
  const matches = await db.prepare(`
    SELECT m.id, m.created_at, m.winner_score, m.loser_score,
      m.winner_elo_change, m.loser_elo_change, m.winner_id, m.loser_id,
      w.name as winner_name, l.name as loser_name
    FROM matches m
    JOIN players w ON m.winner_id = w.id
    JOIN players l ON m.loser_id = l.id
    WHERE m.winner_id = ? OR m.loser_id = ?
    ORDER BY m.created_at ASC
  `).bind(playerId, playerId).all()

  // Build Elo history
  const eloHistory: Array<{timestamp: number, elo: number}> = [{timestamp: 0, elo: 1000}]
  let currentElo = 1000

  for (const m of (matches.results || []) as any[]) {
    const isWinner = m.winner_id === playerId
    const eloChange = isWinner
      ? (m.winner_elo_change as number)
      : (m.loser_elo_change as number)

    currentElo += eloChange
    eloHistory.push({
      timestamp: m.created_at as number,
      elo: currentElo
    })
  }

  // Generate SVG chart
  let chartSvg = ''
  if (eloHistory.length > 1) {
    const width = 440
    const height = 120
    const padding = 10
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2

    const minElo = Math.min(...eloHistory.map(h => h.elo), 1000) - 50
    const maxElo = Math.max(...eloHistory.map(h => h.elo), 1000) + 50
    const eloRange = maxElo - minElo

    const points = eloHistory.map((h, i) => {
      const x = padding + (i / (eloHistory.length - 1)) * chartWidth
      const y = padding + chartHeight - ((h.elo - minElo) / eloRange) * chartHeight
      return `${x},${y}`
    }).join(' ')

    const baselineY = padding + chartHeight - ((1000 - minElo) / eloRange) * chartHeight

    chartSvg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="max-width:100%;height:auto">
      <line x1="${padding}" y1="${baselineY}" x2="${width - padding}" y2="${baselineY}"
            stroke="var(--muted)" stroke-width="1" stroke-dasharray="4,4" opacity="0.5"/>
      <polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>
      ${eloHistory.map((h, i) => {
        const x = padding + (i / (eloHistory.length - 1)) * chartWidth
        const y = padding + chartHeight - ((h.elo - minElo) / eloRange) * chartHeight
        return `<circle cx="${x}" cy="${y}" r="3" fill="var(--accent)"/>`
      }).join('')}
    </svg>`
  }

  // Recent matches display (reversed for newest first)
  let matchRows = ''
  const recentMatches = [...(matches.results || [])].reverse().slice(0, 20)
  for (const m of recentMatches as any[]) {
    const isWinner = m.winner_id === playerId
    const scoreStr = (m.winner_score != null && m.loser_score != null)
      ? ` ${m.winner_score}–${m.loser_score}` : ''

    const eloChange = isWinner
      ? (m.winner_elo_change as number)
      : (m.loser_elo_change as number)
    const eloStr = eloChange != null
      ? `<div class="match-elo">${eloChange > 0 ? '+' : ''}${eloChange}</div>`
      : ''

    const opponentName = isWinner ? m.loser_name : m.winner_name
    const resultText = isWinner ? 'beat' : 'lost to'
    const resultClass = isWinner ? 'match-winner' : 'match-loser'

    matchRows += `<div class="match-row" style="cursor:default">
      <div class="match-row-top">
        <div class="match-result">
          <span class="${resultClass}">${resultText}</span>
          <span style="font-weight:600;margin-left:4px">${escapeHtml(opponentName)}</span>
          <span class="match-score">${scoreStr}</span>
        </div>
        <span class="match-time"><script>document.write(timeAgo(${m.created_at}))</script></span>
      </div>
      ${eloStr}
    </div>`
  }

  const content = `
    <a href="/" class="back-link">← Back to Leaderboard</a>

    <div class="profile-header">
      <div class="profile-name">${escapeHtml(player.name)}</div>
      <div class="profile-elo">${Math.round((player.elo_rating as number) || 1000)} Elo</div>
      <div class="profile-record">${wins}W - ${losses}L (${winRate}%)</div>
    </div>

    ${eloHistory.length > 1 ? `
    <div class="card">
      <div class="chart-container">
        <div class="chart-title">📈 Elo History</div>
        ${chartSvg}
      </div>
    </div>
    ` : ''}

    <div class="card">
      <div class="card-header">📜 Match History</div>
      ${matchRows || '<p class="empty">No matches yet</p>'}
    </div>
  `

  return c.html(layout(content, new URL(c.req.url).origin))
})

export default app
