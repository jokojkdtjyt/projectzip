-- Add optional, stable QFLOW chapter IDs and lesson-to-chapter Q-bank links.
-- Existing lessons stay standalone QFLOW chapters because qflow_chapter_id is NULL.
ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS qflow_chapter_code text,
  ADD COLUMN IF NOT EXISTS qflow_chapter_id text;

CREATE UNIQUE INDEX IF NOT EXISTS lessons_qflow_chapter_code_unique
  ON lessons (qflow_chapter_code);

CREATE INDEX IF NOT EXISTS lessons_qflow_chapter_id_idx
  ON lessons (qflow_chapter_id);
