-- WallGame Database Schema
-- Run this script in PostgreSQL to create the database schema

-- Create database (run this first if database doesn't exist)
-- CREATE DATABASE wallgame;

-- Connect to wallgame database
\c wallgame;

-- ===================================
-- LOBBY/METADATA TABLES
-- ===================================

-- Users (players) - persists across all games
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Games metadata - what appears in lobby
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'paused', -- paused, playing, finished
    
    -- Settings (from spec)
    max_players INTEGER DEFAULT 100,
    map_width INTEGER DEFAULT 1000,
    map_height INTEGER DEFAULT 2000,
    prod_tick_interval INTEGER DEFAULT 10,
    pop_tick_interval INTEGER DEFAULT 600,
    artifact_release_time INTEGER DEFAULT 12,
    win_condition_duration NUMERIC DEFAULT 0.5,
    max_duration INTEGER, -- Max game length in pop ticks (null = unlimited)
    
    -- Terrain data (JSON array of arrays)
    -- Format: [["plains", "forest", ...], ...]
    -- Redundantly stored in grid_squares.terrain_type for faster queries
    terrain_data JSONB NOT NULL,
    
    -- Game state counters
    pop_ticks_remaining INTEGER, -- Decrements each pop tick, game ends at 0
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    start_time TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    
    -- Win condition
    winner_id UUID REFERENCES users(id),
    
    created_by UUID REFERENCES users(id)
);

-- Game participants (who joined)
-- Composite primary key allows queries: "which players in game X?" and "which games has player Y joined?"
CREATE TABLE IF NOT EXISTS game_participants (
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    is_in_game BOOLEAN DEFAULT false,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (game_id, user_id)
);

-- ===================================
-- GAME DATA TABLES (Square-Centric)
-- ===================================

-- Grid Squares - THE CORE TABLE
-- Each square stores its terrain type (duplicated from games.terrain_data for query performance)
-- and dynamic resources that change during gameplay
CREATE TABLE IF NOT EXISTS grid_squares (
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    
    -- Terrain type (duplicated from games.terrain_data for faster queries)
    -- Single source of truth: games.terrain_data, copied here on game creation
    terrain_type VARCHAR(20) NOT NULL,
    
    -- Resources (from spec)
    crops_count INTEGER DEFAULT 0,
    crops_max INTEGER DEFAULT 0,
    crops_regen_rate INTEGER DEFAULT 0,
    
    wood_count INTEGER DEFAULT 0,
    wood_max INTEGER DEFAULT 0,
    wood_regen_rate INTEGER DEFAULT 0,
    
    stone_count INTEGER DEFAULT 0,
    stone_max INTEGER DEFAULT 0,
    stone_regen_rate INTEGER DEFAULT 0, -- Usually 0, but allows for special cases
    
    ore_count INTEGER DEFAULT 0,
    ore_max INTEGER DEFAULT 0,
    ore_regen_rate INTEGER DEFAULT 0, -- Usually 0, but allows for special cases
    
    -- Visibility (array of player/alliance IDs)
    -- Kept as array for fast reads; move to separate table if performance issues arise
    visible_to TEXT[] DEFAULT '{}',

    
    -- City occupation
    city_center_id UUID,
    city_center_position VARCHAR(10), -- 'center' | 'edge' | null
    
    PRIMARY KEY (game_id, x, y)
);

-- Units (from spec)
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- settler, infantry, cavalry, etc.
    
    -- Location
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    
    -- Ownership
    owner_id UUID REFERENCES users(id),
    alliance_id UUID,
    
    -- Stats
    count INTEGER NOT NULL, -- 1-50,000
    fatigue INTEGER DEFAULT 0, -- 0-100
    morale INTEGER DEFAULT 100, -- 0-100
    training INTEGER DEFAULT 0, -- 0-100
    
    -- State
    is_on_guard BOOLEAN DEFAULT false,
    movement_queue JSONB DEFAULT '[]', -- [{x, y}, ...]
    carried_supplies JSONB DEFAULT '{}', -- {food: 0, lumber: 0, ...}
    
    FOREIGN KEY (game_id, x, y) REFERENCES grid_squares(game_id, x, y)
);

-- City Centers (from spec)
CREATE TABLE IF NOT EXISTS city_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    
    -- Location (center of 3x3)
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    
    -- Ownership
    owner_id UUID REFERENCES users(id),
    
    -- Stats
    population INTEGER DEFAULT 0,
    morale INTEGER DEFAULT 100,
    training INTEGER DEFAULT 0,
    fatigue INTEGER DEFAULT 0,
    damage INTEGER DEFAULT 0,
    
    -- Supplies stockpile
    food INTEGER DEFAULT 0,
    lumber INTEGER DEFAULT 0,
    bricks INTEGER DEFAULT 0,
    metal INTEGER DEFAULT 0,
    
    FOREIGN KEY (game_id, x, y) REFERENCES grid_squares(game_id, x, y)
);

-- Facilities (from spec)
CREATE TABLE IF NOT EXISTS facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- farm, lumber_mill, barracks, etc.
    
    -- Location
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    
    -- Ownership
    city_id UUID REFERENCES city_centers(id) ON DELETE CASCADE,
    
    -- Stats
    upgrade_progress INTEGER DEFAULT 20, -- 0-100%
    damage INTEGER DEFAULT 0,
    worker_count INTEGER DEFAULT 0,
    mode VARCHAR(20) DEFAULT 'produce', -- produce/repair/salvage/upgrade
    
    FOREIGN KEY (game_id, x, y) REFERENCES grid_squares(game_id, x, y)
);

-- Artifacts (from spec)
CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    
    -- Location
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    
    -- State
    is_revealed BOOLEAN DEFAULT false,
    holder_id UUID, -- Player or Unit ID
    hold_start_time TIMESTAMP WITH TIME ZONE,
    
    FOREIGN KEY (game_id, x, y) REFERENCES grid_squares(game_id, x, y)
);

-- ===================================
-- INDEXES FOR PERFORMANCE
-- ===================================

CREATE INDEX IF NOT EXISTS idx_grid_squares_game ON grid_squares(game_id);
CREATE INDEX IF NOT EXISTS idx_grid_squares_visibility ON grid_squares USING GIN(visible_to);
CREATE INDEX IF NOT EXISTS idx_units_game ON units(game_id);
CREATE INDEX IF NOT EXISTS idx_units_location ON units(game_id, x, y);
CREATE INDEX IF NOT EXISTS idx_units_owner ON units(owner_id);
CREATE INDEX IF NOT EXISTS idx_city_centers_game ON city_centers(game_id);
CREATE INDEX IF NOT EXISTS idx_city_centers_owner ON city_centers(owner_id);
CREATE INDEX IF NOT EXISTS idx_facilities_game ON facilities(game_id);
CREATE INDEX IF NOT EXISTS idx_facilities_location ON facilities(game_id, x, y);
CREATE INDEX IF NOT EXISTS idx_facilities_city ON facilities(city_id);

-- Insert some sample data for testing
INSERT INTO users (username, email, password_hash) VALUES 
('testuser1', 'test1@wallgame.com', '$2b$10$dummyhashfortesting'),
('testuser2', 'test2@wallgame.com', '$2b$10$dummyhashfortesting')
ON CONFLICT (username) DO NOTHING;

COMMIT;
