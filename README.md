# Ping Pong Leaderboard

A simple ping pong leaderboard app built with Hono and Cloudflare Workers + D1.

## Features

- Add and remove players
- Record match results (winner/loser)
- Delete individual matches
- Leaderboard with win percentage ranking
  - Minimum 3 games required to be ranked
  - Top 3 players get medal indicators (🥇🥈🥉)
- Match history (last 50 matches)
- Dark theme UI
- Server-side rendered HTML (no client-side JS needed)

## Database Schema

The D1 database uses this schema:

```sql
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE matches (
  id TEXT PRIMARY KEY,
  winner_id TEXT NOT NULL,
  loser_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (winner_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (loser_id) REFERENCES players(id) ON DELETE CASCADE
);
```

## Deployment

1. Install dependencies:
```bash
npm install
```

2. Deploy to Cloudflare Workers:
```bash
npm run deploy
```

Or directly:
```bash
wrangler deploy
```

## Development

Run locally with:
```bash
npm run dev
```

## Configuration

The D1 database binding is configured in `wrangler.toml`:
- Database name: `ping-pong-db`
- Database ID: `48dd9152-99f1-4290-a646-f0e0ad520223`
- Binding: `DB`

## Tech Stack

- [Hono](https://hono.dev/) - Lightweight web framework
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge computing platform
- [Cloudflare D1](https://developers.cloudflare.com/d1/) - Serverless SQL database
