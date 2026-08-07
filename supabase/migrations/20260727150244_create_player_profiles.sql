/*
# Create player_profiles table (multi-user, auth-based)

1. New Tables
- `player_profiles`
  - `id` (uuid, primary key, references auth.users.id ON DELETE CASCADE)
  - `username` (text, not null, unique) — display name chosen at signup
  - `coins` (int, not null, default 0) — currency earned from winning matches
  - `equipped_skin` (text, not null, default 'default')
  - `owned_skins` (text[], not null, default '{default}') — array of skin ids owned
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())
2. Security
- Enable RLS on `player_profiles`.
- Owner-scoped CRUD: each authenticated user can only read/modify their own profile row.
3. Notes
- A trigger keeps `updated_at` current on every update.
*/

CREATE TABLE IF NOT EXISTS player_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  coins int NOT NULL DEFAULT 0,
  equipped_skin text NOT NULL DEFAULT 'default',
  owned_skins text[] NOT NULL DEFAULT ARRAY['default']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON player_profiles;
CREATE POLICY "select_own_profile" ON player_profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON player_profiles;
CREATE POLICY "insert_own_profile" ON player_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON player_profiles;
CREATE POLICY "update_own_profile" ON player_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON player_profiles;
CREATE POLICY "delete_own_profile" ON player_profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION touch_profile_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profile_touch ON player_profiles;
CREATE TRIGGER profile_touch
BEFORE UPDATE ON player_profiles
FOR EACH ROW EXECUTE FUNCTION touch_profile_updated_at();
