/*
# Add quick_join_rooms table for matchmaking

1. New Tables
- `quick_join_rooms`
  - `room_id` (text, primary key) — the 6-char room code
  - `host_id` (uuid, not null, references auth.users) — the player who created the room
  - `host_username` (text, not null) — display name of host
  - `status` (text, not null, default 'lobby') — 'lobby' | 'playing' | 'ended'
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on quick_join_rooms.
- Any authenticated user can SELECT (to find open rooms to quick-join).
- Any authenticated user can INSERT their own room (host_id = auth.uid()).
- Host can UPDATE/DELETE their own room rows.

3. Notes
- When a host creates a room, they insert a row with status='lobby'.
- Quick Join queries for rooms with status='lobby', ordered by created_at, and joins the oldest one.
- When the host starts the match, they update status to 'playing'.
- When the match ends or the host leaves, they delete the row (or set status='ended').
*/

CREATE TABLE IF NOT EXISTS quick_join_rooms (
  room_id text PRIMARY KEY,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host_username text NOT NULL,
  status text NOT NULL DEFAULT 'lobby',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quick_join_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_quick_join_rooms" ON quick_join_rooms;
CREATE POLICY "select_quick_join_rooms" ON quick_join_rooms FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_quick_join_rooms" ON quick_join_rooms;
CREATE POLICY "insert_quick_join_rooms" ON quick_join_rooms FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "update_quick_join_rooms" ON quick_join_rooms;
CREATE POLICY "update_quick_join_rooms" ON quick_join_rooms FOR UPDATE
  TO authenticated USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "delete_quick_join_rooms" ON quick_join_rooms;
CREATE POLICY "delete_quick_join_rooms" ON quick_join_rooms FOR DELETE
  TO authenticated USING (auth.uid() = host_id);

CREATE INDEX IF NOT EXISTS idx_quick_join_rooms_status ON quick_join_rooms (status, created_at);
