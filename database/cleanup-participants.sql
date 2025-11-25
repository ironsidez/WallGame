-- Clean up stale game participants
-- Run this to reset all player-game associations

-- Remove all participants from all games
TRUNCATE TABLE game_participants;

-- Verify cleanup
SELECT COUNT(*) as remaining_participants FROM game_participants;

-- You can also view all participants by game:
-- SELECT g.name, COUNT(gp.id) as participant_count 
-- FROM games g
-- LEFT JOIN game_participants gp ON g.id = gp.game_id AND gp.left_at IS NULL
-- GROUP BY g.id, g.name
-- ORDER BY g.name;
