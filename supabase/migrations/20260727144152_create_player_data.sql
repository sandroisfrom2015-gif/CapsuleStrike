/*
# Create player_data table (single-tenant, no auth)

1. New Tables
- `player_data`
  - `id` (int, primary key, always 1 — single shared profile for this no-auth game)
  - `coins` (int, not null, default 0) — currency earned from winning matches, spent in the skin shop
  - `equipped_skin` (text, not null, default 'default') — the skin id currently equipped on the player's capsule
  - `owned_skins` (text[], not null, default '{default}') — array of skin ids the player owns
  - `updated_at` (timestamptz, default now())
2. Security
- Enable RLS on `player_data`.
- Single-tenant no-auth app: allow anon + authenticated full CRUD (data is intentionally shared/public).
3. Notes
- A trigger keeps `updated_at` current on every update.
- A single row with id=1 is seeded so the frontend can read it immediately.
*/

CREATE TABLE IF NOT EXISTS player_data (
  id int PRIMARY KEY DEFAULT 1,
  coins int NOT NULL DEFAULT 0,
  equipped_skin text NOT NULL DEFAULT 'default',
  owned_skins text[] NOT NULL DEFAULT ARRAY['default']::text[],
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE player_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_player_data" ON player_data;
CREATE POLICY "anon_select_player_data" ON player_data FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_player_data" ON player_data;
CREATE POLICY "anon_insert_player_data" ON player_data FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_player_data" ON player_data;
CREATE POLICY "anon_update_player_data" ON player_data FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_player_data" ON player_data;
CREATE POLICY "anon_delete_player_data" ON player_data FOR DELETE
  TO anon, authenticated USING (true);

-- Seed the single shared profile row if it does not exist yet.
INSERT INTO player_data (id, coins, equipped_skin, owned_skins)
VALUES (1, 0, 'default', ARRAY['default']::text[])
ON CONFLICT (id) DO NOTHING;

-- Keep updated_at fresh on every update.
CREATE OR REPLACE FUNCTION touch_player_data_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS player_data_touch ON player_data;
CREATE TRIGGER player_data_touch
BEFORE UPDATE ON player_data
FOR EACH ROW EXECUTE FUNCTION touch_player_data_updated_at();
