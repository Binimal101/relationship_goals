-- Add icon_name column to milestones table (if not present)
-- This stores the Lucide icon name string (e.g. 'heart', 'star', 'calendar')
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS icon_name text DEFAULT 'heart';
