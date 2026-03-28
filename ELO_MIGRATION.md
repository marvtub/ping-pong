# Elo Rating System - Database Migration

## Required D1 Database Migrations

Run these commands on your D1 database before deploying the updated code:

```bash
# Connect to your D1 database
wrangler d1 execute ping-pong-db --local --command "ALTER TABLE players ADD COLUMN elo_rating REAL DEFAULT 1000;"
wrangler d1 execute ping-pong-db --local --command "ALTER TABLE matches ADD COLUMN winner_elo_change REAL;"
wrangler d1 execute ping-pong-db --local --command "ALTER TABLE matches ADD COLUMN loser_elo_change REAL;"

# For production database
wrangler d1 execute ping-pong-db --command "ALTER TABLE players ADD COLUMN elo_rating REAL DEFAULT 1000;"
wrangler d1 execute ping-pong-db --command "ALTER TABLE matches ADD COLUMN winner_elo_change REAL;"
wrangler d1 execute ping-pong-db --command "ALTER TABLE matches ADD COLUMN loser_elo_change REAL;"
```

## What Changed

### Database Schema
1. **players table**: Added `elo_rating` column (REAL, default 1000)
2. **matches table**: Added `winner_elo_change` and `loser_elo_change` columns (REAL)

### Code Changes

1. **Elo Calculation Function** (src/index.ts:13-17)
   - K-factor: 32
   - Expected score: 1 / (1 + 10^((opponent - player) / 400))
   - New rating: old + K * (actual - expected)

2. **POST /matches** (src/index.ts:407-435)
   - Fetches current Elo ratings for both players
   - Calculates Elo changes for winner (+) and loser (-)
   - Updates player Elo ratings
   - Stores Elo changes in match record

3. **POST /matches/:id/delete** (src/index.ts:437-457)
   - Retrieves Elo changes from match record
   - Reverses Elo changes before deleting match
   - Prevents Elo rating drift from deleted matches

4. **Leaderboard**
   - Sorts by Elo rating (descending) instead of win%
   - Still requires 3+ games for medal ranks
   - Shows Elo rating as primary stat, win% as secondary

5. **Match History**
   - Displays Elo changes for each match (e.g., "+18 / -18")

6. **Player Creation**
   - New players start at 1000 Elo

## Testing

After running migrations:
1. Add test players
2. Record matches and verify Elo changes appear
3. Check leaderboard sorts by Elo
4. Delete a match and verify Elo is reversed correctly
