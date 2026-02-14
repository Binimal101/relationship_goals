-- Create a dedicated table to store the relationship / anniversary start date
-- Run in Supabase SQL editor or via psql

CREATE TABLE IF NOT EXISTS anniversaries (
  id serial PRIMARY KEY,
  start_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert a default row if none exists (safe to run multiple times)
INSERT INTO anniversaries (id, start_date)
SELECT 1, '2023-01-15'::date
WHERE NOT EXISTS (SELECT 1 FROM anniversaries WHERE id = 1);

-- Optional: keep updated_at in sync on update
CREATE OR REPLACE FUNCTION touch_anniversaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_anniversaries_updated_at ON anniversaries;
CREATE TRIGGER trg_touch_anniversaries_updated_at
BEFORE UPDATE ON anniversaries
FOR EACH ROW EXECUTE PROCEDURE touch_anniversaries_updated_at();
