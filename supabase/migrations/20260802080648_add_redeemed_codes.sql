/*
# Track redeemed codes per user

1. New Tables
- `redeemed_codes`
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users, the user who redeemed)
  - `code` (text, the code string, e.g. 'beta1')
  - `redeemed_at` (timestamptz, when redeemed)
2. Security
- Enable RLS on `redeemed_codes`.
- Owner-scoped CRUD: each authenticated user can only read/insert their own redeemed-code rows.
- Unique constraint on (user_id, code) so a user can only redeem a given code once.
3. Notes
- The frontend checks this table before granting rewards to enforce one-per-user redemption.
*/

CREATE TABLE IF NOT EXISTS redeemed_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE redeemed_codes ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS redeemed_codes_user_code_key ON redeemed_codes (user_id, code);

DROP POLICY IF EXISTS "select_own_redeemed_codes" ON redeemed_codes;
CREATE POLICY "select_own_redeemed_codes" ON redeemed_codes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_redeemed_codes" ON redeemed_codes;
CREATE POLICY "insert_own_redeemed_codes" ON redeemed_codes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_redeemed_codes" ON redeemed_codes;
CREATE POLICY "delete_own_redeemed_codes" ON redeemed_codes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);