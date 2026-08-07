/*
# Add case system, weapon skins, and games-played tracking

1. Modified Tables
- `player_profiles`
  - `games_played` (int, not null, default 0) — incremented after every match; every 5 games awards a free case + key
  - `cases` (int, not null, default 0) — unopened cases the player owns
  - `keys` (int, not null, default 0) — case keys used to open cases
  - `owned_weapon_skins` (text[], not null, default '{}') — array of weapon skin ids owned (separate from player capsule skins)
  - `equipped_weapon_skins` (jsonb, not null, default '{}'::jsonb) — map of weaponId -> weaponSkinId for equipped skins

2. Security
- No new tables; existing RLS policies on player_profiles already cover all CRUD.
- No policy changes needed — the existing owner-scoped policies apply to the new columns automatically.

3. Notes
- `games_played` is incremented client-side after each match. When it reaches a multiple of 5, the client also increments `cases` and `keys` by 1 each (the free case+key reward).
- Weapon skins are cosmetic only — they change the color/material of weapon viewmodels but do not affect stats.
- `equipped_weapon_skins` is a JSON object like {"ak47": "ak47_dragon", "m4": "m4_neon"} so each weapon can have its own skin.
*/ 

ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS games_played int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cases int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS keys int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS owned_weapon_skins text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS equipped_weapon_skins jsonb NOT NULL DEFAULT '{}'::jsonb;