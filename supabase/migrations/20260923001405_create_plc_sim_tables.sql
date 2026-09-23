/*
# Create PLC Simulator State Tables (single-tenant, no auth)

1. Purpose
   - Stores the real-time state of a simulated S7-1200 PLC so that a web-based
     simulator and an external TIA Portal / S7-PLCSIM bridge can exchange data
     through Supabase as a shared real-time message bus.
   - The `plc_state` table holds the latest snapshot of all I/O, memory and CPU flags.
   - The `plc_events` table holds a chronological log of state changes for auditing.

2. New Tables
   - `plc_state` (single row, id = 1)
     - `id` int primary key, always 1
     - `run` boolean — CPU in RUN (true) or STOP (false)
     - `sf` boolean — System Fault
     - `bf` boolean — Bus Fault
     - `inputs` jsonb — digital input bit array {I0.0..I0.7}
     - `outputs` jsonb — digital output bit array {Q0.0..Q0.7}
     - `memory_bits` jsonb — marker bits {M0.0, M0.1, M0.2, M10.0}
     - `mw100` int — memory word MW100 value
     - `cycles` int — scan cycle counter
     - `auto_mode` boolean — Auto/Manual selector
     - `start_pressed` boolean — Start button momentary state
     - `stop_held` boolean — Stop button held state
     - `latch` boolean — internal latch (seal-in)
     - `relay_k1` boolean — relay K1 state
     - `relay_k2` boolean — relay K2 state
     - `source` text — who last wrote the state ('simulator' or 'tia-portal')
     - `updated_at` timestamptz — last update time
   - `plc_events`
     - `id` bigserial primary key
     - `event_type` text — 'state_change' | 'scan' | 'connection'
     - `source` text — 'simulator' | 'tia-portal'
     - `payload` jsonb — full state snapshot
     - `created_at` timestamptz default now()

3. Security
   - RLS enabled on both tables.
   - Single-tenant (no auth): `TO anon, authenticated` CRUD so the anon-key
     frontend and the edge function (service role) can both read/write.
*/

CREATE TABLE IF NOT EXISTS plc_state (
  id int PRIMARY KEY DEFAULT 1,
  run boolean NOT NULL DEFAULT true,
  sf boolean NOT NULL DEFAULT false,
  bf boolean NOT NULL DEFAULT false,
  inputs jsonb NOT NULL DEFAULT '{"bits": [false,false,false,false,false,false,false,false]}'::jsonb,
  outputs jsonb NOT NULL DEFAULT '{"bits": [false,false,false,false,false,false,false,false]}'::jsonb,
  memory_bits jsonb NOT NULL DEFAULT '{"M0_0": false, "M0_1": false, "M0_2": false, "M10_0": false}'::jsonb,
  mw100 int NOT NULL DEFAULT 0,
  cycles int NOT NULL DEFAULT 0,
  auto_mode boolean NOT NULL DEFAULT false,
  start_pressed boolean NOT NULL DEFAULT false,
  stop_held boolean NOT NULL DEFAULT false,
  latch boolean NOT NULL DEFAULT false,
  relay_k1 boolean NOT NULL DEFAULT false,
  relay_k2 boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'simulator',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure exactly one row exists
INSERT INTO plc_state (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE plc_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_plc_state" ON plc_state;
CREATE POLICY "anon_select_plc_state" ON plc_state FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_plc_state" ON plc_state;
CREATE POLICY "anon_insert_plc_state" ON plc_state FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_plc_state" ON plc_state;
CREATE POLICY "anon_update_plc_state" ON plc_state FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_plc_state" ON plc_state;
CREATE POLICY "anon_delete_plc_state" ON plc_state FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS plc_events (
  id bigserial PRIMARY KEY,
  event_type text NOT NULL DEFAULT 'state_change',
  source text NOT NULL DEFAULT 'simulator',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE plc_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_plc_events" ON plc_events;
CREATE POLICY "anon_select_plc_events" ON plc_events FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_plc_events" ON plc_events;
CREATE POLICY "anon_insert_plc_events" ON plc_events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_plc_events" ON plc_events;
CREATE POLICY "anon_delete_plc_events" ON plc_events FOR DELETE
  TO anon, authenticated USING (true);

-- Index for chronological queries
CREATE INDEX IF NOT EXISTS idx_plc_events_created_at ON plc_events (created_at DESC);
